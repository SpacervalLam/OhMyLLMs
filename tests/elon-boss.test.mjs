import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame,FIELD} from '../dist/engine.js';
import {CEO_MAP,CEOS,localized} from '../dist/data.js';
import {enemyGuide} from '../dist/field-guide.js';
import {bossForWave} from '../dist/super-boss.js';
import {ELON_SKILLS} from '../dist/elon-data.js';
import {ELON_KIT,castStarlink,castAutopilot,castLaunch,castSearch,castThink,castProjections,castRepost,castTrend,castLimit,castNotes,elonDamageScale,basicIntervalScale,trendAttackScale,recordElonAttack,interruptElonRocket} from '../dist/elon-boss.js';
import {castAirstrike} from '../dist/trump-boss.js';
import {drawElonGround,drawElonOrders,drawElonEffect,drawElonProjectile} from '../dist/elon-vfx.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function tick(g,s,dt=.01){for(let n=0;n<Math.round(s/dt);n++)g.update(dt);}
function scene(){const g=new GardenGame({starter:false,lang:'en',eggs:false,seed:42});g.tokens=1e6;g.start();g.nextWaveTimer=g.airdropTimer=999;return g;}
function put(g,model='qwen',row=2,col=3,stars=1){let u;for(let n=0;n<[0,1,3,7][stars];n++){g.cooldowns[model]=0;u=g.plant(model,row,col).unit;}u.attackTimer=u.basicTimer=u.produceTimer=999;return u;}
function boss(g,row=2){const e=g.spawnEnemy('elon_super',row);e.speed=0;e.attackTimer=999;for(const key of Object.keys(e.elonKit.timers))e.elonKit.timers[key]=999;return e;}
function quietSummons(g){for(const e of g.enemies)if(e.type==='grok_projection')e.attackTimer=999;}

test('Elon Super has all eleven translated guide entries, a five-boss rotation and bounded summon types',()=>{
 const e=CEO_MAP.elon_super;assert.equal(e.prototype,'Elon Musk');assert.equal(e.boss,true);assert.equal(e.points,6000);assert.equal(e.reward,400);assert.equal(e.skills.length,11);
 assert.deepEqual(ELON_SKILLS.map(s=>s[0]),['starlink','autopilot','launch','recovery','search','think','projection','repost','trend','limit','notes']);
 for(const lang of ['zh','en','ja']){const guide=enemyGuide(e,lang);assert.equal(guide.skills.length,11);assert.ok(guide.notes);assert.equal(new Set(guide.skills.map(s=>s.description)).size,11);for(const skill of guide.skills){assert.ok(skill.name&&skill.description);assert.notEqual(skill.description,localized(e.desc,lang));}}
 for(const type of ['starlink_drone','grok_projection']){assert.equal(CEO_MAP[type].summoned,true);assert.equal(CEO_MAP[type].convertible,false);assert.equal(CEO_MAP[type].boss,undefined);}
 assert.equal(bossForWave(15),'elon_super');assert.equal(bossForWave(30),'elon_super');assert.equal(bossForWave(18),'ipo');assert.equal(CEOS.filter(e=>e.boss).length,5);
});

test('three attackable satellites reduce actual damage by 45%, then each kill removes 15%',()=>{
 const g=scene(),e=boss(g);castStarlink(g,e);const drones=g.enemies.filter(a=>a.ownerId===e.id);assert.equal(drones.length,3);assert.equal(new Set(drones.map(a=>a.row)).size,3);
 const hp=e.hp;g.damageEnemy(e,100);close(hp-e.hp,55);g.damageEnemy(drones[0],99999);close(elonDamageScale(g,e),.7);assert.equal(g.score,60);
 g.damageEnemy(drones[1],99999);close(elonDamageScale(g,e),.85);g.damageEnemy(drones[2],99999);close(elonDamageScale(g,e),1);assert.equal(g.score,180);
});

test('satellites expire without rewards, never attack, cap at three, and stop protecting during recovery',()=>{
 const g=scene(),e=boss(g);put(g,'qwen',2,1);castStarlink(g,e);castStarlink(g,e);assert.equal(g.enemies.filter(a=>a.type==='starlink_drone').length,3);
 const x=g.enemies.filter(a=>a.ownerId===e.id).map(a=>a.x);e.elonKit.recoverUntil=g.time+3;e.elonKit.recoveryKind='booster';close(elonDamageScale(g,e),1);tick(g,3);close(elonDamageScale(g,e),.55);
 assert.deepEqual(g.enemies.filter(a=>a.ownerId===e.id).map(a=>a.x),x);assert.equal(g.projectiles.length,0);tick(g,7);assert.equal(g.enemies.filter(a=>a.ownerId===e.id).length,0);close(elonDamageScale(g,e),1);assert.equal(g.score,0);assert.equal(g.kills,0);
});

test('autopilot warns for 1.5 seconds, picks the less blocked adjacent lane and preserves x',()=>{
 const g=scene(),e=boss(g);e.x=700;put(g,'qwen',1,5);const x=e.x;assert.equal(castAutopilot(g,e),3);tick(g,1.49);assert.equal(e.row,2);tick(g,.01);assert.equal(e.row,3);assert.equal(e.x,x);assert.equal(e.y,FIELD.y+3*96+48);
 for(const row of [0,4]){const other=scene(),b=boss(other,row);castAutopilot(other,b);tick(other,1.5);assert.equal(b.row,row===0?1:3);}
});

test('rocket charges fully, collides with first defender without tunnelling, then enters three-second recovery',()=>{
 for(const dt of [.01,.1]){
  const g=scene(),e=boss(g);e.x=700;const front=put(g,'qwen',2,5),back=put(g,'qwen',2,4);castLaunch(g,e);tick(g,2,dt);assert.equal(e.x,700);assert.equal(front.hp,front.maxHp);
  tick(g,.4,dt);assert.equal(front.hp,front.maxHp-120);assert.equal(back.hp,back.maxHp);assert.equal(e.x,front.x+42);assert.equal(e.elonKit.recoveryKind,'booster');assert.ok(e.elonKit.recoverUntil>g.time);assert.equal(g.elonTrails.length,1);
  const x=e.x;e.attackTimer=0;tick(g,2,dt);assert.equal(e.x,x);assert.equal(g.projectiles.length,0);
 }
});

test('rocket collision respects Qwen shelter, travel is capped at one tile, and GLM slows rush progression',()=>{
 const g=scene(),e=boss(g);e.x=700;const u=put(g,'chatgpt',2,5);put(g,'qwen',1,5,3);castLaunch(g,e);tick(g,2.2);close(u.maxHp-u.hp,120*.75);
 const a=scene(),b=boss(a);b.x=900;castLaunch(a,b);tick(a,2.1);assert.ok(b.x<900&&b.x>800);tick(a,.3);close(b.x,800);
 const slow=scene(),sb=boss(slow);sb.x=900;sb.slow=5;sb.slowFactor=.45;castLaunch(slow,sb);tick(slow,2.1);assert.ok(sb.x>b.x);close(900-sb.x,360*.45*.1);tick(slow,1);close(sb.x,800);
});

test('Grok skill direct hits interrupt launch independently of knockback cooldown; splash and basics do not',()=>{
 const g=scene(),u=put(g,'grok',2,1,3),e=boss(g);e.knockRecovery=999;castLaunch(g,e);
 g.applyImpact({model:'grok',basic:true},e);assert.equal(e.elonKit.action.kind,'charge');
 g.applyImpact({model:'grok',basic:false,stars:3,sourceId:u.id,damage:35,knock:12},e);assert.equal(e.elonKit.action,null);close(e.elonKit.recoverUntil-g.time,3);
 const second=boss(g,3);castLaunch(g,second);g.applyImpact({model:'grok',stars:3,sourceId:u.id,damage:35,splash:150},e);assert.equal(second.elonKit.action.kind,'charge');
 assert.equal(interruptElonRocket(g,e),false);
});

test('half HP transition occurs once; phase two shifts before charging and recovery is four seconds',()=>{
 const g=scene(),e=boss(g);e.x=900;e.hp=e.maxHp*.5;tick(g,.01);assert.equal(e.enraged,true);close(e.elonKit.timers.launch,11.99);castLaunch(g,e);
 assert.equal(e.elonKit.action.kind,'shift');tick(g,1.5);assert.equal(e.row,1);assert.equal(e.elonKit.action.kind,'charge');tick(g,2);assert.equal(e.x,900);tick(g,.3);close(e.x,800);assert.ok(e.elonKit.recoverUntil-g.time>3.9&&e.elonKit.recoverUntil-g.time<=4);
 tick(g,.5);assert.equal(g.drainEvents().filter(e=>e.type==='bossRage').length,1);
});

test('Live Search uses actual capped shield/armor damage in a six-second rolling window',()=>{
 const g=scene(),e=boss(g),a=put(g,'chatgpt',0,1),b=put(g,'gemini',1,1),foe=g.spawnEnemy('sam',4);foe.speed=0;foe.hp=20;foe.shield=40;
 g.damageEnemy(foe,999999,{sourceId:a.id});g.damageEnemy(e,70,{sourceId:b.id});castSearch(g,e);assert.equal(g.elonOrders[0].row,b.row);
 g.elonOrders=[];tick(g,6.01);g.damageEnemy(e,10,{sourceId:a.id});castSearch(g,e);assert.equal(g.elonOrders[0].row,a.row);
});

test('search warning is exactly two seconds, stays on its tile after replacement and respects shelter',()=>{
 const g=scene(),e=boss(g),a=put(g,'chatgpt',0,1);g.damageEnemy(e,10,{sourceId:a.id});castSearch(g,e);g.remove(a.row,a.col);const replacement=put(g,'qwen',0,1);put(g,'qwen',1,1,3);
 tick(g,1.99);assert.equal(replacement.hp,replacement.maxHp);tick(g,.01);close(replacement.maxHp-replacement.hp,75);assert.equal(g.elonOrders.length,0);
 const empty=scene(),b=boss(empty),u=put(empty);castSearch(empty,b);empty.remove(u.row,u.col);tick(empty,2);assert.equal(empty.elonOrders.length,0);
});

test('search excludes dead source identities and uses nearest defender when there is no recent damage',()=>{
 const g=scene(),e=boss(g);const dead=put(g,'chatgpt',0,1),near=put(g,'qwen',2,8),far=put(g,'qwen',4,1);g.damageEnemy(e,10,{sourceId:dead.id});g.remove(dead.row,dead.col);
 castSearch(g,e);assert.equal(e.elonKit.lastSearch.unitId,near.id);assert.notEqual(e.elonKit.lastSearch.unitId,far.id);
});

test('reasoning can be interrupted by cumulative actual damage, including direct damage, and clears its volley',()=>{
 const g=scene(),e=boss(g),u=put(g);castThink(g,e);g.damageEnemy(e,80);g.damageEnemy(e,79,{direct:true});assert.equal(e.elonKit.action.kind,'think');g.damageEnemy(e,1,{direct:true});assert.equal(e.elonKit.action,null);close(e.elonKit.recoverUntil-g.time,2);tick(g,3);assert.equal(u.hp,u.maxHp);assert.equal(g.elonOrders.length,0);
 const shielded=scene(),b=boss(shielded);castStarlink(shielded,b);castThink(shielded,b);shielded.damageEnemy(b,200);assert.equal(b.elonKit.action.kind,'think');close(b.elonKit.action.taken,110);
});

test('completed reasoning fires at most four distinct defenders and dead targets never transfer to replacements',()=>{
 const g=scene(),e=boss(g),units=[0,1,2,3,4].map(row=>put(g,'qwen',row,1));castThink(g,e);tick(g,2.99);assert.equal(g.elonOrders.length,0);tick(g,.01);assert.equal(g.elonOrders.length,4);assert.equal(new Set(g.elonOrders.map(o=>o.targetId)).size,4);
 const removed=units.find(u=>u.id===g.elonOrders[0].targetId);g.remove(removed.row,removed.col);const replacement=put(g,'qwen',removed.row,removed.col);tick(g,.7);assert.equal(replacement.hp,replacement.maxHp);assert.equal(units.filter(u=>u.hp<u.maxHp).length,3);
});

test('two short-lived projections use independent damageable bodies and weak axes without status effects',()=>{
 for(const row of [0,2,4]){
  const g=scene(),e=boss(g,row);castProjections(g,e);const agents=g.enemies.filter(a=>a.type==='grok_projection');assert.equal(agents.length,2);assert.ok(agents.every(a=>a.row!==row));assert.equal(new Set(agents.map(a=>a.row)).size,2);
  const targets=agents.map(a=>put(g,'qwen',a.row,7));tick(g,1.5);for(const u of targets){assert.equal(u.hp,u.maxHp-24);assert.equal(u.burn,undefined);assert.equal(u.knockback,undefined);}
  const hp=targets.map(u=>u.hp);g.damageEnemy(agents[0],99999);quietSummons(g);tick(g,6.5);assert.equal(g.enemies.filter(a=>a.type==='grok_projection').length,0);assert.equal(g.score,100);assert.equal(g.kills,1);assert.deepEqual(targets.map(u=>u.hp),hp);
 }
});

test('reposts hit three different identities with attenuation and a range cap, without recursive chains',()=>{
 const g=scene(),e=boss(g);e.x=750;const first=put(g,'qwen',2,5),next=put(g,'qwen',1,5),last=put(g,'qwen',0,5),far=put(g,'qwen',4,0);
 const path=castRepost(g,e);assert.deepEqual(path.map(m=>m.id),[first.id,next.id,last.id]);tick(g,.99);assert.equal(first.hp,first.maxHp);tick(g,.01);close(first.maxHp-first.hp,80);tick(g,.35);close(next.maxHp-next.hp,48);tick(g,.35);close(last.maxHp-last.hp,28);assert.equal(far.hp,far.maxHp);assert.equal(g.elonOrders.length,0);
});

test('phase-two repost starts at the last searched live unit and never redirects a removed identity',()=>{
 const g=scene(),e=boss(g);e.enraged=true;const a=put(g,'qwen',0,0),b=put(g,'qwen',2,8);g.damageEnemy(e,1,{sourceId:a.id});castSearch(g,e);g.elonOrders=[];assert.equal(castRepost(g,e)[0].id,a.id);
 g.remove(a.row,a.col);const replacement=put(g,'qwen',a.row,a.col);tick(g,1);assert.equal(replacement.hp,replacement.maxHp);g.elonOrders=[];assert.equal(castRepost(g,e)[0].id,b.id);
});

test('trending targets the most occupied lane, gains only three deployment/merge stacks and never extends its window',()=>{
 const g=scene(),e=boss(g);put(g,'qwen',0,0);put(g,'qwen',0,1);put(g,'qwen',2,0);assert.equal(castTrend(g,e),0);const ends=e.elonKit.trend.ends;
 const foe=g.spawnEnemy('sam',0);close(trendAttackScale(g,foe),1.3);
 for(let n=0;n<4;n++){g.cooldowns.qwen=0;g.plant('qwen',0,0);}assert.equal(e.elonKit.trend.heat,3);close(trendAttackScale(g,foe),1.45);assert.equal(e.elonKit.trend.ends,ends);
 const other=boss(g,4);other.elonKit.trend={row:0,ends:g.time+6,heat:1};close(trendAttackScale(g,foe),1.45);tick(g,6);close(trendAttackScale(g,foe),1);
});

test('failed deployments and actions outside trending lane never add heat; haste affects real melee attacks',()=>{
 const g=scene(),e=boss(g);const u=put(g,'qwen',2,3);u.hp=u.maxHp=10000;castTrend(g,e);const foe=g.spawnEnemy('sam',2);foe.x=u.x+55;foe.speed=0;foe.attackTimer=1;
 g.tokens=0;assert.equal(g.plant('gemini',2,3).ok,false);assert.equal(g.plant('qwen',2,5).ok,false);assert.equal(e.elonKit.trend.heat,0);tick(g,.77);assert.ok(u.hp<u.maxHp);
});

test('throttling selects real recent basic frequency and never stacks, stops input or slows skill clocks',()=>{
 const g=scene(),e=boss(g),a=put(g,'chatgpt',0,0,3),b=put(g,'gemini',1,0,3),c=put(g,'grok',2,0,3),support=put(g,'deepseek',3,0,3);
 for(const [u,count] of [[a,4],[b,3],[c,1]])for(let n=0;n<count;n++)recordElonAttack(g,u);
 assert.deepEqual(castLimit(g,e),[a.id,b.id]);castLimit(g,e);assert.equal(g.elonLimits.length,2);close(basicIntervalScale(g,a),1.4);close(basicIntervalScale(g,c),1);
 a.attackTimer=1;a.basicTimer=1;support.produceTimer=1;const before=g.tokens;tick(g,.7);close(a.attackTimer,.3);close(a.basicTimer,.5);close(support.produceTimer,.3);assert.equal(g.controlsLocked,false);assert.ok(g.plant('qwen',4,0).ok);assert.ok(g.tokens<before);
 tick(g,4.3);close(basicIntervalScale(g,a),1);assert.equal(g.elonLimits.length,0);
});

test('one-star throttling slows its actual attack clock, while high-rank skill and production rates stay normal',()=>{
 const g=scene(),e=boss(g),u=put(g,'grok',0,0);recordElonAttack(g,u);castLimit(g,e);u.attackTimer=1;tick(g,.7);close(u.attackTimer,.5);
});

test('community notes need three different model types, then grant precisely four seconds of vulnerability',()=>{
 const g=scene(),e=boss(g),a=put(g,'chatgpt',0,0),duplicate=put(g,'chatgpt',1,0),b=put(g,'gemini',2,0),c=put(g,'grok',3,0);castNotes(g,e);
 const hp=e.hp;g.damageEnemy(e,100,{sourceId:a.id});close(hp-e.hp,65);g.damageEnemy(e,1,{sourceId:duplicate.id});assert.equal(e.elonKit.note.models.length,1);g.damageEnemy(e,1,{sourceId:b.id});g.damageEnemy(e,1,{direct:true,sourceId:c.id});assert.equal(e.elonKit.note,null);close(elonDamageScale(g,e),1.25);
 const life=e.hp;g.damageEnemy(e,100);close(life-e.hp,125);tick(g,4);close(elonDamageScale(g,e),1);assert.equal(g.drainEvents().filter(e=>e.type==='elonCorrected').length,1);
});

test('natural note expiry has no vulnerability and notes combine multiplicatively with Starlink',()=>{
 const g=scene(),e=boss(g);castNotes(g,e);castStarlink(g,e);close(elonDamageScale(g,e),.65*.55);tick(g,8);close(elonDamageScale(g,e),.55);assert.equal(e.elonKit.vulnerableUntil,0);
});

test('lingering projectiles and melt still contribute the original model after its LLM has left',()=>{
 const g=scene(),e=boss(g),a=put(g,'chatgpt',0,0),b=put(g,'gemini',1,0),c=put(g,'grok',2,0);castNotes(g,e);
 g.damageEnemy(e,1,{sourceId:a.id});g.damageEnemy(e,1,{sourceId:b.id});g.remove(c.row,c.col);g.departures=[];
 e.burn={sourceId:c.id,remaining:3,tick:.5};e.slow=2;g.meltFrozen();assert.equal(e.elonKit.note,null);close(elonDamageScale(g,e),1.25);
 const other=scene(),boss2=boss(other),u=put(other,'mimo',2,0);other.fire(u,boss2,{damage:10,pierce:3});other.remove(u.row,u.col);other.departures=[];castNotes(other,boss2);
 other.damageEnemy(boss2,10,{sourceId:u.id});assert.deepEqual(boss2.elonKit.note.models,['mimo']);
});

test('pause and time stop freeze search, repost, throttle, trend, trails, summon life and all boss timers',()=>{
 const g=scene(),e=boss(g),u=put(g);castSearch(g,e);castRepost(g,e);castTrend(g,e);recordElonAttack(g,u);castLimit(g,e);castStarlink(g,e);castThink(g,e);
 g.elonTrails.push({id:g.nextId++,ownerId:e.id,row:2,x0:500,x1:600,ends:2,nextTick:.5,power:1});
 const snapshot=()=>JSON.stringify({time:g.time,orders:g.elonOrders,limits:g.elonLimits,trails:g.elonTrails,k:e.elonKit,summons:g.enemies.filter(a=>a.ownerId===e.id).map(a=>({expires:a.expires,age:a.age,hp:a.hp}))});
 const before=snapshot();g.pause();tick(g,2);assert.equal(snapshot(),before);g.resume();g.timeStop=2;tick(g,2);assert.equal(snapshot(),before);tick(g,.1);assert.notEqual(snapshot(),before);
});

test('stun delays reasoning and autopilot without releasing their actions early',()=>{
 const g=scene(),e=boss(g);castThink(g,e);e.stun=1;tick(g,.5);assert.equal(e.elonKit.action.remaining,3);tick(g,.51);assert.ok(e.elonKit.action.remaining<3);assert.equal(g.elonOrders.length,0);
});

test('boss defeat cleans only its own warnings, debuffs, projections and trails with one proper bounty',()=>{
 const g=scene(),e=boss(g),second=boss(g,4),u=put(g);for(const b of [e,second]){castSearch(g,b);castTrend(g,b);castProjections(g,b);castStarlink(g,b);recordElonAttack(g,u);castLimit(g,b);}
 const commander=g.spawnEnemy('trump',0);commander.trumpKit={strike:999,deploy:999,shift:999};castAirstrike(g,commander);commander.hp=0;
 g.damageEnemy(e,999999,{direct:true});assert.equal(g.kills,1);assert.equal(g.score,6000);assert.equal(g.defeated.elon_super.count,1);assert.ok(g.elonOrders.every(o=>o.ownerId===second.id));assert.ok(g.elonLimits.every(o=>o.ownerId===second.id));assert.equal(g.airstrikes.length,1);
 assert.ok(g.enemies.filter(a=>a.ownerId===e.id).every(a=>a.hp===0));assert.ok(g.enemies.filter(a=>a.ownerId===second.id).every(a=>a.hp>0));g.damageEnemy(e,999999);assert.equal(g.kills,1);
});

test('released projection axes are cancelled on owner defeat, and cannot outlive its cleanup in the same frame',()=>{
 const g=scene(),e=boss(g);castProjections(g,e);for(const a of g.enemies.filter(a=>a.ownerId===e.id))put(g,'qwen',a.row,1);tick(g,1);assert.ok(g.projectiles.some(p=>p.ownerId===e.id));g.damageEnemy(e,999999,{direct:true});assert.ok(!g.projectiles.some(p=>p.ownerId===e.id));
});

test('rocket exhaust damage is independent of render/update frequency and never multiplies per movement segment',()=>{
 for(const dt of [.01,.1]){
  const g=scene(),e=boss(g);e.x=900;castLaunch(g,e);tick(g,2.4,dt);const u=put(g,'qwen',2,7);u.x=850;
  tick(g,1.5,dt);assert.equal(u.maxHp-u.hp,24);assert.equal(g.elonTrails.length,1);
  tick(g,1,dt);assert.equal(u.maxHp-u.hp,32);assert.equal(g.elonTrails.length,0);
 }
});

test('GPU rescue carts deal a finite hit to Elon Super and do not erase the boss or enemies behind it',()=>{
 const g=scene(),e=boss(g);e.x=600;const leak=g.spawnEnemy('sam',2),behind=g.spawnEnemy('sam',2);leak.x=60;behind.x=850;behind.speed=0;
 tick(g,.01);assert.equal(g.mowers[2],false);assert.equal(e.hp,e.maxHp-800);assert.ok(behind.hp>0);assert.ok(leak.hp<=0);assert.equal(g.phase,'playing');
});

test('player Grok skills retain the 40% Elon bonus while basic attacks retain their base damage',()=>{
 for(const eggs of [false,true]){
  const g=scene();g.eggs=eggs;const e=boss(g),u=put(g,'grok',2,1,3);e.x=400;
  g.fire(u,e,{damage:50});tick(g,.5);close(e.maxHp-e.hp,eggs?70:50);
  e.burn=null;const hp=e.hp;g.fire(u,e,{damage:20,basic:true});tick(g,.5);close(hp-e.hp,20);
 }
});

test('all eleven mechanics can run in one seeded long encounter without leaked objects or non-finite state',()=>{
 const g=scene(),e=boss(g);for(const key of Object.keys(e.elonKit.timers))e.elonKit.timers[key]=ELON_KIT.first[key];
 for(let row=0;row<5;row++)for(let col=0;col<4;col++){const u=put(g,col%2?'gemini':'qwen',row,col,3);u.hp=u.maxHp=1e8;}
 const seen=new Set();for(let n=0;n<9000;n++){if(n%100===0)for(const u of g.units)recordElonAttack(g,u);g.update(.01);for(const event of g.drainEvents())if(event.type==='elonCast')seen.add(event.skill);for(const a of g.enemies){assert.ok(Number.isFinite(a.hp)&&Number.isFinite(a.x)&&Number.isFinite(a.y));}}
 assert.equal(seen.size,10,[...seen].join(','));assert.ok(g.elonOrders.length<15);assert.ok(g.elonTrails.length<5);assert.ok(g.elonIntel.attacks.length<=140);assert.ok(g.enemies.filter(a=>a.type==='starlink_drone').length<=3);assert.ok(g.enemies.filter(a=>a.type==='grok_projection').length<=2);
});

test('Elon visuals cover every action and restore canvas alpha/state with finite coordinates',()=>{
 const g=scene(),e=boss(g),u=put(g);castStarlink(g,e);castSearch(g,e);castRepost(g,e);castTrend(g,e);castNotes(g,e);recordElonAttack(g,u);castLimit(g,e);
 const stack=[],state={globalAlpha:.8};const c=new Proxy(state,{get(o,key){if(key in o)return o[key];if(key==='save')return ()=>stack.push({...o});if(key==='restore')return ()=>{assert.ok(stack.length);Object.assign(o,stack.pop());};return (...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),String(key));};}});
 for(const action of [null,{kind:'shift',row:1,remaining:1},{kind:'charge',remaining:1},{kind:'rush',distance:50},{kind:'think',remaining:2,nodes:1,taken:20}]){e.elonKit.action=action;drawElonGround(c,g,1);drawElonOrders(c,g,1);}
 for(const type of ['elonRay','elonThoughtHit','elonRepostHit','elonLanding','elonInterrupted','elonCorrection','elonViral'])for(const age of [0,.4,.8])assert.equal(drawElonEffect(c,{type,x:500,y:300,age,duration:.8,text:'test'}),true);
 for(const kind of ['elonPulse','grokProjection'])assert.equal(drawElonProjectile(c,{kind,x:500,y:300,id:1},1),true);
 assert.equal(stack.length,0);assert.equal(c.globalAlpha,.8);
});
