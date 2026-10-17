import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GardenGame} from '../dist/engine.js';
import {MODELS,CEOS} from '../dist/data.js';
import {ANIMATED_CHARACTERS,ANIMATION_STATES,playAnimation,advanceAnimation,animationFrame,sheetFrameRect} from '../dist/animation.js';
const tick=(game,seconds)=>{for(let n=0;n<Math.ceil(seconds*60);n++)game.update(1/60);};

test('all nine models and six CEOs have a dedicated animation sheet identity',()=>{
 assert.equal(ANIMATED_CHARACTERS.length,15);
 assert.deepEqual(new Set(ANIMATED_CHARACTERS),new Set([...MODELS,...CEOS].map(c=>c.id)));
});
test('loops visit six source columns; attack, hurt and defeat use different rows',()=>{
 for(const [name,definition] of Object.entries(ANIMATION_STATES)){
  const columns=new Set(Array.from({length:6},(_,i)=>animationFrame({state:name,time:(i+.1)/definition.fps}).column));
  assert.equal(columns.size,6,name);
  assert.equal(animationFrame({state:name,time:0}).row,definition.row);
 }
 assert.equal(animationFrame({state:'idle',time:1}).column,0);
 assert.equal(animationFrame({state:'defeat',time:100}).column,5);
});
test('one-shot attack and hit recover to the base pose, while defeat holds its final frame',()=>{
 const actor={};playAnimation(actor,'attack');advanceAnimation(actor,.51,'walk');assert.equal(actor.animation.state,'walk');
 playAnimation(actor,'hurt');advanceAnimation(actor,.41,'idle');assert.equal(actor.animation.state,'idle');
 playAnimation(actor,'defeat');advanceAnimation(actor,3,'idle');assert.equal(actor.animation.state,'defeat');assert.equal(animationFrame(actor.animation).column,5);
});
test('source rectangles cover non-divisible image dimensions without overlapping cells',()=>{
 const w=1244,h=1265;
 for(let row=0;row<5;row++){
  let end=0;
  for(let column=0;column<6;column++){const cell=sheetFrameRect(w,h,{row,column});assert.equal(cell.x,end);end=cell.x+cell.w;assert.ok(cell.h>0);}
  assert.equal(end,w);
 }
 const last=sheetFrameRect(w,h,{row:4,column:5});assert.equal(last.y+last.h,h);
});
test('live combat triggers attack, victim recoil, and a complete defeat departure',()=>{
 const g=new GardenGame({starter:false,lang:'en',seed:4});g.start();g.nextWaveTimer=999;
 const unit=g.plant('chatgpt',1,0).unit,enemy=g.spawnEnemy('sam',1);enemy.x=300;
 g.fire(unit,enemy);assert.equal(unit.animation.state,'attack');
 g.damageEnemy(enemy,10);assert.equal(enemy.animation.state,'hurt');
 g.damageEnemy(enemy,999);assert.equal(g.departures.length,1);assert.equal(g.departures[0].animation.state,'defeat');
 tick(g,.3);assert.ok(animationFrame(g.departures[0].animation).column>=2);
 tick(g,.6);assert.equal(g.departures.length,0);
});
test('pause freezes animation clocks and departure frames exactly',()=>{
 const g=new GardenGame({starter:false,seed:9});g.start();g.nextWaveTimer=999;
 const u=g.plant('deepseek',0,0).unit,e=g.spawnEnemy('sam',0);tick(g,.2);g.damageEnemy(e,999);tick(g,.1);g.pause();
 const before=JSON.stringify({unit:u.animation,departure:g.departures,tick:g.tickTime});
 tick(g,5);assert.equal(JSON.stringify({unit:u.animation,departure:g.departures,tick:g.tickTime}),before);
 g.resume();tick(g,.2);assert.notEqual(u.animation.time,JSON.parse(before).unit.time);
});
test('Claude switches to the dedicated strike row and returns to idle on language change',()=>{
 const g=new GardenGame({starter:false,lang:'zh'}),u=g.plant('claude',0,0).unit;
 tick(g,1.1);assert.equal(u.animation.state,'special');assert.equal(animationFrame(u.animation).row,1);
 g.setLanguage('ja');assert.equal(u.animation.state,'idle');
});
test('support abilities use their drawn action and an enemy stops walking to melee',()=>{
 const g=new GardenGame({starter:false,seed:19});g.start();g.nextWaveTimer=999;const u=g.plant('deepseek',0,0).unit;u.produceTimer=.01;
 tick(g,.02);assert.equal(u.animation.state,'attack');
 const e=g.spawnEnemy('sam',0);assert.equal(e.animation.state,'walk');e.x=u.x+55;
 tick(g,.02);assert.equal(e.animation.state,'attack');assert.equal(u.animation.state,'hurt');
});
test('the last enemy can finish its drawn departure after victory',()=>{
 const g=new GardenGame({starter:false,seed:21});g.start();g.nextWaveTimer=null;g.wave=6;
 const e=g.spawnEnemy('sam',0);g.damageEnemy(e,99999);tick(g,.02);assert.equal(g.phase,'won');assert.equal(g.departures.length,1);
 tick(g,1);assert.equal(g.departures.length,0);
});

test('all shipped sheets contain 30 calibrated source rectangles within their actual PNG dimensions',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../dist/assets/animations/manifest.json',import.meta.url),'utf8'));
 assert.equal(Object.keys(manifest.characters).length,15);
 for(const id of ANIMATED_CHARACTERS){
  const png=readFileSync(new URL(`../dist/assets/animations/${id}.png`,import.meta.url)),layout=manifest.characters[id];
  assert.equal(png.readUInt32BE(16),layout.width,id);assert.equal(png.readUInt32BE(20),layout.height,id);
  assert.equal(layout.frameCount,30);assert.equal(layout.frames.length,5);assert.ok(layout.referenceHeight>0);
  for(const row of layout.frames){assert.equal(row.length,6);for(const frame of row){assert.ok(frame.x>=0&&frame.y>=0&&frame.w>0&&frame.h>0);assert.ok(frame.x+frame.w<=layout.width&&frame.y+frame.h<=layout.height);assert.ok(Number.isFinite(frame.anchorX));}}
 }
});
