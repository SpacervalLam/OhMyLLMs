import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webpDimensions} from './helpers/webp.mjs';
import {createHash} from 'node:crypto';
import {CEOS,COPY,MODEL_MAP} from '../dist/data.js';
import {makeSpriteAtlas,drawAtlasSprite} from '../dist/sprite-atlas.js';
import {drawEnemyKit} from '../dist/enemy-vfx.js';

const layout=JSON.parse(readFileSync(new URL('../dist/assets/animations/enemies-v1.json',import.meta.url),'utf8'));
const png=id=>readFileSync(new URL(`../dist/assets/animations/${id}.webp`,import.meta.url));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('fifteen new enemies have unique sheets and portraits and never resolve to another sprite',()=>{
 const hashes=new Set(CEOS.filter(c=>!c.variant).map(c=>digest(png(c.id))));
 for(const c of CEOS.filter(c=>c.variant)){
  assert.equal(CEOS[c.index].id,c.id);
  const hash=digest(png(c.id));assert.ok(!hashes.has(hash),`${c.id} reused another sheet`);hashes.add(hash);
  const portrait=readFileSync(new URL(`../dist/${c.portrait}`,import.meta.url));
  const size=webpDimensions(portrait);assert.ok(size.width>50&&size.height>50,c.id);
  assert.ok(layout.characters[c.id].walkFrames,c.id);
 }
 assert.equal(hashes.size,21);
});

test('new enemy walking uses six separately painted walk frames, preserving other states and alpha',()=>{
 for(const c of CEOS.filter(c=>c.variant)){
  const l=layout.characters[c.id],image={naturalWidth:l.width,naturalHeight:l.height};
  const atlas=makeSpriteAtlas(image,l),draws=[];let depth=0,alpha=.7;const stack=[];
  const ctx={get globalAlpha(){return alpha;},set globalAlpha(v){alpha=v;},save(){depth++;stack.push(alpha);},restore(){depth--;alpha=stack.pop();},drawImage(...args){draws.push(args);}};
  for(let frame=0;frame<6;frame++){
   drawAtlasSprite(ctx,atlas,{state:'walk',time:(frame+.1)/8},400,300,88,{opacity:.5});
   assert.deepEqual(draws.at(-1).slice(1,5),Object.values(l.frames[1][frame]).slice(0,4));
  }
  drawAtlasSprite(ctx,atlas,{state:'attack',time:.26},400,300,88);
  assert.deepEqual(draws.at(-1).slice(1,5),Object.values(l.frames[2][3]).slice(0,4));
  drawAtlasSprite(ctx,atlas,{state:'walk',time:12},400,300,88,{reduced:true});
  assert.deepEqual(draws.at(-1).slice(1,5),Object.values(l.frames[1][0]).slice(0,4));
  assert.equal(depth,0);assert.equal(alpha,.7);
 }
});

test('the enemy field guide uses a broader capital visitor title in every language',()=>{
 assert.equal(COPY.zh.enemies,'资本来客');assert.equal(COPY.en.enemies,'CAPITAL VISITORS');assert.equal(COPY.ja.enemies,'資本の来訪者');
 for(const language of ['zh','en','ja'])assert.doesNotMatch(COPY[language].enemies,/ceo/i);
});

test('Pony Ma and Jack Ma carry no improvised character-label badges',()=>{
 for(const type of ['pony','jack']){
  assert.equal(CEOS.find(c=>c.id===type).insignia,undefined);let depth=0;
  drawEnemyKit({save(){depth++;},restore(){depth--;},fillText(){assert.fail('unexpected character label');},roundRect(){assert.fail('unexpected badge plate');}},{type,x:500,y:300},1);
  assert.equal(depth,0);
 }
});

test('no enemy draws a role glyph plate in battle, bosses included',()=>{
 for(const c of CEOS){
  let depth=0;
  for(const state of [{},{boss:true},{boss:true,enraged:true},{mini:true}]){
   drawEnemyKit({save(){depth++;},restore(){depth--;},fillText(){assert.fail(`unexpected glyph for ${c.id}`);},roundRect(){assert.fail(`unexpected plate for ${c.id}`);},stroke(){},beginPath(){},ellipse(){},arc(){},fill(){},set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set globalAlpha(v){},get globalAlpha(){return 1;}},{type:c.id,x:500,y:300,...state},1);
   assert.equal(depth,0,c.id);
  }
 }
});

test('corrected model artwork records its actual community character designers and source works',()=>{
 assert.equal(MODEL_MAP.doubao.artCredit.creator,'ZipZipPipe');assert.match(MODEL_MAP.doubao.artCredit.source,/1236803362705375305/);
 assert.equal(MODEL_MAP.mimo.artCredit.creator,'甶丶');assert.match(MODEL_MAP.mimo.artCredit.source,/1242097128919007239/);
});
