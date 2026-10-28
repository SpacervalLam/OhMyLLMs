import test from 'node:test';
import assert from 'node:assert/strict';
import {CEOS,CEO_MAP,MODELS,localized,enemySkillNames} from '../dist/data.js';
import {GardenGame} from '../dist/engine.js';
import {drawEnemyKit,drawBossBars,enemySize} from '../dist/enemy-vfx.js';

function scene(){const g=new GardenGame({starter:false,seed:42});g.start();g.nextWaveTimer=999;return g;}
function tick(g,seconds){for(let n=0;n<Math.ceil(seconds*100);n++)g.update(.01);}
function enemy(g,type,row=2,x=600){const e=g.spawnEnemy(type,row);e.x=x;return e;}

test('all twenty-one enemies have valid art references and translated role descriptions',()=>{
 assert.equal(CEOS.length,21);assert.equal(new Set(CEOS.map(c=>c.id)).size,21);
 for(const c of CEOS){
  assert.ok(c.hp>0);if(['pony','qq_raider','trump','starlink_drone'].includes(c.id)){assert.equal(c.speed,0);assert.equal(c.damage,0);}else if(c.anchored){assert.equal(c.speed,0);assert.ok(c.damage>0);}else assert.ok(c.speed>0&&c.damage>0);assert.ok(c.index>=0&&c.index<CEOS.length);assert.equal(CEOS[c.index].id,c.id);
  for(const lang of ['zh','en','ja'])assert.ok(localized(c.desc,lang));
  assert.equal(c.title,undefined,`${c.id} should be titled by its own name, not a role label`);
 }
 assert.equal(CEOS.filter(c=>c.boss).length,5);
});

test('every model and enemy has at least one translated skill name',()=>{
 for(const m of MODELS)for(const lang of ['zh','en','ja'])assert.ok(localized(m.skill,lang)?.trim(),`${m.id} ${lang}`);
 for(const c of CEOS){
  const names=enemySkillNames(c);
  assert.ok(names.length>=1,`${c.id} has no named skill`);
  for(const name of names)for(const lang of ['zh','en','ja'])assert.ok(localized(name,lang)?.trim(),`${c.id} ${lang}`);
 }
 assert.equal(enemySkillNames(CEO_MAP.ipo).length,3);
 assert.equal(enemySkillNames(CEO_MAP.overlord).length,2);
 assert.equal(enemySkillNames(CEO_MAP.jack).length,2);
});

test('new troops enter progressively and both bosses survive all difficulty queue adjustments',()=>{
 for(const difficulty of ['easy','normal','hard']){
  const g=new GardenGame({starter:false,seed:42,difficulty});
  for(let wave=1;wave<=6;wave++){
   g.queue=[];g.beginWave();const types=g.queue.map(e=>e.type);
   assert.equal(types.includes('runner'),wave>=2);assert.equal(types.includes('medic'),wave>=2);
   assert.equal(types.includes('bulwark'),wave>=3);assert.equal(types.includes('banner'),wave>=4);
   assert.deepEqual(types.filter(type=>CEO_MAP[type].boss),wave===3?['ipo']:wave===6?['overlord']:[]);
  }
 }
});

test('medics heal nearby troops without healing themselves, distant enemies or player units',()=>{
 const g=scene(),medic=enemy(g,'medic'),near=enemy(g,'sam',1,650),far=enemy(g,'sam',4),distant=enemy(g,'sam',2,900);
 for(const e of [medic,near,far,distant])e.hp-=70;
 g.tokens=999;const u=g.plant('qwen',0,4).unit;u.hp=100;
 medic.abilityTimer=7.99;g.update(.02);
 assert.equal(near.hp,near.maxHp-25);assert.equal(medic.hp,medic.maxHp-70);
 assert.equal(far.hp,far.maxHp-70);assert.equal(distant.hp,distant.maxHp-70);assert.equal(u.hp,100);
 near.hp=near.maxHp-1;medic.abilityTimer=8;g.update(.01);assert.equal(near.hp,near.maxHp);
});

test('escort shields absorb damage, refresh without stacking, and do not revive fallen troops',()=>{
 const g=scene(),escort=enemy(g,'bulwark'),near=enemy(g,'sam',1,650),dead=enemy(g,'sam',3,650);
 assert.equal(escort.shield,60);dead.hp=0;escort.abilityTimer=10;g.update(.01);
 assert.equal(near.shield,60);assert.equal(dead.shield,0);
 const hp=near.hp;g.damageEnemy(near,35);assert.equal(near.hp,hp);assert.equal(near.shield,25);
 escort.abilityTimer=10;g.update(.01);assert.equal(near.shield,60);
 escort.abilityTimer=10;g.update(.01);assert.equal(near.shield,60);
 g.damageEnemy(near,80);assert.equal(near.hp,hp-20);
});

test('command auras speed nearby allies once, and end on death, stun or leaving range',()=>{
 const g=scene(),banner=enemy(g,'banner'),other=enemy(g,'banner',2,640),runner=enemy(g,'runner',1,650);
 assert.equal(g.marchBonus(runner),1.25);assert.equal(g.marchBonus(banner),1.25);
 const start=runner.x;g.update(.1);assert.ok(Math.abs(start-runner.x-runner.speed*1.25*.1)<1e-8);
 other.hp=0;banner.stun=1;assert.equal(g.marchBonus(runner),1);
 banner.stun=0;banner.x=950;assert.equal(g.marchBonus(runner),1);
 banner.x=600;banner.hp=0;assert.equal(g.marchBonus(runner),1);
});

test('chairman summons exactly two bounded mini runners per ability, without recursive summons',()=>{
 for(const row of [0,2,4]){
  const g=scene(),boss=enemy(g,'ipo',row);boss.abilityTimer=12;g.update(.01);
  const recruits=g.enemies.filter(e=>e.mini);assert.equal(recruits.length,2);
  assert.ok(recruits.every(e=>e.type==='runner'&&!e.boss&&e.row>=0&&e.row<5));
  tick(g,1);assert.equal(g.enemies.length,3);
 }
});

test('each boss changes phase only once, and uses the shorter second-phase ability interval',()=>{
 for(const type of ['ipo','overlord']){
  const g=scene(),boss=enemy(g,type);const damage=boss.damage,speed=boss.speed;
  boss.hp=boss.maxHp*.5;g.update(.01);
  assert.equal(boss.enraged,true);assert.equal(boss.damage,Math.round(damage*1.35));assert.equal(boss.speed,speed*1.2);assert.equal(boss.shield,120);
  tick(g,1);assert.equal(boss.damage,Math.round(damage*1.35));
  assert.equal(g.drainEvents().filter(e=>e.type==='bossRage').length,1);
  boss.abilityTimer=type==='ipo'?7.99:6.99;g.update(.02);
  if(type==='ipo')assert.equal(g.enemies.filter(e=>e.mini).length,2);else assert.equal(boss.shield,160);
 }
});

test('overlord starts armored and refreshes its own and nearby shields without stacking',()=>{
 const g=scene(),boss=enemy(g,'overlord'),near=enemy(g,'sam',1,650),far=enemy(g,'sam',4);
 assert.equal(boss.armor,260);boss.abilityTimer=10;g.update(.01);
 assert.equal(boss.shield,160);assert.equal(near.shield,80);assert.equal(far.shield,0);
 const hp=boss.hp;g.damageEnemy(boss,500);assert.equal(boss.hp,hp-80);assert.equal(boss.armor,0);assert.equal(boss.shield,0);
 boss.abilityTimer=10;g.update(.01);assert.equal(boss.shield,160);assert.equal(near.shield,80);
});

test('pause, time stop and cinematic stun suspend boss phase changes and summons',()=>{
 const g=scene(),boss=enemy(g,'ipo');boss.hp=boss.maxHp/2;boss.abilityTimer=12;
 g.pause();tick(g,1);assert.equal(boss.enraged,false);assert.equal(boss.abilityTimer,12);
 g.resume();g.timeStop=1;tick(g,.5);assert.equal(boss.enraged,false);assert.equal(g.enemies.length,1);
 g.timeStop=0;boss.stun=.5;tick(g,.2);assert.equal(boss.enraged,false);assert.equal(boss.abilityTimer,12);
 tick(g,.4);assert.equal(boss.enraged,true);assert.equal(g.enemies.length,3);
});

test('bosses stop rescue carts, take finite damage through armor, and protect enemies behind them',()=>{
 for(const type of ['ipo','overlord']){
  const g=scene();g.wave=6;
  const breach=enemy(g,'sam',2,60),front=enemy(g,'sam',2,300),boss=enemy(g,type,2,600),behind=enemy(g,'sam',2,850);
  boss.hp=boss.maxHp=3000; // Isolate cart damage from the separate half-HP rage shield.
  const durability=boss.hp+boss.armor+boss.shield;g.update(.01);
  assert.equal(g.mowers[2],false);assert.ok(breach.hp<=0&&front.hp<=0);assert.ok(behind.hp>0);
  assert.equal(boss.hp+boss.armor+boss.shield,durability-800);
  assert.equal(g.phase,'playing');assert.ok(g.effects.find(f=>f.type==='mower').endX<boss.x);
 }
});

test('boss rewards and defeat events happen once; wave clearance waits for boss and summons',()=>{
 const g=scene();g.wave=6;g.nextWaveTimer=null;const boss=enemy(g,'overlord'),recruit=enemy(g,'runner');
 const tokens=g.tokens;g.damageEnemy(boss,99999);g.damageEnemy(boss,99999);
 assert.equal(g.tokens,tokens+200);assert.equal(g.kills,1);g.update(.01);assert.equal(g.phase,'playing');
 assert.equal(g.drainEvents().filter(e=>e.type==='bossDefeated').length,1);
 assert.equal(g.waveCleared,false);g.damageEnemy(recruit,99999);g.update(.01);assert.equal(g.phase,'playing');assert.equal(g.waveCleared,true);assert.ok(g.nextWaveTimer<=10);
 const h=scene(),chair=enemy(h,'ipo');const before=h.tokens;h.damageEnemy(chair,99999);assert.equal(h.tokens,before+100);
});

test('converted support and boss summons stay on their new side',()=>{
 const g=scene(),medic=g.spawnEnemy('medic',2,{allied:true}),ally=g.spawnEnemy('sam',2,{allied:true}),foe=enemy(g,'sam');
 medic.x=ally.x=foe.x=600;ally.hp-=60;foe.hp-=60;medic.abilityTimer=8;g.updateEnemyKit(medic);
 assert.equal(ally.hp,ally.maxHp-15);assert.equal(foe.hp,foe.maxHp-60);
 const boss=g.spawnEnemy('ipo',2,{allied:true});boss.abilityTimer=12;g.updateEnemyKit(boss);
 assert.equal(g.allies.filter(a=>a.mini).length,2);assert.equal(g.enemies.filter(a=>a.mini).length,0);
 assert.equal(g.drainEvents().filter(e=>e.type==='bossSpawn').length,0);
});

test('all enemy accessories and simultaneous boss bars draw finite geometry and restore canvas state',()=>{
 let depth=0;const state={globalAlpha:1},stack=[];
 const ctx=new Proxy(state,{get(o,key){if(key in o)return o[key];if(key==='save')return ()=>{stack.push({...o});depth++;};if(key==='restore')return ()=>{assert.ok(depth>0);Object.assign(o,stack.pop());depth--;};return (...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),String(key));};},set(o,k,v){o[k]=v;return true;}});
 const g=scene();
 for(const c of CEOS){const e=enemy(g,c.id);for(const t of [0,1,100])drawEnemyKit(ctx,e,t);if(e.boss){e.enraged=true;assert.equal(enemySize(e),c.spriteSize??104);}}
 for(const lang of ['zh','en','ja']){g.lang=lang;drawBossBars(ctx,g);}
 assert.equal(depth,0);assert.equal(ctx.globalAlpha,1);
});
