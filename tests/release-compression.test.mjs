import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,cp,rm,symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {compressReleaseAssets,measureImage,compressionPolicy} from '../scripts/compress-release-assets.mjs';

function raw(pixels,width=pixels.length/4,height=1){return {data:Buffer.from(pixels),info:{width,height,channels:4}};}
const fixture=raw([220,204,237,255,242,232,245,127,0,0,0,0,45,30,60,255]);

test('compression preserves alpha for opaque, translucent and invisible pixels and never resizes a sheet',()=>{
 assert.equal(measureImage(fixture,fixture).rmse,0);
 for(const alphaOffset of [3,7,11]){const copy=raw(fixture.data);copy.data[alphaOffset]^=1;assert.throws(()=>measureImage(fixture,copy),/alpha changed/);}
 assert.throws(()=>measureImage(fixture,{...fixture,info:{width:2,height:2,channels:4}}),/dimensions changed/);
});

test('palette validation rejects whole-image tint and local lavender/white shifts even when the overall mean is unchanged',()=>{
 const master=raw([200,190,220,255,40,30,50,255]);
 const tinted=raw(master.data);for(let i=0;i<tinted.data.length;i+=4)for(let c=0;c<3;c++)tinted.data[i+c]+=2;
 assert.throws(()=>measureImage(master,tinted),/colour error/);
 const local=raw(master.data);for(let c=0;c<3;c++){local.data[c]+=2;local.data[4+c]-=2;}
 assert.throws(()=>measureImage(master,local),/colour error/);
});

test('balanced high-frequency RGB errors still fail the RMS guard, while bounded changes are accepted',()=>{
 const master=raw([80,70,90,255,80,70,90,255]),bad=raw(master.data),good=raw(master.data);
 for(let c=0;c<3;c++){bad.data[c]+=6;bad.data[4+c]-=6;good.data[c]++;good.data[4+c]--;}
 assert.throws(()=>measureImage(master,bad),/colour error/);assert.equal(measureImage(master,good).rmse,1);
 assert.deepEqual(compressionPolicy.qualities,[90,95,98]);
});

test('release compression is repeatable, never changes masters, revalidates caches and invalidates them on source changes',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'ohmyllms-compression-'));
 t.after(async()=>{const resolved=path.resolve(directory);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep));await rm(resolved,{recursive:true,force:true});});
 const source=path.join(directory,'dist','assets'),output=path.join(directory,'release'),cache=path.join(directory,'cache'),report=path.join(directory,'report.json');
 await mkdir(source,{recursive:true});await mkdir(output);
 const pixels=Buffer.alloc(128*128*4);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const p=(y*128+x)*4;pixels[p]=150+x%64;pixels[p+1]=140+y%64;pixels[p+2]=225;pixels[p+3]=(x+y)%256;}
 const original=await sharp(pixels,{raw:{width:128,height:128,channels:4}}).webp({lossless:true}).toBuffer();
 await writeFile(path.join(source,'sheet.webp'),original);await cp(path.join(source,'sheet.webp'),path.join(output,'sheet.webp'));
 const options={root:directory,outputDirectory:output,cacheDirectory:cache,reportFile:report,quiet:true};
 const first=await compressReleaseAssets(options);assert.equal(first.files.length,1);assert.ok(first.after<=first.before);assert.deepEqual(await readFile(path.join(source,'sheet.webp')),original);
 const selected=await readFile(path.join(output,'sheet.webp'));
 const second=await compressReleaseAssets(options);assert.equal(second.files[0].cacheHit,true);assert.deepEqual(await readFile(path.join(output,'sheet.webp')),selected);
 const cacheImage=(await readdir(cache)).find(f=>f.endsWith('.webp'));await writeFile(path.join(cache,cacheImage),'corrupt');
 const repaired=await compressReleaseAssets(options);assert.equal(repaired.files[0].cacheHit,false);assert.deepEqual(await readFile(path.join(output,'sheet.webp')),selected);
 pixels[3]^=1;const changed=await sharp(pixels,{raw:{width:128,height:128,channels:4}}).webp({lossless:true}).toBuffer();await writeFile(path.join(source,'sheet.webp'),changed);
 const invalidated=await compressReleaseAssets(options);assert.equal(invalidated.files[0].cacheHit,false);assert.notEqual(invalidated.files[0].sourceHash,first.files[0].sourceHash);
 await assert.rejects(compressReleaseAssets({...options,outputDirectory:source}),/separate from master/);
 const alias=path.join(directory,'alias');await symlink(source,alias,process.platform==='win32'?'junction':'dir');
 await assert.rejects(compressReleaseAssets({...options,outputDirectory:alias}),/separate from master/);
});
