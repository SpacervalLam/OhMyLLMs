import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame} from '../dist/engine.js';
import {CEO_MAP} from '../dist/data.js';

function scene(equipped=true){
 const g=new GardenGame({starter:false,seed:42});g.tokens=99999;
 let claude;for(let n=0;n<7;n++)claude=g.plant('claude',2,0).unit;
 if(equipped)g.equipHarness(claude);
 g.start();g.nextWaveTimer=999;claude.attackTimer=999;claude.basicTimer=999;
 return {g,claude};
}
function mark(g,claude,type='sam',x=500){const e=g.spawnEnemy(type,2);e.x=x;g.sweep(claude,[e]);return e;}
function tick(g,s){for(let n=0;n<Math.ceil(s*100);n++)g.update(.01);}

test('bosses are never converted by a contract and still pay their bounty',()=>{
 for(const type of ['ipo','overlord']){
  const {g,claude}=scene();const e=mark(g,claude,type);e.shield=0;const tokens=g.tokens;
  g.damageEnemy(e,99999);
  assert.equal(g.allies.length,0,`${type} must not become an ally`);
  assert.ok(g.departures.some(d=>d.id===e.id&&d.kind==='enemy'),`${type} must leave through the normal defeat path`);
  assert.equal(g.harnessFor(claude).timer,0,'a boss kill must not spend the conversion cooldown');
  assert.equal(g.tokens,tokens+(CEO_MAP[type].reward||0));
  assert.equal(g.drainEvents().filter(ev=>ev.type==='bossDefeated').length,1);
 }
});

test('contract converts lethal hits from any source, retaining identity at half strength',()=>{
 const {g,claude}=scene();const e=mark(g,claude,'jensen');e.armor=0;e.burn={remaining:2,tick:.1};
 g.damageEnemy(e,99999);
 const a=g.allies[0];assert.equal(a.type,'jensen');assert.equal(a.hp,Math.ceil(e.maxHp*.5));
 assert.equal(a.damage,Math.round(e.damage*.5));assert.equal(a.speed,e.speed*.5);
 assert.equal(a.armor,75);assert.equal(a.abilityScale,.5);assert.equal(a.burn,null);assert.equal(a.allied,true);assert.equal(g.kills,1);
 assert.ok(!g.departures.some(d=>d.id===e.id));
 const foe=g.spawnEnemy('sam',2);foe.x=550;foe.speed=0;const hp=foe.hp;
 g.update(.01);assert.ok(foe.hp<hp);assert.equal(g.projectiles.length,0);
});

test('contract final verdict can convert, but expired or unequipped contracts cannot',()=>{
 for(const equipped of [false,true]){
  const {g,claude}=scene(equipped);const e=mark(g,claude);e.hp=10;
  tick(g,.66);assert.equal(g.allies.length,equipped?1:0);
 }
 const {g,claude}=scene();const e=mark(g,claude);e.hp=e.maxHp=10000;
 tick(g,.7);g.damageEnemy(e,99999);assert.equal(g.allies.length,0);
});

test('allied Zuckerberg forks allied mini CEOs, which fight and cannot trigger rescue carts',()=>{
 const {g,claude}=scene();const e=mark(g,claude,'mark');g.damageEnemy(e,99999);
 const a=g.allies[0];a.abilityTimer=11.99;
 const foe=g.spawnEnemy('sam',2);foe.x=700;foe.hp=10000;foe.speed=0;
 g.update(.02);
 assert.equal(g.allies.length,3);assert.equal(g.allies.filter(a=>a.mini&&a.allied).length,2);
 assert.equal(g.enemies.filter(e=>e.hp>0&&e.mini).length,0);
 assert.ok(g.mowers.every(Boolean));
 const mini=g.allies.find(a=>a.mini);mini.x=foe.x-40;const hp=foe.hp;g.update(.02);assert.ok(foe.hp<hp);
});

test('allied CEO abilities and armor operate against enemies without harming the lineup',()=>{
 for(const type of ['dario','elon','liang']){
  const {g,claude}=scene();const e=mark(g,claude,type);g.damageEnemy(e,99999);
  const a=g.allies[0];a.abilityTimer=11.99;const tokens=g.tokens;
  g.update(.02);
  if(type==='dario')assert.equal(a.shield,80);
  if(type==='elon')assert.ok(a.boost>0);
  if(type==='liang')assert.equal(g.tokens,tokens+20);
  assert.equal(claude.hp,claude.maxHp);
 }
 const {g,claude}=scene();const e=mark(g,claude,'jensen');g.damageEnemy(e,99999);
 const a=g.allies[0],hp=a.hp;g.damageAlly(a,30);assert.equal(a.hp,hp);assert.equal(a.armor,45);
 g.damageAlly(a,99999);g.update(.01);assert.equal(g.allies.length,0);assert.ok(g.departures.some(d=>d.kind==='ally'));
});

test('friendly CEOs do not prevent wave completion or count as hostile targets',()=>{
 const {g,claude}=scene();g.wave=6;g.nextWaveTimer=null;
 const e=mark(g,claude);g.damageEnemy(e,99999);g.update(.01);
 assert.equal(g.phase,'playing');assert.equal(g.waveCleared,true);assert.ok(g.nextWaveTimer<=10);assert.equal(g.enemies.length,0);assert.equal(g.allies.length,1);
});

test('Claude Code starts a 200s cooldown on conversion, not on casting, and pause freezes it',()=>{
 const {g,claude}=scene();const e=mark(g,claude);
 assert.equal(g.harnessFor(claude).timer,0);
 g.damageEnemy(e,99999);assert.equal(g.harnessFor(claude).timer,200);
 const second=mark(g,claude,'sam',700);g.damageEnemy(second,99999);assert.equal(g.allies.length,1);
 g.pause();tick(g,1);assert.equal(g.harnessFor(claude).timer,200);g.resume();
 tick(g,199);assert.ok(g.harnessFor(claude).timer>0);
 const early=mark(g,claude,'sam',800);g.damageEnemy(early,99999);assert.equal(g.allies.length,1);
 tick(g,1.02);assert.equal(g.harnessFor(claude).timer,0);
 const ready=mark(g,claude,'sam',900);g.damageEnemy(ready,99999);assert.equal(g.allies.length,2);
 assert.equal(g.harnessFor(claude).timer,200);
});
