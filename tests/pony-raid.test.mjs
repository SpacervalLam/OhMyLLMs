import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame,FIELD,PONY_RAID,enemyTargetable} from '../dist/engine.js';
import {CEO_MAP} from '../dist/data.js';
import {drawPonyRaid,drawPonyRope,ponyDropOffset} from '../dist/enemy-vfx.js';

function tick(g,seconds){for(let n=0;n<Math.round(seconds*100);n++)g.update(.01);}
function scene(model='chatgpt',stars=1){
 const g=new GardenGame({starter:false,lang:'en',eggs:false,seed:42});g.tokens=99999;
 let u;for(let n=0;n<[0,1,3,7][stars];n++)u=g.plant(model,2,3).unit;
 u.attackTimer=u.basicTimer=u.produceTimer=999;g.start();g.nextWaveTimer=999;
 const e=g.spawnEnemy('pony',0);return {g,u,e};
}

test('Pony Ma locks exactly one living LLM and lands on its tile after three seconds',()=>{
 const {g,u,e}=scene();assert.equal(e.raid.phase,'warning');assert.equal(e.raid.targetId,u.id);
 assert.deepEqual([e.row,e.x,e.y],[u.row,u.x,u.y]);assert.equal(e.damage,0);assert.equal(e.speed,0);
 tick(g,2.99);assert.equal(e.raid.phase,'warning');assert.equal(enemyTargetable(e),false);
 g.update(.01);assert.equal(e.raid.phase,'landed');assert.equal(enemyTargetable(e),true);assert.ok(Math.abs(e.raid.remaining-8)<1e-8);
 assert.equal(g.drainEvents().filter(e=>e.type==='raidLock').length,1);
});

test('warning markers are not physical targets or projectile blockers; landed raiders take damage',()=>{
 const {g,u,e}=scene();const hp=e.hp;
 g.damageEnemy(e,9999);assert.equal(e.hp,hp);assert.equal(g.attack(u),false);
 const foe=g.spawnEnemy('sam',u.row);foe.x=u.x+90;foe.speed=0;const foeHp=foe.hp;
 g.attack(u);tick(g,.4);assert.equal(e.hp,hp);assert.ok(foe.hp<foeHp);
 tick(g,2.6);assert.equal(e.raid.phase,'landed');g.damageEnemy(e,30);assert.equal(e.hp,hp-30);
});

test('the collocated LLM can fire ordinary and skill projectiles into the landed raider',()=>{
 for(const [model,stars] of [['chatgpt',1],['doubao',3],['mimo',3],['grok',3]]){
  const {g,u,e}=scene(model,stars);tick(g,3);e.hp=e.maxHp=10000;
  assert.ok(g.attack(u));tick(g,.15);assert.ok(e.hp<10000,`${model} overshot its own tile`);
  assert.deepEqual([e.x,e.y],[u.x,u.y]);assert.equal(u.hp,u.maxHp);
 }
});

test('the eight-second timer starts on landing, then takes the occupant without a refund or kill reward',()=>{
 const {g,u,e}=scene();const tokens=g.tokens;tick(g,3);tick(g,7.99);
 assert.ok(g.units.includes(u));assert.ok(e.hp>0);assert.equal(u.hp,u.maxHp);assert.equal(g.kills,0);
 g.update(.01);assert.equal(g.units.includes(u),false);assert.equal(g.enemies.includes(e),false);
 assert.equal(g.tokens,tokens);assert.equal(g.kills,0);assert.equal(g.score,0);
 const escape=g.departures.find(d=>d.exit==='rope');assert.equal(escape.carried.id,u.id);assert.equal(escape.raid.phase,'landed');
 assert.equal(g.drainEvents().filter(e=>e.type==='abducted').length,1);
});

test('killing a landed raider saves its victim and awards normal defeat points exactly once',()=>{
 const {g,u,e}=scene();tick(g,3);g.damageEnemy(e,99999);g.damageEnemy(e,99999);tick(g,8.1);
 assert.ok(g.units.includes(u));assert.equal(g.kills,1);assert.equal(g.score,CEO_MAP.pony.points);
 assert.ok(!g.drainEvents().some(e=>e.type==='abducted'));assert.ok(!g.departures.some(d=>d.exit==='rope'));
});

test('a projectile landing on the expiry frame defeats the raider before the theft resolves',()=>{
 const {g,u,e}=scene();tick(g,3);e.raid.remaining=.01;e.hp=1;
 g.projectiles.push({model:'chatgpt',basic:true,x:e.x-35,y:e.y-14,targetY:e.y-14,row:e.row,vx:3000,damage:10,hit:[],age:0,delay:0,color:'#fff'});
 g.update(.01);assert.ok(g.units.includes(u));assert.equal(g.kills,1);assert.ok(!g.drainEvents().some(e=>e.type==='abducted'));
});

test('pause and time stop freeze both warning and theft clocks',()=>{
 const {g,e}=scene();
 for(const land of [false,true]){
  if(land)tick(g,3);
  const before={...e.raid};g.pause();tick(g,2);assert.deepEqual(e.raid,before);g.resume();
  g.timeStop=2;tick(g,1);assert.deepEqual(e.raid,before);g.timeStop=0;
 }
});

test('the rope stays anchored under slow, stun and knockback, but the eight-second deadline remains fixed',()=>{
 const {g,u,e}=scene();tick(g,3);e.slow=20;e.stun=20;
 assert.equal(g.knockback(e,100),false);tick(g,7.99);assert.deepEqual([e.x,e.y],[u.x,u.y]);assert.ok(g.units.includes(u));
 g.update(.01);assert.ok(!g.units.includes(u));
});

test('a shovel or another death leaves an empty fixed tile; a replacement in that tile can be taken',()=>{
 for(const replace of [false,true]){
  const {g,u,e}=scene('deepseek');const x=e.x,y=e.y;g.remove(u.row,u.col);
  let replacement=null;if(replace)replacement=g.plant('mimo',u.row,u.col).unit;
  tick(g,11);assert.deepEqual([e.x,e.y],[x,y]);
  if(replace){assert.ok(!g.units.includes(replacement));assert.equal(g.departures.find(d=>d.exit==='rope').carried.id,replacement.id);}
  else assert.equal(g.departures.find(d=>d.exit==='rope').carried,null);
 }
});

test('abduction removes harnesses without triggering Grok deathrattle or Kimi resurrection',()=>{
 const {g,u,e}=scene('grok',3);g.pause();g.equipHarness(u);g.resume();
 let kimi;g.pause();g.phase='ready';for(let n=0;n<7;n++)kimi=g.plant('kimi',2,2).unit;g.equipHarness(kimi);kimi.produceTimer=999;g.phase='playing';
 tick(g,11);assert.ok(!g.units.includes(u));assert.ok(!g.harnesses.some(h=>h.unitId===u.id));
 assert.ok(!g.projectiles.some(p=>p.deathrattle));assert.equal(g.harnessFor(kimi).timer,0);assert.equal(e.hp,0);
});

test('no LLM means waiting without walking or attacking, then locking when one is deployed',()=>{
 const g=new GardenGame({starter:false,seed:42});g.start();g.nextWaveTimer=999;const e=g.spawnEnemy('pony',1),x=e.x;
 tick(g,4);assert.equal(e.raid.phase,'waiting');assert.equal(e.x,x);assert.equal(g.projectiles.length,0);
 g.tokens=999;const u=g.plant('deepseek',4,8).unit;g.update(.01);assert.equal(e.raid.targetId,u.id);assert.equal(e.raid.phase,'warning');
});

test('contract conversion cancels the raid and a friendly Pony Ma never abducts the lineup',()=>{
 const {g,u,e}=scene('claude',3);g.pause();g.equipHarness(u);g.resume();tick(g,3);
 e.hp=1;g.sweep(u,[e]);g.damageEnemy(e,99999);assert.equal(g.allies.length,1);const ally=g.allies[0];
 assert.equal(ally.raid,null);assert.equal(ally.damage,0);tick(g,12);assert.ok(g.units.includes(u));assert.equal(ally.x,u.x);
});

test('two raiders may share a tile, but an empty tile never steals or duplicates a victim',()=>{
 const {g,u}=scene();g.spawnEnemy('pony',4);tick(g,11);
 assert.equal(g.units.length,0);assert.equal(g.departures.filter(d=>d.exit==='rope').length,2);
 assert.equal(g.departures.filter(d=>d.carried?.id===u.id).length,1);assert.equal(g.drainEvents().filter(e=>e.type==='abducted').length,1);
});

test('raid markers, ropes and descent geometry stay finite and restore canvas state',()=>{
 const {g,e}=scene();let depth=0;const state={globalAlpha:.8},stack=[];
 const ctx=new Proxy(state,{get(o,key){if(key in o)return o[key];if(key==='save')return ()=>{stack.push({...o});depth++;};if(key==='restore')return ()=>{assert.ok(depth>0);Object.assign(o,stack.pop());depth--;};return (...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),String(key));};},set(o,k,v){o[k]=v;return true;}});
 for(const lang of ['zh','en','ja'])drawPonyRaid(ctx,e,1,lang);
 tick(g,3);assert.ok(ponyDropOffset(e)>0);
 for(const elapsed of [0,.2,PONY_RAID.descent,8]){e.raid.elapsed=elapsed;drawPonyRope(ctx,e,ponyDropOffset(e));drawPonyRaid(ctx,e,2,'zh');}
 assert.equal(ponyDropOffset(e),0);assert.equal(depth,0);assert.equal(ctx.globalAlpha,.8);
 assert.ok(e.x>=FIELD.x);
});
