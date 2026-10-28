import test from 'node:test';
import assert from 'node:assert/strict';
import {CEO_MAP} from '../dist/data.js';
import {GardenGame} from '../dist/engine.js';

function scene(){const g=new GardenGame({starter:false,seed:42});g.start();g.nextWaveTimer=999;return g;}
function arena(row=2,col=5){const g=new GardenGame({starter:false,seed:42});g.tokens=9999;const u=g.plant('qwen',row,col).unit;g.start();g.nextWaveTimer=999;return {g,u};}
function tick(g,seconds){for(let n=0;n<Math.ceil(seconds*100);n++)g.update(.01);}
function enemy(g,type,row=2,x=600){const e=g.spawnEnemy(type,row);e.x=x;return e;}

test('Jack Ma and both bosses stop at range and fire their own physical projectile',()=>{
 for(const [type,kind] of [['jack','parcel'],['ipo','bell'],['overlord','ray']]){
  const {g,u}=arena();
  const foe=enemy(g,type,2,900);foe.attackTimer=0;foe.prospectusTimer=0;
  g.update(.02);
  const shot=g.projectiles.find(p=>p.hostile&&p.kind===kind);
  assert.ok(shot,`${type} should fire ${kind}`);
  assert.equal(shot.side,'enemy');
  const held=foe.x;tick(g,.2);assert.ok(Math.abs(foe.x-held)<1e-9,`${type} should hold position while firing`);
  tick(g,1);assert.ok(u.hp<u.maxHp,`${type} projectile should damage the model`);
 }
});

test('ranged CEOs only fire down their own lane and keep marching without a target',()=>{
 const {g,u}=arena(1);
 const foe=enemy(g,'jack',2,900);foe.attackTimer=0;
 g.update(.02);
 assert.equal(g.projectiles.filter(p=>p.hostile).length,0);
 assert.equal(u.hp,u.maxHp);
 const before=foe.x;tick(g,.2);assert.ok(foe.x<before-1);
});

test('IPO Chairman switches lanes after 220 accumulated damage, respects cooldown and caps at three',()=>{
 const g=scene(),boss=enemy(g,'ipo',2,700);
 g.damageEnemy(boss,220);g.update(.01);
 assert.equal(boss.shift.count,1);assert.notEqual(boss.row,2);assert.equal(boss.invuln,.4);assert.equal(boss.shift.taken,0);
 const hp=boss.hp;
 g.damageEnemy(boss,220);assert.equal(boss.hp,hp,'the short invulnerability window must absorb the next hit');
 tick(g,.5);g.damageEnemy(boss,220);g.update(.01);
 assert.equal(boss.shift.count,1,'the five-second cooldown must hold the second switch back');
 assert.ok(boss.hp<hp);
 for(const count of [2,3]){
  tick(g,5.1);assert.equal(boss.shift.count,count);
  if(count<3){tick(g,.5);g.damageEnemy(boss,220);}
 }
 tick(g,.5);g.damageEnemy(boss,220);tick(g,5.1);
 assert.equal(boss.shift.count,3,'the third switch is the last');
 assert.equal(g.drainEvents().filter(e=>e.type==='laneShift').length,3);
});

test('frozen IPO Chairman neither shifts nor prepares prospectuses',()=>{
 const g=scene(),boss=enemy(g,'ipo',2,700);boss.stun=1;boss.prospectusTimer=17.99;boss.abilityTimer=11.99;
 g.damageEnemy(boss,220);g.update(.5);
 assert.equal(boss.shift.count,0);assert.equal(boss.row,2);
 assert.equal(g.projectiles.filter(p=>p.hostile).length,0);
 assert.equal(g.enemies.filter(e=>e.mini).length,0);
});

test('the listing bell summons, stuns and damages nearby models, and shields nearby capital',()=>{
 const {g,u}=arena();
 const boss=enemy(g,'ipo',2,800);boss.attackTimer=99;boss.prospectusTimer=0;
 const near=enemy(g,'sam',2,750);
 boss.abilityTimer=11.99;g.update(.02);
 assert.equal(g.enemies.filter(e=>e.mini).length,2);
 assert.equal(u.hp,u.maxHp-29);
 assert.ok(u.stun>.4);
 assert.equal(near.shield,60);
});

test('prospectus volley telegraphs three lanes, then damages the model under each landing',()=>{
 const {g,u}=arena();
 const boss=enemy(g,'ipo',2,900);boss.attackTimer=99;boss.prospectusTimer=17.99;
 const hp=u.hp;g.update(.02);
 const papers=g.projectiles.filter(p=>p.hostile&&p.kind==='prospectus');
 assert.equal(papers.length,3);
 assert.equal(g.effects.filter(f=>f.type==='prospectusMark').length,3);
 assert.equal(u.hp,hp,'the paper must not damage before it lands');
 tick(g,1.05);
 assert.equal(u.hp,hp-25);
 assert.equal(g.projectiles.filter(p=>p.hostile).length,0);
});

test('allied bosses fire and ring for the garden side',()=>{
 const g=scene(),boss=g.spawnEnemy('ipo',2,{allied:true}),foe=enemy(g,'sam',2,900);
 boss.x=700;boss.abilityTimer=11.99;boss.attackTimer=0;
 g.update(.02);
 assert.equal(foe.hp,foe.maxHp-29);
 assert.ok(foe.stun>.4);
 const shot=g.projectiles.find(p=>p.hostile);
 assert.ok(shot);assert.equal(shot.side,'ally');assert.ok(shot.vx>0);
});
