import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync,readFileSync,rmSync,realpathSync,readdirSync,copyFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const project = path.join(root, 'desktop', 'OhMyLLMs.csproj');
const output = path.join(root, 'artifacts', 'desktop', 'OhMyLLMs');
const action = process.argv[2] || 'dev';
const version=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')).version;
if (process.platform !== 'win32') throw new Error('The desktop host currently targets Windows. Use npm run dev:web for browser development.');
if (!['dev', 'build', 'package', 'smoke'].includes(action)) throw new Error(`Unknown desktop action: ${action}`);

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

if (action === 'dev') {
  await run('dotnet', ['run', '--project', project, '--', '--dev']);
} else {
  const {compressReleaseAssets}=await import('./compress-release-assets.mjs');
  // A publish must never retain obsolete game assets from an earlier version.
  const relative=path.relative(realpathSync(root),existsSync(output)?realpathSync(output):output);
  if(relative.startsWith('..')||path.isAbsolute(relative)||relative!==path.join('artifacts','desktop','OhMyLLMs'))throw new Error('Unsafe publish output path.');
  rmSync(output,{recursive:true,force:true});
  await run('dotnet', ['publish', project, '-c', 'Release', '-r', 'win-x64', '--self-contained', 'true',
    '-p:DebugType=None', '-p:DebugSymbols=false', '-o', output]);
  const executable = path.join(output, 'OhMyLLMs.exe');
  if (!existsSync(executable)) throw new Error('The desktop executable was not produced.');
  const packages=process.env.NUGET_PACKAGES||path.join(os.homedir(),'.nuget','packages');
  const runtime=JSON.parse(readFileSync(path.join(output,'OhMyLLMs.runtimeconfig.json'),'utf8')).runtimeOptions;
  const notices=(id,packageVersion)=>{
    const directory=path.join(packages,id,packageVersion);
    const files=readdirSync(directory).filter(file=>/^(LICENSE(?:\.TXT)?|THIRD-PARTY-NOTICES\.TXT|NOTICE\.TXT)$/i.test(file));
    if(!files.length)throw new Error(`Missing dependency license: ${id}`);
    const destination=path.join(output,'licenses',id);mkdirSync(destination,{recursive:true});
    for(const file of files)copyFileSync(path.join(directory,file),path.join(destination,file));
  };
  for(const framework of runtime.includedFrameworks)notices(`${framework.name.toLowerCase()}.runtime.win-x64`,framework.version);
  const webviewVersion=readFileSync(project,'utf8').match(/Include="Microsoft.Web.WebView2" Version="([^"]+)"/)[1];
  notices('microsoft.web.webview2',webviewVersion);
  await compressReleaseAssets({root});
  writeFileSync(path.join(output, 'README.txt'), [
    `Oh My LLMs ${version} — Windows desktop edition`, '',
    'Double-click OhMyLLMs.exe. Keep the game folder and DLL files next to it.',
    'Windows 10/11 x64. The .NET runtime is included.',
    'The full Setup installer also includes the offline Microsoft Edge WebView2 installer.',
    'All game assets are local. No Node.js, local server or browser window is needed.',
    'F11: fullscreen. Esc: leave fullscreen when no dialog is open.',
    'Window placement and local preferences: %LOCALAPPDATA%\\OhMyLLMs.', '',
    'This is a noncommercial fan work. See game/ASSET_CREDITS.md and game/LICENSE.md.',
  ].join('\r\n'));
  console.log(`Desktop: ${executable}`);
  if (action === 'smoke') {
    const report = process.env.OHMYLLMS_SMOKE_DIR||path.join(os.homedir(),'.codex','documents','OhMyLLMs','desktop-smoke');
    mkdirSync(report, { recursive: true });
    await run(executable, ['--smoke-test', report]);
    console.log(`Desktop smoke report: ${path.join(report, 'report.json')}`);
  }
  if (action === 'package') {
    // Paths travel as environment variables instead of being interpolated into PowerShell code.
    process.env.OHMYLLMS_PACKAGE_SOURCE = output;
    const releases=path.join(root,'artifacts','releases',version);mkdirSync(releases,{recursive:true});
    process.env.OHMYLLMS_PACKAGE_ZIP = path.join(releases, `OhMyLLMs-${version}-Windows-x64.zip`);
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Compress-Archive -LiteralPath $env:OHMYLLMS_PACKAGE_SOURCE -DestinationPath $env:OHMYLLMS_PACKAGE_ZIP -Force']);
    console.log(`Package: ${process.env.OHMYLLMS_PACKAGE_ZIP}`);
  }
}
