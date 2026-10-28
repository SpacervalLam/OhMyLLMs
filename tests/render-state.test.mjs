import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GardenRenderer} from '../dist/renderer.js';
import {GardenGame} from '../dist/engine.js';

// A renderer stub with a real canvas-state machine: the burn mask swaps this.ctx
// for an offscreen context, so an unbalanced save/restore or a leaked
// globalAlpha washes out everything drawn afterwards — which reads on screen as
// the whole field turning pale. Nothing here needs a DOM.
function stub(){
 const state={globalAlpha:1,globalCompositeOperation:'source-over'};
 const stack=[];let saves=0;
 const gradient={addColorStop(o){assert.ok(o>=0&&o<=1);}};
 const ctx=new Proxy(state,{
  get(o,key){
   if(key in o)return o[key];
   if(key==='save')return ()=>{stack.push({...o});saves++;};
   if(key==='restore')return ()=>{assert.ok(stack.length>0,'unbalanced restore: the mask swapped contexts');Object.assign(o,stack.pop());};
   return (...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),`${String(key)}: invalid number`);
    if(key==='arc'||key==='ellipse'){
     assert.ok(args[2]>=0,`${String(key)}: negative radius`);
     if(key==='ellipse')assert.ok(args[3]>=0,'ellipse: negative radius');
    }
    if(String(key).startsWith('create'))return gradient;};
  },
  set(o,key,value){o[key]=value;return true;}
 });
 const canvas={width:128,height:128,getContext:()=>ctx};
 const r=Object.create(GardenRenderer.prototype);
 r.ctx=ctx;r.maskCanvas=canvas;r.reduced=false;r.animationTime=1;
 // The real sprite() would need loaded artwork; the mask only needs a silhouette.
 r.sprite=()=>true;
 return {r,ctx,state,finish(alpha=1){assert.equal(stack.length,0,'renderer left the canvas in a saved state');assert.ok(saves>=2);
  assert.equal(ctx.globalAlpha,alpha,'canvas alpha leaked out of a status mask');}};
}

test('the burn mask leaves the canvas state exactly as it found it',()=>{
 const {r,finish}=stub();
 r.burning({id:3,x:400,y:300,burn:{remaining:2.4,tick:.5},hp:10},3,88,1.2);
 finish();
});

test('the freeze mask leaves the canvas state exactly as it found it',()=>{
 const {r,finish}=stub();
 r.frozen({id:6,x:400,y:300,slow:2.5,hp:10},3,88,1.2);
 finish();
});

test('a faded freeze puts back exactly the alpha it found',()=>{
 const {r,ctx,finish}=stub();
 ctx.globalAlpha=.9;
 r.frozen({id:7,x:400,y:300,slow:.05,hp:10},3,88,4.4);
 finish(.9);
 assert.equal(ctx.globalAlpha,.9);
});

test('a faded burn puts back exactly the alpha it found',()=>{
 const {r,ctx,finish}=stub();
 ctx.globalAlpha=.9;
 r.burning({id:2,x:400,y:300,burn:{remaining:.02,tick:.5},hp:10},3,88,4.4);
 finish(.9);
 assert.equal(ctx.globalAlpha,.9);
});

test('the burn mask never runs once the status is over',()=>{
 const {r,state}=stub();
 r.burning({id:4,x:400,y:300,hp:10},3,88,1);
 r.burning({id:5,x:400,y:300,burn:{remaining:0,tick:.5},hp:0},3,88,1);
 assert.equal(state.globalAlpha,1);
});

test('a slowed CEO always carries the status coat, even when it is nearly over',()=>{
 const source=readFileSync(new URL('../dist/renderer.js',import.meta.url),'utf8');
 assert.match(source,/this\.frozen\(v,c\.index/,'reduced-motion and normal drawing must both run the freeze mask');
 const {r,ctx}=stub();
 r.frozen({id:8,x:400,y:300,slow:.01,hp:10},3,88,2);
 assert.equal(ctx.globalAlpha,1);
});

test('no canvas filter survives in the render path: filters can whiten a whole GPU frame',()=>{
 for(const file of ['../dist/renderer.js','../dist/skill-vfx.js']){
  const source=readFileSync(new URL(file,import.meta.url),'utf8');
  assert.doesNotMatch(source.replace(/\/\/.*$/gm,''),/\.filter\s*=/,`${file} sets ctx.filter again`);
 }
});

test('bell, lane-swap, prospectus and stun effects restore canvas state',()=>{
 const {r,finish}=stub();
 for(const type of ['bellWave','laneShift','prospectusMark','stun','renderClip','multiEdit']){
  r.effect({type,x:400,y:300,age:.4,duration:1,color:'#d9b76a'},1.2);
 }
 finish();
});

test('IPO bell renders from its first frame through phase two without invalid canvas radii',()=>{
 for(const phaseTwo of [false,true]){
  const g=new GardenGame({starter:false,seed:42});g.start();g.nextWaveTimer=999;
  const boss=g.spawnEnemy('ipo',2);boss.x=800;
  boss.hp=boss.maxHp*(phaseTwo?.5:1);boss.abilityTimer=phaseTwo?8:12;
  const {r,finish}=stub();
  g.update(1/60);
  assert.equal(boss.enraged,phaseTwo);
  assert.equal(g.enemies.filter(e=>e.mini).length,2);
  assert.ok(g.effects.some(f=>f.type==='bellWave'&&f.age===0));
  for(let frame=0;frame<60;frame++){
   for(const effect of g.effects)r.effect(effect,g.time);
   g.update(1/60);
  }
  assert.ok(!g.effects.some(f=>f.type==='bellWave'));
  assert.equal(g.phase,'playing');
  finish();
 }
});
