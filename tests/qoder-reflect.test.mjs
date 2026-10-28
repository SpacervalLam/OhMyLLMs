import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame} from '../dist/engine.js';
import {skillDescription} from '../dist/ranks.js';
import {MODEL_MAP} from '../dist/data.js';

function setup(equipped=true){
 const g=new GardenGame({starter:false,seed:42});g.tokens=99999;let q;
 for(let n=0;n<7;n++)q=g.plant('qwen',2,2).unit;
 if(equipped)g.equipHarness(q);
 return {g,q};
}
function enemy(g,row,x){const e=g.spawnEnemy('sam',row);e.x=x;e.hp=e.maxHp=1000;return e;}

test('Qoder reflects 8% to only the nearest enemy within one tile',()=>{
 const {g,q}=setup();const near=enemy(g,2,q.x+40),far=enemy(g,2,q.x+90),adjacent=enemy(g,1,q.x);
 g.damageUnit(q,100);assert.equal(q.maxHp-q.hp,100);
 assert.equal(near.hp,992);assert.equal(far.hp,1000);assert.equal(adjacent.hp,1000);
});

test('Qoder excludes distant enemies and requires equipped Harness',()=>{
 for(const equipped of [false,true]){
  const {g,q}=setup(equipped);const e=enemy(g,2,q.x+101);g.damageUnit(q,100);assert.equal(e.hp,1000);
  e.x=q.x+40;g.damageUnit(q,100);assert.equal(e.hp,equipped?992:1000);
 }
});

test('Qoder reflects lethal actual HP loss and respects target armor',()=>{
 const {g,q}=setup();q.hp=50;const e=enemy(g,2,q.x+40);e.armor=10;
 g.damageUnit(q,1000);assert.equal(q.hp,-950);assert.equal(e.armor,6);assert.equal(e.hp,1000);
});

test('Qoder works through real melee damage and preserves the normal skill period',()=>{
 const {g,q}=setup();g.start();g.nextWaveTimer=999;q.attackTimer=q.basicTimer=999;q.produceTimer=.001;
 const e=enemy(g,2,q.x+40);e.speed=0;e.damage=25;e.attackTimer=0;
 g.update(.01);assert.equal(e.hp,998);assert.equal(q.produceTimer,6);
});

test('Qwen guide names the full-rank armor reduction without redundant attack labels',()=>{
 const text=skillDescription(MODEL_MAP.qwen,3,'zh');assert.ok(text.includes('30 点 GPU 护甲'));
 assert.ok(!text.includes('近战'));assert.ok(!text.includes('不发射子弹'));
});
