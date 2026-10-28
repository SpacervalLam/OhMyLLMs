import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GardenGame,waveTypes,waveInterval,FIELD} from '../dist/engine.js';
import {MODELS,MODEL_MAP,CEOS,CEO_MAP,LINEUP,CARD_HOTKEYS,MINI_POINTS} from '../dist/data.js';
import {BASIC_ATTACKS,skillDescription,harnessDescription,HARNESSES,harnessOptions,harnessCost} from '../dist/ranks.js';
import {drawSkillProjectile,drawSkillEffect} from '../dist/skill-vfx.js';

function scene(){const g=new GardenGame({starter:false,seed:42,lang:'en'});g.tokens=99999;return g;}
function put(g,model,stars){let u;for(let n=0;n<[0,1,3,7][stars];n++)u=g.plant(model,2,0).unit;u.attackTimer=u.basicTimer=999;return u;}
function battle(g){g.start();g.nextWaveTimer=999;}
function tick(g,s){for(let n=0;n<Math.ceil(s*100);n++)g.update(.01);}
function target(g,type='sam',row=2,x=400){const e=g.spawnEnemy(type,row);e.x=x;e.hp=e.maxHp=10000;e.speed=0;e.abilityTimer=-999;return e;}
function close(a,b){assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);}

test('eleven cards are accessible by unique hotkeys, and all newcomers have their own art and abilities',()=>{
 assert.equal(MODELS.length,11);assert.equal(CARD_HOTKEYS.length,LINEUP.length);assert.equal(new Set(CARD_HOTKEYS).size,11);
 for(const id of ['doubao','mimo']){
  const m=MODEL_MAP[id];assert.equal(MODELS[m.index].id,id);assert.ok(BASIC_ATTACKS[id]);assert.ok(HARNESSES[id]);
  for(const stars of [1,2,3])for(const lang of ['zh','en','ja'])assert.ok(skillDescription(m,stars,lang));
  assert.ok(readFileSync(new URL(`../dist/assets/portraits/${id}.webp`,import.meta.url)).length>1000);
 }
 assert.equal(CEO_MAP.pony.prototype,'Pony Ma');assert.equal(CEO_MAP.jack.prototype,'Jack Ma');
});

test('one-star Doubao and MiMo attack a single enemy without their higher-rank mechanics',()=>{
 for(const id of ['doubao','mimo']){
  const g=scene(),u=put(g,id,1);battle(g);const a=target(g),b=target(g,'sam',2,450);
  g.attack(u);assert.equal(g.projectiles[0].basic,true);assert.equal(g.projectiles[0].chain,0);assert.equal(g.projectiles[0].pierce,0);
  tick(g,1);close(a.maxHp-a.hp,BASIC_ATTACKS[id].damage);assert.equal(b.hp,b.maxHp);
 }
});

test('Doubao bounces to distinct nearby targets, attenuates each hop and respects star count and range',()=>{
 for(const stars of [2,3]){
  const g=scene(),u=put(g,'doubao',stars);battle(g);
  const a=target(g),b=target(g,'sam',2,450),c=target(g,'sam',1,450),far=target(g,'sam',2,900);
  g.attack(u);tick(g,1);
  const damage=stars===3?36:21.6;close(a.maxHp-a.hp,damage);close(b.maxHp-b.hp,damage*.8);
  close(c.maxHp-c.hp,stars===3?damage*.64:0);assert.equal(far.hp,far.maxHp);
  tick(g,1);close(a.maxHp-a.hp,damage);
 }
});

test('Seedance renders a delayed 40% replay of the bounce chain and drops the generic interval bonus',()=>{
 const g=scene(),u=put(g,'doubao',3);battle(g);assert.ok(g.equipHarness(u).ok);
 assert.equal(g.harnessFor(u).variant,'seedance');
 const a=target(g),b=target(g,'sam',2,450),c=target(g,'sam',1,450);
 g.attack(u);
 assert.equal(g.projectiles.length,2);
 const replay=g.projectiles.find(p=>p.replay);assert.ok(replay);
 assert.equal(replay.delay,.6);assert.equal(replay.chain,3);assert.equal(replay.damage,36*.4);
 assert.ok(g.effects.some(f=>f.type==='renderClip'));
 tick(g,1.5);
 close(a.maxHp-a.hp,36+36*.4);
 close(b.maxHp-b.hp,36*.8+36*.4*.8);
 close(c.maxHp-c.hp,36*.64+36*.4*.64);
 assert.equal(g.projectiles.length,0);
 for(const lang of ['zh','en','ja'])assert.ok(harnessDescription('doubao',3,lang).includes('40'));
 u.attackTimer=0;g.update(.01);assert.equal(u.attackTimer,MODEL_MAP.doubao.period);
});

test('TRAE is Doubao\'s coding direction: five bounces at the same price, no replay',()=>{
 const options=harnessOptions(MODEL_MAP.doubao);
 assert.deepEqual(options.map(o=>o.variant),['trae','seedance']);
 assert.equal(harnessCost(MODEL_MAP.doubao),MODEL_MAP.doubao.cost*2);
 for(const lang of ['zh','en','ja'])assert.match(harnessDescription('doubao',3,lang,'trae'),/5|five/);
 const g=scene(),u=put(g,'doubao',3);battle(g);const before=g.tokens;
 assert.ok(g.equipHarness(u,'trae').ok);
 assert.equal(before-g.tokens,harnessCost(MODEL_MAP.doubao));
 assert.equal(g.harnessFor(u).name,'TRAE');assert.equal(g.harnessFor(u).variant,'trae');
 const foes=[400,450,500,550,600].map(x=>target(g,'sam',2,x));
 g.attack(u);
 assert.equal(g.projectiles.length,1);
 assert.equal(g.projectiles[0].chain,5);assert.ok(!g.projectiles[0].replay);
 assert.ok(g.effects.some(f=>f.type==='multiEdit'));
 tick(g,1);
 foes.forEach((e,i)=>close(e.maxHp-e.hp,36*Math.pow(.8,i)));
 u.attackTimer=0;g.update(.01);assert.equal(u.attackTimer,MODEL_MAP.doubao.period);
});

test('MiMo pierces two or three distinct enemies once each without hitting another lane',()=>{
 for(const stars of [2,3]){
  const g=scene(),u=put(g,'mimo',stars);battle(g);
  const foes=[400,500,600,700].map(x=>target(g,'sam',2,x)),other=target(g,'sam',1,500);
  g.attack(u);tick(g,2);
  foes.forEach((e,i)=>close(e.maxHp-e.hp,i<(stars===3?3:2)?stars===3?55:33:0));
  assert.equal(other.hp,other.maxHp);assert.equal(g.projectiles.length,0);
 }
});

test('Pony Ma waits without moving, attacking or granting the former network shield',()=>{
 const g=scene();battle(g);const pony=target(g,'pony'),a=target(g,'sam',2,420),b=target(g,'sam',1,450),c=target(g,'sam',2,550);
 pony.abilityTimer=11;const x=pony.x;g.update(.01);assert.equal(pony.shield,0);assert.equal(a.shield,0);assert.equal(b.shield,0);assert.equal(c.shield,0);
 tick(g,1);assert.equal(pony.x,x);assert.equal(pony.damage,0);assert.equal(g.projectiles.length,0);
});

test('Jack Ma sends bounded mini cargo doubles into valid lanes without recursive summoning',()=>{
 for(const row of [0,2,4]){
  const g=scene();battle(g);const jack=target(g,'jack',row);jack.abilityTimer=15;g.update(.01);
  const minis=g.enemies.filter(e=>e.mini);assert.equal(minis.length,row===2?3:2);
  for(const e of minis){assert.equal(e.type,'jack');assert.ok(e.row>=0&&e.row<FIELD.rows);assert.ok(e.x>=FIELD.x&&e.x<=1080);e.abilityTimer=99;g.updateEnemyKit(e);}
  assert.equal(g.enemies.filter(e=>e.mini).length,minis.length);
 }
});

test('converted Pony Ma never raids the lineup and Jack Ma summons for the allied side',()=>{
 const g=scene(),pony=g.spawnEnemy('pony',2,{allied:true}),ally=g.spawnEnemy('sam',2,{allied:true}),foe=target(g);
 pony.x=ally.x=foe.x=600;pony.abilityTimer=11;g.updateEnemyKit(pony);assert.equal(ally.shield,0);assert.equal(foe.shield,0);assert.equal(pony.raid,undefined);assert.equal(pony.damage,0);
 const jack=g.spawnEnemy('jack',2,{allied:true});jack.abilityTimer=15;g.updateEnemyKit(jack);
 assert.equal(g.allies.filter(e=>e.mini).length,3);assert.equal(g.enemies.filter(e=>e.mini).length,0);
});

test('every defeated enemy awards its listed score exactly once and records per-type totals',()=>{
 const g=scene(),defeatable=CEOS.filter(c=>!c.unbeatable);let expected=0;
 for(const c of defeatable){const e=g.spawnEnemy(c.id,2);g.damageEnemy(e,999999);g.damageEnemy(e,999999);expected+=c.points;assert.equal(g.defeated[c.id].count,1);assert.equal(g.defeated[c.id].points,c.points);}
 const mini=g.spawnEnemy('jack',2,{mini:true});g.damageEnemy(mini,99999);expected+=MINI_POINTS;
 assert.equal(g.score,expected);assert.equal(g.kills,defeatable.length+1);assert.equal(g.defeated.jack.points,CEO_MAP.jack.points+MINI_POINTS);
 const kills=g.drainEvents().filter(e=>e.type==='kill');assert.equal(kills.length,defeatable.length+1);assert.equal(kills.at(-1).score,expected);
 assert.equal(g.effects.filter(f=>f.type==='score').length,defeatable.length+1);
});

test('rescues and friendly attacks award points; a fresh game resets the run ledger',()=>{
 const g=scene();battle(g);const a=g.spawnEnemy('sam',2);a.x=60;g.update(.01);assert.equal(g.score,CEO_MAP.sam.points);
 const ally=g.spawnEnemy('sam',2,{allied:true}),foe=g.spawnEnemy('runner',2);ally.x=400;foe.x=450;foe.hp=1;foe.speed=0;
 g.update(.01);assert.equal(g.score,CEO_MAP.sam.points+CEO_MAP.runner.points);
 const fresh=scene();assert.equal(fresh.score,0);assert.deepEqual(fresh.defeated,{});
});

test('procedural waves stay finite, seeded and bounded while bosses recur indefinitely',()=>{
 for(const difficulty of ['easy','normal','hard']){
  const g=new GardenGame({starter:false,seed:123,difficulty}),same=new GardenGame({starter:false,seed:123,difficulty});
  for(let wave=1;wave<=100;wave++){
   g.queue=[];same.queue=[];g.beginWave();same.beginWave();assert.deepEqual(g.queue,same.queue);
   assert.ok(g.queue.length>0&&g.queue.length<=50);assert.ok(Number.isFinite(g.nextWaveTimer));assert.ok(waveInterval(wave)>=.9);
   assert.ok(g.queue.every(e=>CEO_MAP[e.type]&&Number.isInteger(e.row)&&e.row>=0&&e.row<5));
   const bosses=g.queue.filter(e=>CEO_MAP[e.type].boss);assert.equal(bosses.length,wave%3===0?1:0);
   if(bosses.length)assert.equal(bosses[0].type,['ipo','overlord','pony_super','trump','elon_super'][(wave/3-1)%5]);
  }
 }
 assert.ok(waveTypes(1000,()=>.5).length<=48);
});

test('clearing wave six starts wave seven after a breather, and later deadlines do not stall',()=>{
 const g=scene();battle(g);g.wave=6;g.nextWaveTimer=999;const e=g.spawnEnemy('sam',2);g.damageEnemy(e,99999);g.update(.01);
 assert.equal(g.phase,'playing');assert.ok(g.nextWaveTimer<=10);g.pause();const deadline=g.nextWaveTimer;tick(g,1);assert.equal(g.nextWaveTimer,deadline);g.resume();tick(g,10.1);assert.equal(g.wave,7);
 assert.ok(!g.drainEvents().some(e=>e.type==='win'));
 g.queue=[];g.wave=30;g.beginWave();const deadline31=g.nextWaveTimer;const blocker=target(g);g.enemies=[blocker];g.queue=[];tick(g,deadline31+.2);assert.equal(g.wave,32);assert.ok(g.enemies.includes(blocker));
});

test('new model effects and enemy links draw finite geometry without leaking canvas state',()=>{
 let depth=0;const gradient={addColorStop(){}};
 const c=new Proxy({globalAlpha:1},{get(o,key){if(key in o)return o[key];if(key==='save')return ()=>{depth++;};if(key==='restore')return ()=>{assert.ok(depth>0);depth--;};return (...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),String(key));if(String(key).startsWith('create'))return gradient;};},set(o,k,v){o[k]=v;return true;}});
 for(const model of ['doubao','mimo'])for(const age of [0,.2,.8]){
  drawSkillProjectile(c,{model,x:200,y:300,id:1,age,color:MODEL_MAP[model].color},age);
  for(const type of ['skillCast','skillImpact'])assert.equal(drawSkillEffect(c,{model,type,x:200,y:300,age,duration:1},age),true);
 }
 for(const type of ['chatBounce','networkLink'])assert.equal(drawSkillEffect(c,{type,x:200,y:300,tx:300,ty:400,age:.2,duration:.7},1),true);
 assert.equal(depth,0);
});
