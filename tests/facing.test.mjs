import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame,canFace,facingOf,aheadOf} from '../dist/engine.js';
import {MODELS,MODEL_MAP} from '../dist/data.js';
import {GardenRenderer} from '../dist/renderer.js';
import {drawSkillChannels} from '../dist/skill-vfx.js';

const COPIES=[0,1,3,7];
const tick=(g,seconds)=>{for(let n=0;n<Math.round(seconds*100);n++)g.update(.01);};

// 备战期布阵：此时 plant() 不产生冷却，才叠得出三星。
function arena(lines){
 const g=new GardenGame({starter:false,lang:'en',eggs:false,seed:17,presidentMode:true});
 const units=lines.map(([model,stars,row,col])=>{
  let u=null;
  for(let n=0;n<COPIES[stars];n++)u=g.plant(model,row,col).unit;
  return u;
 });
 g.start();g.nextWaveTimer=99999;
 return {g,units};
}

test('only two-star attackers may turn; producers and healers have no front to flip',()=>{
 for(const model of MODELS){
  const expected=model.verb==='attack';
  const {g,units}=arena([[model.id,2,2,4]]);
  assert.equal(canFace(units[0]),expected,`${model.id} at two stars`);
  assert.equal(g.flipFacing(2,4).ok,expected,`${model.id} flip at two stars`);
  const one=arena([[model.id,1,2,4]]);
  assert.equal(canFace(one.units[0]),false,`${model.id} at one star`);
  assert.deepEqual(one.g.flipFacing(2,4),{ok:false,reason:expected?'requiresTwoStars':'requiresTwoStars'});
 }
});

test('the turn is a toggle: it flips back, announces itself and ignores empty tiles',()=>{
 const {g,units}=arena([['claude',3,2,4]]),u=units[0];
 assert.equal(facingOf(u),1);
 g.drainEvents();
 assert.deepEqual(g.flipFacing(2,4),{ok:true,facing:-1});
 assert.equal(facingOf(u),-1);
 assert.equal(g.drainEvents().filter(e=>e.type==='flipFacing').length,1);
 assert.deepEqual(g.flipFacing(2,4),{ok:true,facing:1});
 assert.equal(facingOf(u),1);
 assert.deepEqual(g.flipFacing(0,0),{ok:false,reason:'empty'});
});

test('turning is refused while monopoly locks input and once the run is over',()=>{
 const {g,units}=arena([['claude',3,2,4]]);
 g.monopolyRemaining=5;
 assert.deepEqual(g.flipFacing(2,4),{ok:false,reason:'monopoly'});
 assert.equal(facingOf(units[0]),1);
 g.monopolyRemaining=0;g.phase='lost';
 assert.deepEqual(g.flipFacing(2,4),{ok:false,reason:'notPlaying'});
});

// 每一位有方向感的攻击位都要在两个朝向下各打一侧，而不是「默认向右、偶尔补丁」。
const DIRECTED=[['doubao',3],['mimo',3],['grok',3],['chatgpt',3],['claude',3],['gemini',3],['glm',3]];

test('a turned attacker covers exactly the side it now faces',()=>{
 for(const [model,stars] of DIRECTED){
  for(const turn of [false,true]){
   const {g,units}=arena([[model,stars,2,4]]),u=units[0];
   const gainer=()=>{const e=g.spawnEnemy('sam',2);e.speed=0;e.hp=e.maxHp=99999;return e;};
   const right=gainer(),left=gainer();
   right.x=780;left.x=320;
   if(turn)assert.deepEqual(g.flipFacing(2,4),{ok:true,facing:-1});
   u.produceTimer=999;u.attackTimer=.01;u.basicTimer=.01;
   tick(g,3);
   const hitRight=99999-right.hp,hitLeft=99999-left.hp;
   if(turn)assert.ok(hitLeft>0&&hitRight===0,`${model} turned: right=${hitRight} left=${hitLeft}`);
   else assert.ok(hitRight>0&&hitLeft===0,`${model} facing right: right=${hitRight} left=${hitLeft}`);
  }
 }
});

test('projectiles leave from the facing side and carry its sign',()=>{
 const {g,units}=arena([['mimo',3,2,4]]),u=units[0];
 const behind=g.spawnEnemy('sam',2);behind.x=300;behind.speed=0;behind.hp=behind.maxHp=9999;
 assert.equal(g.attack(u),false,'nothing is in front while she still faces the entrance');
 g.flipFacing(2,4);
 assert.equal(g.attack(u),true);
 const shot=g.projectiles.find(p=>!p.hostile);
 assert.ok(shot);
 assert.ok(shot.vx<0,'a turned model fires leftward');
 assert.ok(shot.x<u.x,'the muzzle sits on the side it faces');
});

test('a hit that walks past a landed raider is now answerable from the back row',()=>{
 const raid=flip=>{
  const g=new GardenGame({starter:false,lang:'en',eggs:false,seed:5,presidentMode:true});
  for(let n=0;n<7;n++)g.plant('chatgpt',2,4);
  const victim=g.plant('deepseek',2,0).unit;
  for(const u of g.units){u.attackTimer=999;u.basicTimer=999;u.produceTimer=999;}
  g.start();g.nextWaveTimer=99999;
  const pony=g.spawnEnemy('pony',2,{raidTarget:victim});
  tick(g,3.05);
  if(flip)g.flipFacing(2,4);
  for(const u of g.units)if(u.model==='chatgpt'){u.attackTimer=.01;u.basicTimer=.01;}
  const before=pony.hp;tick(g,4.6);
  return before-pony.hp;
 };
 assert.equal(raid(false),0,'facing the entrance, the back row still cannot touch the raider');
 assert.ok(raid(true)>150,'turning around puts the raider in front of the whole lane');
});

test('MiniMax keeps sweeping the whole lane whichever way she is turned',()=>{
 const {g,units}=arena([['minimax',3,2,4]]),u=units[0];
 const gainer=()=>{const e=g.spawnEnemy('sam',2);e.speed=0;e.hp=e.maxHp=99999;return e;};
 const right=gainer(),left=gainer();
 right.x=780;left.x=320;
 g.flipFacing(2,4);
 u.produceTimer=999;u.basicTimer=999;u.attackTimer=.01;
 tick(g,3.2);
 assert.ok(99999-right.hp>0&&99999-left.hp>0,'the strip pays both legs regardless of facing');
});

function recorder(){
 const calls=[],state={globalAlpha:1};
 const ctx=new Proxy(state,{
  get(o,key){
   if(key in o)return o[key];
   return (...args)=>{calls.push({op:String(key),args});};
  },
  set(o,key,value){o[key]=value;return true;}
 });
 return {ctx,calls};
}

test('a turned sprite is mirrored once on top of the sheet orientation it was drawn in',()=>{
 const {ctx,calls}=recorder();
 const r=Object.create(GardenRenderer.prototype);
 r.ctx=ctx;r.art={};r.rects={};r.reduced=false;r.animationTime=0;
 const actor=facing=>({model:'chatgpt',facing,animation:{state:'idle',time:0}});
 const flips=()=>calls.filter(c=>c.op==='scale').length;
 calls.length=0;r.sprite('models',MODEL_MAP.chatgpt.index,400,300,88,0,1,actor(1));
 assert.equal(flips(),0);
 calls.length=0;r.sprite('models',MODEL_MAP.chatgpt.index,400,300,88,0,1,actor(-1));
 assert.equal(flips(),1);
 // Doubao and MiMo are painted facing left already, so turning them cancels out.
 calls.length=0;r.sprite('models',MODEL_MAP.doubao.index,400,300,88,0,1,{model:'doubao',facing:1,animation:{state:'idle',time:0}});
 assert.equal(flips(),1);
 calls.length=0;r.sprite('models',MODEL_MAP.doubao.index,400,300,88,0,1,{model:'doubao',facing:-1,animation:{state:'idle',time:0}});
 assert.equal(flips(),0);
});

test('the turn marker draws on the lawn and leaves the canvas state balanced',()=>{
 const state={globalAlpha:1},stack=[];
 const ctx=new Proxy(state,{
  get(o,key){
   if(key in o)return o[key];
   if(key==='save')return()=>stack.push({...o});
   if(key==='restore')return()=>{assert.ok(stack.length>0,'unbalanced restore in the turn marker');Object.assign(o,stack.pop());};
   return (...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),`${String(key)}: ${a}`);};
  },
  set(o,key,value){o[key]=value;return true;}
 });
 const r=Object.create(GardenRenderer.prototype);r.ctx=ctx;
 r.facingMark(ctx,{x:400,y:300},'#b08a46');
 assert.equal(stack.length,0);
 assert.equal(state.globalAlpha,1);
});

test('front-of-unit is defined once, so every delivery shape agrees on direction',()=>{
 const {units}=arena([['grok',3,2,4]]),u=units[0];
 assert.equal(aheadOf(u)({x:u.x+120,y:u.y,row:2,hp:100}),true);
 assert.equal(aheadOf(u)({x:u.x-120,y:u.y,row:2,hp:100}),false);
 u.facing=-1;
 assert.equal(aheadOf(u)({x:u.x+120,y:u.y,row:2,hp:100}),false);
 assert.equal(aheadOf(u)({x:u.x-120,y:u.y,row:2,hp:100}),true);
});

test('the laser channel is painted on the side the model faces',()=>{
 const extent=facing=>{
  const xs=[],grad={addColorStop(){}};
  const ctx=new Proxy({globalAlpha:1},{
   get(o,key){
    if(key in o)return o[key];
    return (...args)=>{
     if(['moveTo','lineTo','translate'].includes(key))xs.push(...args.filter((v,i)=>i%2===0&&typeof v==='number'));
     if(key.startsWith('create'))return grad;
    };
   },
   set(o,key,value){o[key]=value;return true;}
  });
  drawSkillChannels(ctx,{zones:[],sweeps:[],enemies:[],units:[{x:500,y:344,facing,stars:3,beam:{charge:0,fire:1,castTime:.3}}]},1);
  return {min:Math.min(...xs),max:Math.max(...xs)};
 };
 const right=extent(1),left=extent(-1);
 assert.ok(right.max>1100,'facing the entrance, the channel runs to the right edge');
 assert.ok(left.max<540,'turned, it never reaches past the muzzle on the right');
 assert.ok(left.max>400,'turned, it still spans the lane behind her');
});
