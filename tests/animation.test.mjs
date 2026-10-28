import {fullSkill} from './helpers/full-skill.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webpDimensions} from './helpers/webp.mjs';
import {GardenGame} from '../dist/engine.js';
import {MODELS,CEOS} from '../dist/data.js';
import {ANIMATED_CHARACTERS,ANIMATION_STATES,playAnimation,advanceAnimation,animationFrame,sheetFrameRect} from '../dist/animation.js';
import {drawAtlasSprite} from '../dist/sprite-atlas.js';
const tick=(game,seconds)=>{for(let n=0;n<Math.ceil(seconds*60);n++)game.update(1/60);};

test('walking draws the accepted walk pose planted on the baseline and simulates the steps in code',()=>{
 // A transform-aware stand-in for the 2D context: it composes translate with
 // each draw destination, so an offset applied twice cannot slip through.
 const ops=[];const stack=[];let tx=0,ty=0;const landed=[];
 const ctx={globalAlpha:1,
  save(){ops.push(['save']);stack.push([tx,ty]);},
  restore(){ops.push(['restore']);const prev=stack.pop();if(prev){tx=prev[0];ty=prev[1];}},
  translate(x,y){ops.push(['translate',x,y]);tx=x;ty=y;},
  rotate(a){ops.push(['rotate',a]);},
  drawImage(...a){ops.push(['drawImage',...a]);landed.push({x:tx+a[5],y:ty+a[6],w:a[7],h:a[8],feetX:tx,feetY:ty});}};
 const pose=(x,y)=>({x,y,w:20,h:40,anchorX:10});
 const atlas={image:{naturalWidth:120,naturalHeight:200},referenceHeight:40,frames:Array.from({length:5},(_,r)=>Array.from({length:6},(_,c)=>pose(c*20,r*40)))};
 const walkPose={image:{},x:100,y:50,w:200,h:400,anchorX:90,referenceHeight:400};
 atlas.walkPose=walkPose;
 for(let i=0;i<6;i++)drawAtlasSprite(ctx,atlas,{state:'walk',time:(i+.1)/9},100,100,80);
 const draws=ops.filter(o=>o[0]==='drawImage');
 assert.equal(draws.length,6);
 // Every stride pulls the single walk pose from the shared sheet…
 assert.ok(draws.every(d=>d[1]===walkPose.image&&d[2]===100&&d[3]===50&&d[4]===200&&d[5]===400));
 // …scaled by the pose sheet reference height (80/400)…
 assert.ok(draws.every(d=>d[8]===40&&d[9]===80));
 // …with the gait transform owning the placement: the composed landing point
 // keeps the feet on the bobbing baseline and the anchor under x — never at 2×.
 assert.ok(landed.every(p=>Math.abs(p.y+p.h-p.feetY)<1e-9));
 assert.ok(landed.every(p=>Math.abs(p.x+90*.2-p.feetX)<1e-9));
 assert.ok(draws.every(d=>d[6]===-90*.2&&d[7]===-400*.2));
 // …while the simulated gait moves the body: bobbing, swaying and leaning.
 const bobs=ops.filter(o=>o[0]==='translate').map(o=>o[2]);
 const leans=ops.filter(o=>o[0]==='rotate').map(o=>o[1]);
 assert.ok(new Set(bobs).size>1);assert.ok(bobs.every(b=>b<=100));
 assert.ok(new Set(leans).size>1);assert.ok(leans.every(l=>Math.abs(l)<=0.1));
 // Attacks keep their drawn row on the original atlas.
 landed.length=0;ops.length=0;
 drawAtlasSprite(ctx,atlas,{state:'attack',time:0},100,100,80);
 assert.equal(ops.filter(o=>o[0]==='drawImage').at(-1)[3],80);
 // Without the pose sheet the walk falls back to the idle opening picture.
 const bare={image:{naturalWidth:120,naturalHeight:200},referenceHeight:40,frames:atlas.frames};
 ops.length=0;drawAtlasSprite(ctx,bare,{state:'walk',time:1},100,100,80);
 assert.equal(ops.filter(o=>o[0]==='drawImage')[0][3],0);
 // The fallback balances its own gait transform: nothing leaks into the next draw.
 assert.equal(tx,0);assert.equal(ty,0);assert.equal(stack.length,0);
 // Reduced motion freezes the simulation: one still pose, no transforms, and
 // absolute placement because nothing moved the origin.
 ops.length=0;landed.length=0;
 drawAtlasSprite(ctx,atlas,{state:'walk',time:1},100,100,80,{reduced:true});
 assert.equal(ops.filter(o=>o[0]==='translate'||o[0]==='rotate').length,0);
 const still=ops.filter(o=>o[0]==='drawImage')[0];
 assert.equal(still[3],50);
 assert.equal(still[6],100-90*.2);assert.equal(still[7],100-400*.2);
 assert.equal(landed.length,1);
 assert.equal(landed[0].x,100-90*.2);assert.equal(landed[0].y,100-400*.2);
});

test('all models and enemies resolve to thirty-two independent animation sheets',()=>{
 assert.equal(ANIMATED_CHARACTERS.length,32);
 assert.deepEqual(new Set(ANIMATED_CHARACTERS),new Set([...MODELS.map(c=>c.id),...CEOS.map(c=>CEOS[c.index].id)]));
});
test('loops visit six source columns; attack, hurt and defeat use different rows',()=>{
 for(const [name,definition] of Object.entries(ANIMATION_STATES)){
  if(name==='walk'){
   // Walking was reduced to one still frame: the idle opening picture.
   assert.equal(definition.frames,1,name);
   for(let i=0;i<6;i++)assert.equal(animationFrame({state:name,time:(i+.1)/definition.fps}).column,0,name);
  }else{
   const columns=new Set(Array.from({length:6},(_,i)=>animationFrame({state:name,time:(i+.1)/definition.fps}).column));
   assert.equal(columns.size,6,name);
  }
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
 const unit=fullSkill(g.plant('chatgpt',1,0).unit),enemy=g.spawnEnemy('sam',1);enemy.x=300;
 g.fire(unit,enemy);assert.equal(unit.animation.state,'attack');
 g.damageEnemy(enemy,10);assert.equal(enemy.animation.state,'hurt');
 g.damageEnemy(enemy,999);assert.equal(g.departures.length,1);assert.equal(g.departures[0].animation.state,'defeat');
 tick(g,.3);assert.ok(animationFrame(g.departures[0].animation).column>=2);
 tick(g,.6);assert.equal(g.departures.length,0);
});
test('pause freezes animation clocks and departure frames exactly',()=>{
 const g=new GardenGame({starter:false,seed:9});g.start();g.nextWaveTimer=999;
 const u=fullSkill(g.plant('deepseek',0,0).unit),e=g.spawnEnemy('sam',0);tick(g,.2);g.damageEnemy(e,999);tick(g,.1);g.pause();
 const before=JSON.stringify({unit:u.animation,departure:g.departures,tick:g.tickTime});
 tick(g,5);assert.equal(JSON.stringify({unit:u.animation,departure:g.departures,tick:g.tickTime}),before);
 g.resume();tick(g,.2);assert.notEqual(u.animation.time,JSON.parse(before).unit.time);
});
test('Claude switches to the dedicated strike row and returns to idle on language change',()=>{
 const g=new GardenGame({starter:false,lang:'zh'}),u=fullSkill(g.plant('claude',0,0).unit);
 tick(g,1.1);assert.equal(u.animation.state,'special');assert.equal(animationFrame(u.animation).row,1);
 g.setLanguage('ja');assert.equal(u.animation.state,'idle');
});
test('support abilities use their drawn action and an enemy stops walking to melee',()=>{
 const g=new GardenGame({starter:false,seed:19});g.start();g.nextWaveTimer=999;const u=fullSkill(g.plant('deepseek',0,0).unit);u.produceTimer=.01;
 tick(g,.02);assert.equal(u.animation.state,'attack');
 const e=g.spawnEnemy('sam',0);assert.equal(e.animation.state,'walk');e.x=u.x+55;
 tick(g,.02);assert.equal(e.animation.state,'attack');assert.equal(u.animation.state,'hurt');
});
test('the last enemy can finish its drawn departure during an endless wave breather',()=>{
 const g=new GardenGame({starter:false,seed:21});g.start();g.nextWaveTimer=null;g.wave=6;
 const e=g.spawnEnemy('sam',0);g.damageEnemy(e,99999);tick(g,.02);assert.equal(g.phase,'playing');assert.equal(g.departures.length,1);assert.ok(g.nextWaveTimer<=10);
 tick(g,1);assert.equal(g.departures.length,0);
});

test('all shipped sheets contain 30 calibrated source rectangles within their actual PNG dimensions',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../dist/assets/animations/manifest.json',import.meta.url),'utf8'));
 const enemies=JSON.parse(readFileSync(new URL('../dist/assets/animations/enemies-v1.json',import.meta.url),'utf8'));
 Object.assign(manifest.characters,enemies.characters);
 assert.equal(Object.keys(manifest.characters).length,32);
 for(const id of ANIMATED_CHARACTERS){
  const png=readFileSync(new URL(`../dist/assets/animations/${id}.webp`,import.meta.url)),layout=manifest.characters[id];
  assert.deepEqual(webpDimensions(png),{width:layout.width,height:layout.height},id);
  assert.equal(layout.frameCount,30);assert.equal(layout.frames.length,5);assert.ok(layout.referenceHeight>0);
  for(const row of layout.frames){assert.equal(row.length,6);for(const frame of row){assert.ok(frame.x>=0&&frame.y>=0&&frame.w>0&&frame.h>0);assert.ok(frame.x+frame.w<=layout.width&&frame.y+frame.h<=layout.height);assert.ok(Number.isFinite(frame.anchorX));}}
 }
});

test('the accepted walk-pose sheet indexes six CEOs inside the actual PNG dimensions',()=>{
 const base=new URL('../dist/assets/animations/walk/ceos-walk',import.meta.url);
 const png=readFileSync(new URL('../dist/assets/ceos.webp',import.meta.url));
 const layout=JSON.parse(readFileSync(new URL(`${base.href}.json`),'utf8'));
 assert.deepEqual(webpDimensions(png),{width:layout.width,height:layout.height});
 assert.ok(layout.referenceHeight>0);
 assert.deepEqual(Object.keys(layout.characters).sort(),CEOS.filter(c=>!c.variant).map(c=>c.id).sort());
 for(const [id,pose] of Object.entries(layout.characters)){
  assert.ok(pose.w>0&&pose.h>0,id);
  assert.ok(pose.x>=0&&pose.y>=0&&pose.x+pose.w<=layout.width&&pose.y+pose.h<=layout.height,id);
  assert.ok(pose.anchorX>=0&&pose.anchorX<=pose.w,id);
  assert.ok(Math.abs(pose.h-layout.referenceHeight)<=10,`${id} shares one scale`);
 }
});

test('a moving CEO advances with the simulated walk clock over the static pose',()=>{
 const g=new GardenGame({starter:false,seed:31});g.start();g.nextWaveTimer=999;
 const e=g.spawnEnemy('sam',0),x0=e.x;
 assert.equal(e.animation.state,'walk');
 tick(g,.5);
 assert.ok(e.x<x0,'the CEO keeps walking down the lane');
 assert.equal(animationFrame(e.animation).row,0);
 assert.equal(animationFrame(e.animation).column,0);
 assert.ok(e.animation.time>0,'the walk clock drives the simulated gait');
});
