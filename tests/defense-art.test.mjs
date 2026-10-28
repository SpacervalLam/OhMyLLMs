import test from 'node:test';
import assert from 'node:assert/strict';
import {webpDimensions} from './helpers/webp.mjs';
import {characterAtlas} from '../dist/defense-art.js';
test('defense replaces the full animated character and changes back at depletion',()=>{
 const art={animations:{dario:{id:'normal Dario'},jensen:{id:'normal Jensen'},sam:{}},defenseAnimations:{dario:{id:'shield Dario'},jensen:{id:'armored Jensen'}}};
 assert.equal(characterAtlas(art,'dario',{shield:80}),art.defenseAnimations.dario);
 assert.equal(characterAtlas(art,'jensen',{armor:150}),art.defenseAnimations.jensen);
 assert.equal(characterAtlas(art,'dario',{shield:0,armor:150}),art.animations.dario);
 assert.equal(characterAtlas(art,'jensen',{armor:0,shield:80}),art.animations.jensen);
 assert.equal(characterAtlas(art,'sam',{shield:80}),art.animations.sam);
 // Defeat and status-mask rendering keep the matching defended silhouette.
 assert.equal(characterAtlas(art,'jensen',{hp:0,armor:10,animation:{state:'defeat'}}),art.defenseAnimations.jensen);
});
test('missing character variants and non-actor views use the original animation',()=>{
 const art={animations:{dario:{},jensen:{}}};
 assert.equal(characterAtlas(art,'dario',{shield:80}),art.animations.dario);
 assert.equal(characterAtlas(art,'jensen',null),art.animations.jensen);
});


test('both complete shield characters have 30 measured poses inside their PNG bounds',async()=>{
 const {readFileSync}=await import('node:fs');
 const manifest=JSON.parse(readFileSync(new URL('../dist/assets/armor/characters-v1.json',import.meta.url),'utf8'));
 for(const id of ['dario','jensen']){
  const layout=manifest.characters[`${id}-defended-v1`];
  const png=readFileSync(new URL(`../dist/assets/armor/${id}-defended-v1.webp`,import.meta.url));
  assert.deepEqual(webpDimensions(png),{width:layout.width,height:layout.height});
  assert.equal(layout.frames.length,5);assert.ok(layout.referenceHeight>0);
  for(const row of layout.frames){assert.equal(row.length,6);for(const f of row){assert.ok(f.w>0&&f.h>0);assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=layout.width&&f.y+f.h<=layout.height);assert.ok(Number.isFinite(f.anchorX));}}
 }
});
