import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame,WAVE_PACING} from '../dist/engine.js';
import {DEEPSEEK_INCOME} from '../dist/ranks.js';

test('opening gives starter income time to arrive and teaches all five lanes before heavy CEOs',()=>{
 const g=new GardenGame({seed:42});g.start();
 for(let n=0;n<80;n++)g.update(.1);
 assert.equal(g.wave,1);assert.ok(g.coins.some(c=>c.value===25&&!c.falling));
 assert.equal(g.enemies[0].row,2);assert.ok(g.enemies[0].x>900);
 const lineup=[...g.enemies,...g.queue];assert.equal(lineup.length,6);
 assert.equal(new Set(lineup.map(e=>e.row)).size,5);
 assert.ok(lineup.every(e=>!['jensen','mark','liang'].includes(e.type)));
 assert.deepEqual(DEEPSEEK_INCOME,[0,25,50,100]);
});

test('waves increase pressure with broad lane coverage and staged specialist introductions',()=>{
 const g=new GardenGame({starter:false,seed:42});let previous=0;
 for(let wave=1;wave<=6;wave++){
  g.queue=[];g.beginWave();assert.ok(g.queue.length>previous);previous=g.queue.length;
  const counts=Array(5).fill(0);for(const e of g.queue)counts[e.row]++;
  assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
  assert.ok(wave<3?!g.queue.some(e=>e.type==='liang'):g.queue.some(e=>e.type==='liang'));
  assert.ok(wave<4?!g.queue.some(e=>e.type==='jensen'):g.queue.some(e=>e.type==='jensen'));
 }
 assert.equal(g.queue.length,24);
 assert.ok(WAVE_PACING.intervals.every((value,i,a)=>i===0||value<a[i-1]));
});

test('stalling a surviving enemy cannot postpone the next economy pressure wave forever',()=>{
 const g=new GardenGame({starter:false,seed:42});g.start();g.beginWave();g.queue=[];
 const e=g.spawnEnemy('sam',0);e.speed=0;e.hp=e.maxHp=1e9;
 for(let n=0;n<670;n++)g.update(.1);
 assert.equal(g.wave,2);assert.ok(g.enemies.includes(e));
});

test('starting another wave preserves queued enemies and pause freezes its deadline',()=>{
 const g=new GardenGame({starter:false,seed:42});g.start();g.beginWave();const pending=[...g.queue];
 g.beginWave();assert.deepEqual(g.queue.slice(0,pending.length),pending);
 const deadline=g.nextWaveTimer;g.pause();g.update(.1);assert.equal(g.nextWaveTimer,deadline);
});

test('enemy attributes stay at base values throughout the first twelve-wave cycle',()=>{
 const g=new GardenGame({starter:false});g.wave=1;const first=g.spawnEnemy('sam',0);
 for(const wave of [2,6,9,12]){g.wave=wave;const last=g.spawnEnemy('sam',0);for(const stat of ['maxHp','speed','damage','armor','shield'])assert.equal(last[stat],first[stat]);}
});
