import {fullSkill} from './helpers/full-skill.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame,BEAM_CAST} from '../dist/engine.js';
import {animationFrame} from '../dist/animation.js';
const tick=(g,s)=>{for(let i=0;i<Math.round(s*100);i++)g.update(.01);};
function scene(){const g=new GardenGame({starter:false,lang:'en'});g.tokens=9999;const u=fullSkill(g.plant('chatgpt',2,0).unit);g.start();g.nextWaveTimer=999;const e=g.spawnEnemy('sam',2);e.x=500;e.hp=e.maxHp=9999;e.abilityTimer=-999;g.attack(u);u.attackTimer=999;return {g,u,e};}
const inCastWindow=column=>column>=BEAM_CAST.frame-BEAM_CAST.spread&&column<=BEAM_CAST.frame+BEAM_CAST.spread;

test('the caster keeps its cast drawings and every illuminated enemy holds its drawn hit pose',()=>{
 const {g,u,e}=scene();const outside=g.spawnEnemy('sam',1);outside.x=500;
 tick(g,.5);const start=e.x;
 for(let i=0;i<100;i++){
  g.update(.01);assert.ok(u.beam);
  const caster=animationFrame(u.animation);assert.equal(caster.state,'attack');assert.equal(caster.row,2);assert.ok(inCastWindow(caster.column));
  assert.deepEqual(animationFrame(e.animation),{row:3,column:2,state:'hurt'});assert.ok(!outside.beamHit);
 }
 assert.ok(e.x<start,'holding the hit drawing must not stun the enemy');
 tick(g,.5);assert.equal(u.beam,null);assert.equal(u.animation.state,'idle');assert.equal(e.beamHit,false);assert.equal(e.animation.state,'walk');
});

test('the visible channel cycles the cast drawing and its neighbours instead of freezing a frame',()=>{
 const {g,u}=scene();
 tick(g,.46); // the charge is over, the beam is leaving the aperture
 const columns=[];
 for(let i=0;i<72;i++){
  g.update(1/60);assert.ok(u.beam);
  const frame=animationFrame(u.animation);
  assert.equal(frame.state,'attack');assert.equal(frame.row,2);assert.ok(inCastWindow(frame.column));
  columns.push(frame.column);
 }
 assert.deepEqual([...new Set(columns)].sort(),[BEAM_CAST.frame-1,BEAM_CAST.frame,BEAM_CAST.frame+1]);
 assert.ok(columns.filter(c=>c!==columns[0]).length>20,'the cast drawing must actually move during the channel');
 for(let i=1;i<columns.length;i++){
  const step=(columns[i]-columns[i-1]+3)%3;
  assert.ok(step===0||step===1,`cast drawings must advance in order, saw ${columns[i-1]}→${columns[i]}`);
 }
});

test('the wind-up plays at its drawn speed and waits on the cast drawing',()=>{
 const {g,u}=scene();
 const seen=[];
 for(let i=0;i<40;i++){g.update(.01);if(u.beam.charge>0)seen.push(animationFrame(u.animation).column);}
 assert.ok(seen.includes(BEAM_CAST.frame-1),'the charge drawings must still run before the beam fires');
 assert.equal(seen.at(-1),BEAM_CAST.frame);
 assert.ok(seen.every(c=>c<=BEAM_CAST.frame),'the wind-up must not reach the recovery drawings');
});

test('other damage reactions cannot interrupt the visible casting pose',()=>{
 const {g,u}=scene();tick(g,.6);u.animation={state:'hurt',time:0};g.update(.01);
 const frame=animationFrame(u.animation);
 assert.equal(u.animation.state,'attack');assert.ok(inCastWindow(frame.column));
});

test('overlapping beams retain the hit pose until the last channel ends; pause freezes everything',()=>{
 const {g,u,e}=scene();g.pause();g.phase='ready';const v=fullSkill(g.plant('chatgpt',2,1).unit);g.phase='playing';g.attack(v);v.attackTimer=999;
 tick(g,.6);u.beam.fire=.01;v.beam.fire=.6;g.update(.02);assert.equal(u.beam,null);assert.equal(e.animation.state,'hurt');
 g.pause();const snapshot=JSON.stringify([v.beam,v.animation,e.animation]);tick(g,1);assert.equal(JSON.stringify([v.beam,v.animation,e.animation]),snapshot);
 g.resume();tick(g,.65);assert.equal(e.beamHit,false);assert.equal(e.animation.state,'walk');
});

test('battle completion clears channel and pose holds',()=>{
 const {g,u}=scene();tick(g,.6);g.phase='won';g.update(.01);assert.equal(u.beam,null);assert.equal(u.channeling,false);assert.equal(u.animation.state,'idle');
});
