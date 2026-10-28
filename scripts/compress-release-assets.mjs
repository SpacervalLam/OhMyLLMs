import sharp from 'sharp';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,readdir,mkdir,stat,rename,realpath} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

export const compressionPolicy=Object.freeze({
 revision:2,qualities:Object.freeze([90,95,98]),alphaQuality:100,effort:6,smartSubsample:true,
 maximumRmse:5,maximumChannelShift:1,minimumSaving:.05
});
export class ImageQualityError extends Error{}
const sha256=data=>createHash('sha256').update(data).digest('hex');
const defaults=path.join(os.homedir(),'.codex','documents','OhMyLLMs','webp-compression');

export async function decodeImage(bytes){return sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});}

// Compare decoded sRGB pixels, including every alpha value. The light-colour
// mask is fixed from the master so output shifts cannot move pixels out of it.
export function measureImage(master,result){
 if(master.info.width!==result.info.width||master.info.height!==result.info.height)throw new Error('Image dimensions changed');
 const a=master.data,b=result.data;
 if(master.info.channels!==4||result.info.channels!==4||a.length!==b.length)throw new Error('Unexpected decoded image layout');
 let pixels=0,lightPixels=0,squared=0;const total=[0,0,0],lightTotal=[0,0,0];
 for(let i=0;i<a.length;i+=4){
  if(a[i+3]!==b[i+3])throw new Error('Image alpha changed');
  if(a[i+3]<=230)continue;
  pixels++;
  const light=a[i]>140&&a[i+1]>125&&a[i+2]>=a[i]&&a[i+2]-a[i+1]<65;
  if(light)lightPixels++;
  for(let channel=0;channel<3;channel++){
   const delta=b[i+channel]-a[i+channel];squared+=delta*delta;total[channel]+=delta;
   if(light)lightTotal[channel]+=delta;
  }
 }
 const rmse=pixels?Math.sqrt(squared/(pixels*3)):0;
 const channelShift=total.map(sum=>pixels?sum/pixels:0);
 const lightChannelShift=lightTotal.map(sum=>lightPixels?sum/lightPixels:0);
 const metrics={width:result.info.width,height:result.info.height,alphaErrors:0,opaquePixels:pixels,lightPixels,rmse,channelShift,lightChannelShift};
 if(rmse>compressionPolicy.maximumRmse||[...channelShift,...lightChannelShift].some(value=>Math.abs(value)>compressionPolicy.maximumChannelShift)){
  const error=new ImageQualityError('Image colour error exceeds release budget');error.metrics=metrics;throw error;
 }
 return metrics;
}

async function imagesIn(folder,prefix=''){
 const files=[];
 for(const entry of await readdir(folder,{withFileTypes:true})){
  const name=prefix+entry.name;
  if(entry.isDirectory())files.push(...await imagesIn(path.join(folder,entry.name),name+'/'));
  else if(entry.isFile()&&entry.name.endsWith('.webp'))files.push(name);
 }
 return files.sort();
}
async function atomicWrite(file,bytes){
 const temporary=file+`.${randomUUID()}.tmp`;
 await writeFile(temporary,bytes);await rename(temporary,file);
}

async function selectEncoding(source,master){
 const attempts=[];
 for(const quality of compressionPolicy.qualities){
  const candidate=await sharp(source).webp({quality,alphaQuality:compressionPolicy.alphaQuality,effort:compressionPolicy.effort,smartSubsample:compressionPolicy.smartSubsample}).toBuffer();
  let metrics;
  try{metrics=measureImage(master,await decodeImage(candidate));}
  catch(error){
   if(!(error instanceof ImageQualityError))throw error;
   attempts.push({quality,accepted:false,...error.metrics});continue;
  }
  attempts.push({quality,accepted:true,...metrics});
  if(candidate.length>=source.length*(1-compressionPolicy.minimumSaving))break;
  return {bytes:candidate,quality,reason:'compressed',metrics,attempts};
 }
 return {bytes:source,quality:null,reason:attempts.some(a=>a.accepted)?'insufficient-saving':'colour-budget',metrics:measureImage(master,master),attempts};
}

export async function compressReleaseAssets({
 root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),
 outputDirectory=path.join(root,'artifacts','desktop','OhMyLLMs','game','assets'),
 cacheDirectory=path.join(defaults,'cache'),reportFile=path.join(defaults,'report.json'),quiet=false,concurrency=4
}={}){
 const sourceDirectory=await realpath(path.resolve(root,'dist','assets')),output=await realpath(path.resolve(outputDirectory));
 const sourceKey=process.platform==='win32'?sourceDirectory.toLowerCase():sourceDirectory,outputKey=process.platform==='win32'?output.toLowerCase():output;
 if(sourceKey===outputKey||sourceKey.startsWith(outputKey+path.sep)||outputKey.startsWith(sourceKey+path.sep))throw new Error('Compression output must be separate from master artwork');
 await stat(output);await mkdir(cacheDirectory,{recursive:true});
 const names=await imagesIn(sourceDirectory),records=new Array(names.length);
 let next=0,completed=0,failure;
 async function compressImage(name){
  const source=await readFile(path.join(sourceDirectory,name)),target=path.join(output,name);
  if(!(await stat(target)).isFile())throw new Error(`Missing published asset: ${name}`);
  const master=await decodeImage(source),sourceHash=sha256(source);
  const key=sha256(Buffer.from(JSON.stringify({sourceHash,policy:compressionPolicy,encoder:sharp.versions})));
  const cacheImage=path.join(cacheDirectory,key+'.webp'),cacheMetadata=path.join(cacheDirectory,key+'.json');
  let selected,cacheHit=false;
  try{
   const [bytes,json]=await Promise.all([readFile(cacheImage),readFile(cacheMetadata,'utf8')]);
   const metadata=JSON.parse(json);
   if(metadata.digest!==sha256(bytes)||metadata.sourceHash!==sourceHash)throw new Error('Compression cache integrity mismatch');
   if(metadata.quality!==null&&!compressionPolicy.qualities.includes(metadata.quality))throw new Error('Compression cache quality mismatch');
   const metrics=measureImage(master,await decodeImage(bytes));
   if(bytes.length>source.length||metadata.quality!==null&&bytes.length>=source.length*(1-compressionPolicy.minimumSaving))throw new Error('Compression cache size mismatch');
   selected={...metadata,bytes,metrics};cacheHit=true;
  }catch{
   // Cache corruption is recoverable. A new encoder result changing dimensions
   // or alpha is fatal and is deliberately not treated as a quality fallback.
   selected=await selectEncoding(source,master);
   const metadata={quality:selected.quality,reason:selected.reason,attempts:selected.attempts,sourceHash,digest:sha256(selected.bytes)};
   await atomicWrite(cacheImage,selected.bytes);await atomicWrite(cacheMetadata,JSON.stringify(metadata));
  }
  await atomicWrite(target,selected.bytes);
  const record={path:name,before:source.length,after:selected.bytes.length,sourceHash,outputHash:sha256(selected.bytes),quality:selected.quality,compressed:selected.quality!==null,reason:selected.reason,cacheHit,...selected.metrics,attempts:selected.attempts};
  completed++;
  if(!quiet)console.log(`[release artwork ${completed}/${names.length}] ${name}: ${record.before} -> ${record.after} bytes; ${record.quality===null?'master retained':'Q'+record.quality}${cacheHit?' (cache)':''}`);
  return record;
 }
 async function worker(){
  while(!failure&&next<names.length){
   const index=next++;
   try{records[index]=await compressImage(names[index]);}catch(error){failure??=error;throw error;}
  }
 }
 const count=Math.max(1,Math.min(4,Number.isInteger(concurrency)?concurrency:4,names.length||1));
 await Promise.allSettled(Array.from({length:count},()=>worker()));
 if(failure)throw failure;
 const before=records.reduce((sum,f)=>sum+f.before,0),after=records.reduce((sum,f)=>sum+f.after,0);
 const report={policy:compressionPolicy,encoder:sharp.versions,files:records,before,after,saved:before-after,compressed:records.filter(f=>f.compressed).length,retained:records.filter(f=>!f.compressed).length};
 await mkdir(path.dirname(reportFile),{recursive:true});await atomicWrite(reportFile,JSON.stringify(report,null,2)+'\n');
 if(!quiet)console.log(`[release artwork] ${records.length} images: ${(before/1048576).toFixed(2)} -> ${(after/1048576).toFixed(2)} MiB; ${report.compressed} compressed, ${report.retained} retained; cache ${records.filter(f=>f.cacheHit).length}/${records.length}`);
 return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await compressReleaseAssets();
