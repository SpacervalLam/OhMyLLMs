import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {ANIMATED_CHARACTERS} from '../dist/animation.js';
import {CEOS,MODELS} from '../dist/data.js';
import {APP_VERSION} from '../dist/version.js';
import {webpDimensions} from './helpers/webp.mjs';

test('every shipped raster asset is used by the renderer or field guide, and all are real WebP files',()=>{
 const expected=new Set([
  'models.webp','ceos.webp',
  ...ANIMATED_CHARACTERS.map(id=>`animations/${id}.webp`),
  ...MODELS.map(m=>`portraits/${m.id}.webp`),
  ...CEOS.filter(e=>e.variant).map(e=>`portraits/enemies/${e.id}.webp`),
  'armor/dario-defended-v1.webp','armor/jensen-defended-v1.webp',
  'projectiles/projectiles-v1.webp','effects/glm-frost-field-v1.webp'
 ]);
 const folder=new URL('../dist/assets/',import.meta.url);
 const actual=[];let fileCount=0;
 function walk(url,prefix=''){for(const item of readdirSync(url,{withFileTypes:true})){const name=prefix+item.name;if(item.isDirectory())walk(new URL(item.name+'/',url),name+'/');else{fileCount++;assert.ok(/\.(webp|json|svg)$/.test(name),`Non-final asset: ${name}`);if(name.endsWith('.webp'))actual.push(name);}}}
 walk(folder);assert.deepEqual(new Set(actual),expected);
 for(const name of actual){const data=readFileSync(new URL(name,folder)),size=webpDimensions(data);assert.ok(size.width>0&&size.height>0,name);}
 assert.equal(fileCount,expected.size+5);
});

test('package, game UI, Windows executable and manifest consistently use release version 1.0.0',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 const project=readFileSync(new URL('../desktop/OhMyLLMs.csproj',import.meta.url),'utf8');
 const manifest=readFileSync(new URL('../desktop/app.manifest',import.meta.url),'utf8');
 assert.equal(pkg.version,'1.0.0');assert.equal(APP_VERSION,pkg.version);
 assert.match(project,/<Version>1\.0\.0<\/Version>/);assert.match(project,/<FileVersion>1\.0\.0\.0<\/FileVersion>/);assert.match(project,/<InformationalVersion>1\.0\.0<\/InformationalVersion>/);
 assert.match(manifest,/assemblyIdentity version="1\.0\.0\.0"/);
});
