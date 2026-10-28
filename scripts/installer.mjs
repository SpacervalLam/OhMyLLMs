import {spawn} from 'node:child_process';
import {readFileSync,mkdirSync,existsSync,writeFileSync,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';

if(process.platform!=='win32')throw new Error('The Windows installer must be built on Windows.');
const root=path.resolve(import.meta.dirname,'..');
const version=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')).version;
const output=path.join(root,'artifacts','releases',version);
const toolsDirectory=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'OhMyLLMs','BuildTools');
async function run(file,args){await new Promise((resolve,reject)=>{const child=spawn(file,args,{cwd:root,stdio:'inherit',windowsHide:true});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`${path.basename(file)} exited with ${code}`)));});}
await run(process.execPath,[path.join(root,'scripts','desktop.mjs'),'package']);
await run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'desktop','PrepareInstaller.ps1'),'-ToolsDirectory',toolsDirectory]);
const tools=JSON.parse(readFileSync(path.join(toolsDirectory,'paths.json'),'utf8').replace(/^\uFEFF/,''));
mkdirSync(output,{recursive:true});
await run(tools.compiler,[`/DAppVersion=${version}`,`/DPublishDirectory=${path.join(root,'artifacts','desktop','OhMyLLMs')}`,`/DReleaseDirectory=${output}`,`/DWebViewInstaller=${tools.webview2}`,path.join(root,'desktop','Installer.iss')]);
const names=[`OhMyLLMs-${version}-Setup-x64.exe`,`OhMyLLMs-${version}-Windows-x64.zip`];
const records=[];
for(const name of names){const file=path.join(output,name);if(!existsSync(file))throw new Error(`Missing release file: ${name}`);const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);records.push(`${hash.digest('hex')}  ${name}`);}
writeFileSync(path.join(output,'SHA256SUMS.txt'),records.join('\n')+'\n');
console.log(`Installer and portable release: ${output}`);
