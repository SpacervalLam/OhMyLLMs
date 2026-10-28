import test from 'node:test';
import assert from 'node:assert/strict';
import {drawSkillProjectile,drawSkillEffect} from '../dist/skill-vfx.js';

// Same canvas-state machine as render-state.test.mjs: an unbalanced save/restore
// or a leaked alpha is what actually shows up on screen as a washed-out field,
// and no DOM is needed to catch it.
function stub(){
 const state={globalAlpha:1};
 const stack=[];const texts=[];let saves=0;
 const gradient={addColorStop(o){assert.ok(o>=0&&o<=1);}};
 const ctx=new Proxy(state,{
  get(o,key){
   if(key in o)return o[key];
   if(key==='save')return ()=>{stack.push({...o});saves++;};
   if(key==='restore')return ()=>{assert.ok(stack.length>0,'unbalanced restore in skill vfx');Object.assign(o,stack.pop());};
   if(key==='fillText')return text=>{texts.push(String(text));};
   return (...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),`${String(key)}: invalid number`);
    if(String(key).startsWith('create'))return gradient;};
  },
  set(o,key,value){o[key]=value;return true;}
 });
 return {ctx,texts,finish(){assert.equal(stack.length,0,'skill vfx left the canvas in a saved state');
  assert.ok(saves>0,'nothing was drawn');assert.equal(ctx.globalAlpha,1,'alpha leaked out of the effect');}};
}

const strip=dir=>({id:1,model:'minimax',basic:false,row:2,x:400,y:300,targetY:300,dir,age:.2,vx:700,damage:95,stun:.4,hit:[],hitOut:[],hitBack:[],color:'#d98b97',rewind:true});
const frame=(type,leg)=>({type,model:'minimax',x:400,y:300,age:.2,duration:.5,leg,color:'#d98b97'});

test('the outbound strip and the rewound reel both draw with a balanced canvas',()=>{
 for(const dir of [1,-1]){const {ctx,finish}=stub();drawSkillProjectile(ctx,strip(dir),0);finish();}
});

test('the rewind hit and the edge turn draw instead of an explosion',()=>{
 for(const f of [frame('rewindHit','out'),frame('rewindHit','back'),frame('rewindTurn')]){
  const {ctx,finish}=stub();assert.equal(drawSkillEffect(ctx,f,0),true,`${f.type}/${f.leg||'-'} is not rendered`);finish();
 }
});

test('the CUT caption is gone from every MiniMax effect',()=>{
 for(const f of [frame('rewindHit','out'),frame('rewindHit','back'),frame('rewindTurn'),frame('skillImpact'),frame('skillCast')]){
  const {ctx,texts,finish}=stub();drawSkillEffect(ctx,f,0);finish();
  assert.ok(!texts.includes('CUT'),`${f.type}/${f.leg||'-'} still prints the cut caption`);
 }
});
