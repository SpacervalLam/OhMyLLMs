import {fullSkill} from './helpers/full-skill.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame} from '../dist/engine.js';
import {drawSkillGround,drawSkillAura,drawSkillProjectile,drawSkillChannels,drawSkillEffect,drawCinematicFreeze,drawHarnesses,drawRankBase,drawUpgrade,drawTimeStop} from '../dist/skill-vfx.js';

function checkedContext(){
 let depth=0,operations=0;
 const gradient={addColorStop(offset){assert.ok(offset>=0&&offset<=1);}};
 const state={globalAlpha:1};
 const c=new Proxy(state, {get(_o,key){
  if(key in state)return state[key];
  if(key==='save')return ()=>{depth++;};
  if(key==='restore')return ()=>{assert.ok(depth>0,'unbalanced restore');depth--;};
  return (...args)=>{operations++;for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),`${key}: invalid number`);
   if(key==='ellipse')assert.ok(args[2]>=0&&args[3]>=0);
   if(key==='arc')assert.ok(args[2]>=0);
   if(key.startsWith('create'))return gradient;
  };
 },set(o,key,value){if(typeof value==='number')assert.ok(Number.isFinite(value),`invalid ${key}`);o[key]=value;return true;}});
 return {c,verify(){assert.equal(depth,0);assert.ok(operations>0);}};
}

test('all nine skill signatures draw finite geometry and restore Canvas state at lifecycle boundaries',()=>{
 for(const age of [0,.01,.35,.79,.999]){
  const {c,verify}=checkedContext();
  for(const model of ['deepseek','kimi','claude','gemini','glm','grok','minimax','qwen']){
   for(const type of ['skillCast','skillImpact'])assert.equal(drawSkillEffect(c,{model,type,x:400,y:300,age,duration:1,radius:140},2),true,model);
   drawSkillAura(c,{model,stars:3,x:400,y:300,id:1,produceTimer:3,flash:.1},2);
  }
  for(const model of ['gemini','grok','minimax'])drawSkillProjectile(c,{model,x:400,y:300,id:4,age},2);
  for(const kind of ['parcel','bell','ray','prospectus'])drawSkillProjectile(c,{hostile:true,kind,model:'ipo',x:400,y:300,row:2,age,color:'#d9b76a'},2);
  drawSkillProjectile(c,{model:'doubao',replay:true,x:400,y:300,id:5,age},2);
  drawSkillEffect(c,{type:'skillGuard',x:400,y:300,age,duration:1},2);
  drawSkillEffect(c,{type:'link',x:400,y:300,tx:500,ty:200,age,duration:1},2);
  drawSkillEffect(c,{type:'linkline',x:400,y:300,ax:400,ay:300,bx:400,by:300,age,duration:1},2);
  const g={sweeps:[{row:2,stars:3,writ:.65,age,marks:[{x:550,y:300},{x:570,y:396}]}],zones:[{x:600,y:300,x0:500,x1:700,y0:252,y1:348,row:2,until:3,age,id:1}],units:[{model:'chatgpt',x:300,y:300,beam:{charge:age<.4?.3:0,fire:.8}},{model:'qwen',x:300,y:400}],enemies:[{hp:1,row:2,x:700}]};
  g.units[0].row=2;drawSkillGround(c,g,2);drawSkillChannels(c,g,2);drawCinematicFreeze(c,{x:600,y:300,stun:.4},2);verify();
 }
});

test('Gemini favors distinct lanes and releases single-target resonance state',()=>{
 const g=new GardenGame({starter:false,lang:'en'});g.tokens=999;g.start();g.nextWaveTimer=999;
 const u=fullSkill(g.plant('gemini',2,0).unit);u.attackTimer=999;
 const a=g.spawnEnemy('sam',2),b=g.spawnEnemy('sam',2),c=g.spawnEnemy('sam',1);a.x=400;b.x=410;c.x=450;
 g.attack(u);assert.deepEqual(new Set(g.projectiles.map(p=>p.targetId)),new Set([a.id,c.id]));
 g.projectiles=[];g.links={};g.enemies=[a];g.attack(u);const p=g.projectiles[0];g.starImpact(p,a);assert.equal(Object.keys(g.links).length,0);
 g.links.expired={ttl:.01,points:[]};g.update(.02);assert.ok(!g.links.expired);
});

test('cast and impact choreography freezes with pause and does not replace damage resolution',()=>{
 const g=new GardenGame({starter:false,lang:'en'});g.tokens=999;g.start();g.nextWaveTimer=999;
 const u=fullSkill(g.plant('grok',2,0).unit),e=g.spawnEnemy('sam',2);e.x=300;u.attackTimer=999;
 g.attack(u);assert.ok(g.effects.some(f=>f.type==='skillCast'&&f.model==='grok'));
 for(let i=0;i<40;i++)g.update(1/60);
 assert.ok(e.hp<e.maxHp);assert.ok(g.effects.some(f=>f.type==='skillImpact'&&f.model==='grok'));
 g.pause();const before=JSON.stringify(g.effects);g.update(.1);assert.equal(JSON.stringify(g.effects),before);
});

test('rank bases, basic attacks, equipment and time-stop VFX keep finite geometry and balance Canvas state',()=>{
 for(const stars of [1,2,3])for(const age of [0,.2,.7,1.24]){
  const {c,verify}=checkedContext();
  const u={id:1,model:'chatgpt',row:2,col:1,x:250,y:344,stars,copies:[0,2,5,7][stars]},h={row:2,col:1,model:'chatgpt',stars,name:'Codex',color:'#a4eedc'};
  drawRankBase(c,u);drawHarnesses(c,{units:[u],harnesses:[h]},age);drawTimeStop(c,{timeStop:.5,enemies:[{x:600,y:344}]});
  for(const type of ['rankUp','merge','codexStop'])assert.equal(drawUpgrade(c,{type,x:250,y:344,age,duration:1.25,color:'#9d91c7',text:String(stars)}),true);
  for(const model of ['deepseek','kimi','chatgpt','qwen','glm','gemini','grok','claude','minimax'])drawSkillProjectile(c,{model,x:300,y:330,color:'#a4eedc',basic:true,age},age);
  verify();
 }
});


test('both ChatGPT beam ranks reach the board edge with distinct channel geometry',()=>{
 const counts=[];
 for(const stars of [2,3])for(const charge of [.2,0]){
  const {c,verify}=checkedContext();const points=[];
  const traced=new Proxy(c,{get(o,key){if(key==='lineTo')return (x,y)=>{points.push([x,y]);o.lineTo(x,y);};return o[key];},set(o,key,v){o[key]=v;return true;}});
  drawSkillChannels(traced,{units:[{model:'chatgpt',stars,x:850,y:350,beam:{charge,fire:1}}],enemies:[],zones:[],sweeps:[]},2);
  verify();assert.ok(points.some(([x])=>x===1120),'beam must reach the full board edge');
  if(charge===0)counts.push(points.length);
 }
 assert.notEqual(counts[0],counts[1]);
});


test('painted frost fields draw centered at half opacity and restore the canvas alpha',()=>{
 const stack=[],draws=[];const c={globalAlpha:.8,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},beginPath(){},rect(){},clip(){},drawImage(...args){draws.push({args,alpha:this.globalAlpha});}};
 const image={},z={x:437,y:344,x0:337,x1:537,y0:296,y1:392,age:.8,until:2,landed:true};
 drawSkillGround(c,{zones:[z],units:[]},1,image);
 assert.equal(draws.length,1);assert.equal(draws[0].alpha,.8*.52);assert.equal(c.globalAlpha,.8);assert.equal(stack.length,0);
 const [img,x,y,w,h]=draws[0].args;assert.equal(img,image);assert.equal(x+w/2,437);assert.equal(y+h/2,344);
 z.landed=false;drawSkillGround(c,{zones:[z],units:[]},1,image);assert.equal(draws.length,1);
});
