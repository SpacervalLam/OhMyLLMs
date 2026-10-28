import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame} from '../dist/engine.js';
import {CEO_MAP} from '../dist/data.js';
import {ENEMY_CYCLE_WAVES,enemyCycleScale} from '../dist/enemy-scaling.js';
import {castAirstrike,militaryContract} from '../dist/trump-boss.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const scene=()=>new GardenGame({starter:false,lang:'en',eggs:false,seed:42});

test('a full boss rotation is fifteen waves and each completed cycle compounds by 5%',()=>{
 assert.equal(ENEMY_CYCLE_WAVES,15);
 for(const wave of [0,1,3,6,9,12,15])assert.equal(enemyCycleScale(wave),1);
 for(const wave of [16,17,30])close(enemyCycleScale(wave),1.05);
 for(const wave of [31,32,45])close(enemyCycleScale(wave),1.1025);
 close(enemyCycleScale(151),1.05**10);
});

test('all enemy types, including bosses and stationary summons, receive cycle combat stats',()=>{
 for(const type of Object.keys(CEO_MAP)){
  const first=scene().spawnEnemy(type,2),g=scene();g.wave=31;const next=g.spawnEnemy(type,2);
  assert.equal(next.maxHp,Math.round(CEO_MAP[type].hp*1.1025),type);
  for(const stat of ['speed','damage','armor','shield'])close(next[stat],first[stat]*1.1025);
  if(CEO_MAP[type].anchored||type==='pony'||type==='qq_raider')assert.equal(next.speed,0,type);
 }
});

test('difficulty modifiers compose with cycle scaling and mini summons are also strengthened',()=>{
 for(const difficulty of ['easy','normal','hard']){
  const g=new GardenGame({starter:false,difficulty});g.wave=16;const e=g.spawnEnemy('jensen',2);
  assert.equal(e.maxHp,Math.round(CEO_MAP.jensen.hp*({easy:.8,normal:1,hard:1.1}[difficulty])*1.05));
  close(e.damage,CEO_MAP.jensen.damage*1.05);close(e.speed,CEO_MAP.jensen.speed*1.05*(difficulty==='hard'?1.05:1));
  const mini=g.spawnEnemy('jack',0,{mini:true});assert.equal(mini.maxHp,Math.round(70*1.05));close(mini.damage,12*1.05);close(mini.speed,21*1.05);
 }
});

test('crossing a cycle strengthens survivors once, preserving HP percentage and depleted defenses',()=>{
 const g=scene();g.wave=15;const e=g.spawnEnemy('jensen',2);e.hp=e.maxHp*.4;e.armor=40;e.shield=20;e.speed*=1.2;
 g.beginWave();assert.equal(g.wave,16);assert.equal(e.maxHp,Math.round(CEO_MAP.jensen.hp*1.05));close(e.hp/e.maxHp,.4);
 close(e.armor,42);close(e.shield,21);close(e.damage,CEO_MAP.jensen.damage*1.05);close(e.speed,CEO_MAP.jensen.speed*1.2*1.05);
 const before=[e.hp,e.maxHp,e.damage,e.speed,e.armor,e.shield];g.beginWave();assert.deepEqual([e.hp,e.maxHp,e.damage,e.speed,e.armor,e.shield],before);
 g.wave=30;g.beginWave();assert.equal(e.maxHp,Math.round(CEO_MAP.jensen.hp*1.1025));close(e.hp/e.maxHp,.4);close(e.armor,44.1);
});

test('cycle transitions do not strengthen garden units, converted allies or dead enemies',()=>{
 const g=scene();g.tokens=9999;const u=g.plant('qwen',2,0).unit,ally=g.spawnEnemy('sam',1,{allied:true}),dead=g.spawnEnemy('sam',0);dead.hp=0;
 const before={unit:{...u},ally:{...ally},dead:{...dead}};g.wave=15;g.beginWave();assert.deepEqual(u,before.unit);assert.deepEqual(ally,before.ally);assert.deepEqual(dead,before.dead);
});

test('cycle scaling does not reset a retreat, welfare use, pause or fixed positions',()=>{
 const g=scene(),boss=g.spawnEnemy('trump',2);boss.welfareUsed=true;g.damageEnemy(boss,99999,{direct:true});
 const ends=boss.retreat.ends,x=boss.x;g.wave=15;g.beginWave();close(boss.hp/boss.maxHp,.01);assert.equal(boss.retreat.ends,ends);assert.equal(boss.welfareUsed,true);assert.equal(boss.x,x);assert.equal(boss.speed,0);
 g.start();g.pause();const hp=boss.maxHp;g.update(.1);assert.equal(boss.maxHp,hp);
});

test('fixed-damage bombing and military contracts use the same cycle multiplier',()=>{
 const g=scene();g.wave=16;g.tokens=9999;g.plant('qwen',2,0);const boss=g.spawnEnemy('trump',1);castAirstrike(g,boss);
 close(g.airstrikes[0].damage,150*1.05);const military=g.spawnEnemy('military_claude',2);militaryContract(g,military);close(g.militaryWrits[0].damage,45*1.05);
 military.militaryKit={basic:0,contract:999};g.start();g.nextWaveTimer=999;g.update(.01);close(g.projectiles.find(p=>p.kind==='militaryClause').damage,63*1.05);
});

test('enemy shield replenishment and healing retain the cycle bonus instead of reverting to base',()=>{
 const g=scene();g.wave=16;const dario=g.spawnEnemy('dario',0),medic=g.spawnEnemy('medic',2),foe=g.spawnEnemy('sam',2);
 foe.x=medic.x-50;foe.hp-=100;medic.abilityTimer=8;g.updateEnemyKit(medic);assert.equal(foe.maxHp-foe.hp,100-Math.round(45*1.05));
 g.start();g.nextWaveTimer=999;dario.abilityTimer=10;g.update(.01);close(dario.shield,80*1.05);
 const boss=g.spawnEnemy('overlord',4);boss.abilityTimer=10;g.updateEnemyKit(boss);close(boss.shield,160*1.05);
});
