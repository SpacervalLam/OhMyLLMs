import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame,FIELD,enemyTargetable} from '../dist/engine.js';
import {CEO_MAP,MODEL_MAP} from '../dist/data.js';
import {TRUMP_KIT,onFieldTrump,deployMilitary,shiftTrump,castAirstrike,militaryContract,resolveMilitaryWrits} from '../dist/trump-boss.js';
import {drawTrumpOrders,drawTrumpEffect} from '../dist/trump-vfx.js';
import {drawBossBars} from '../dist/enemy-vfx.js';

function tick(g,s){for(let n=0;n<Math.round(s*100);n++)g.update(.01);}
function put(g,model='qwen',row=2,col=3,stars=1){let u;for(let n=0;n<[0,1,3,7][stars];n++){g.cooldowns[model]=0;u=g.plant(model,row,col).unit;}u.attackTimer=u.basicTimer=u.produceTimer=999;return u;}
function scene(){const g=new GardenGame({starter:false,seed:42,lang:'en',eggs:false});g.tokens=99999;g.start();g.nextWaveTimer=g.airdropTimer=999;return g;}
function trump(g,row=2){const e=g.spawnEnemy('trump',row);e.trumpKit={strike:999,deploy:999,shift:999};return e;}
function quiet(e){if(e.militaryKit)e.militaryKit={basic:999,contract:999};return e;}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('Trump is an unbeatable scored-zero boss with six translated skills and a real prototype',()=>{
 const c=CEO_MAP.trump;assert.equal(c.prototype,'Donald John Trump');assert.equal(c.boss,true);assert.equal(c.unbeatable,true);assert.equal(c.points,0);assert.equal(c.reward,0);assert.equal(c.skills.length,6);
 for(const skill of c.skills)for(const lang of ['zh','en','ja'])assert.ok(skill[lang]);
 assert.equal(CEO_MAP.military_claude.summoned,true);assert.equal(CEO_MAP.military_claude.hp,MODEL_MAP.claude.hp*3);
});

test('Trump remains at the right edge without forward movement, melee or knockback',()=>{
 const g=scene(),u=put(g,'qwen',2,8),e=trump(g);const hp=u.hp;e.boost=20;e.slow=20;
 assert.equal(g.knockback(e,100),false);tick(g,10);assert.equal(e.x,TRUMP_KIT.x);assert.equal(e.speed,0);assert.equal(u.hp,hp);assert.equal(g.projectiles.length,0);
 assert.equal(e.y,FIELD.y+e.row*FIELD.ch+48);
});

test('deployment puts one Military Claude in each other lane and replenishes only missing owned slots',()=>{
 for(const row of [0,2,4]){
  const g=scene(),e=trump(g,row);assert.equal(deployMilitary(g,e),4);
  const guards=g.enemies.filter(a=>a.type==='military_claude');assert.equal(guards.length,4);assert.equal(new Set(guards.map(a=>a.row)).size,4);
  for(const a of guards){assert.notEqual(a.row,row);assert.equal(a.ownerId,e.id);assert.equal(a.x,TRUMP_KIT.x);assert.equal(a.speed,0);quiet(a);}
  assert.equal(deployMilitary(g,e),0);guards[0].welfareUsed=true;g.damageEnemy(guards[0],999999);assert.ok(guards[0].hp<=0);
  assert.equal(deployMilitary(g,e),1);assert.equal(g.enemies.filter(a=>a.type==='military_claude'&&a.hp>0).length,4);
 }
});

test('changing lane exchanges Trump and his living Military Claude, preserving all four garrison lanes',()=>{
 const g=scene(),e=trump(g);deployMilitary(g,e);g.enemies.filter(a=>a.type==='military_claude').forEach(quiet);
 for(let n=0;n<12;n++){
  const old=e.row,positions=new Map(g.enemies.filter(a=>a.ownerId===e.id).map(a=>[a.id,a.row]));shiftTrump(g,e);
  assert.notEqual(e.row,old);const moved=g.enemies.find(a=>a.ownerId===e.id&&a.row===old);assert.equal(positions.get(moved.id),e.row);
  assert.equal(e.x,TRUMP_KIT.x);assert.equal(moved.x,TRUMP_KIT.x);assert.equal(moved.y,FIELD.y+old*FIELD.ch+48);
  assert.equal(new Set(g.enemies.filter(a=>a.hp>0).map(a=>a.row)).size,5);assert.equal(deployMilitary(g,e),0);
 }
});

test('swap ignores dead, converted and other bosses’ troops; missing garrisons do not trap Trump in a lane',()=>{
 const g=scene(),e=trump(g);const dead=g.spawnEnemy('military_claude',0);dead.ownerId=e.id;dead.hp=0;
 const ally=g.spawnEnemy('military_claude',1,{allied:true});ally.ownerId=e.id;
 const foreign=g.spawnEnemy('military_claude',3);foreign.ownerId=999;
 shiftTrump(g,e);assert.notEqual(e.row,2);assert.equal(dead.row,0);assert.equal(ally.row,1);assert.equal(foreign.row,3);assert.equal(e.x,TRUMP_KIT.x);
});

test('automatic orders deploy at 2s, strike at 5s, and swap at 8s; stun delays commands',()=>{
 const g=scene();for(let row=0;row<5;row++)put(g,'qwen',row,0);
 const e=g.spawnEnemy('trump',2);tick(g,1.99);assert.equal(g.enemies.length,1);tick(g,.01);assert.equal(g.enemies.length,5);
 g.enemies.filter(a=>a.type==='military_claude').forEach(quiet);
 tick(g,2.99);assert.equal(g.airstrikes.length,0);tick(g,.01);assert.equal(g.airstrikes.length,5);
 e.stun=4;const row=e.row;tick(g,3.1);assert.equal(e.row,row);tick(g,3.9);assert.notEqual(e.row,row);
});

test('airstrikes sample five distinct occupied tiles, never empty or dead tiles',()=>{
 const g=scene(),e=trump(g);for(let row=0;row<5;row++)for(let col=0;col<2;col++)put(g,'qwen',row,col);
 g.units[0].hp=0;assert.equal(castAirstrike(g,e),5);assert.equal(g.airstrikes.length,5);
 assert.equal(new Set(g.airstrikes.map(s=>`${s.row}:${s.col}`)).size,5);
 for(const s of g.airstrikes){assert.ok(g.units.some(u=>u.hp>0&&u.row===s.row&&u.col===s.col));assert.equal(s.remaining,1.5);}
 for(const n of [0,1,3]){const other=scene(),boss=trump(other);for(let r=0;r<n;r++)put(other,'qwen',r,0);assert.equal(castAirstrike(other,boss),n);}
});

test('bombing waits 1.5s, damages the current tile occupant for 150, and honors Qwen protection',()=>{
 const g=scene(),e=trump(g),u=put(g,'qwen',0,0);castAirstrike(g,e);tick(g,1.49);assert.equal(u.hp,u.maxHp);
 tick(g,.01);assert.equal(u.hp,u.maxHp-150);assert.equal(g.airstrikes.length,0);assert.ok(g.effects.some(f=>f.type==='airstrikeBlast'));
 const other=scene(),boss=trump(other),guard=put(other,'qwen',0,0,3),victim=put(other,'qwen',0,1);castAirstrike(other,boss);tick(other,1.5);
 close(victim.hp,victim.maxHp-150*.75);assert.ok(guard.hp<guard.maxHp);
});

test('bombing stays on the original tile after shovel/replacement and empty tiles are safe',()=>{
 const g=scene(),e=trump(g),a=put(g,'qwen',0,0),b=put(g,'qwen',1,0);castAirstrike(g,e);g.remove(a.row,a.col);g.remove(b.row,b.col);
 const replacement=put(g,'qwen',0,0),safe=put(g,'qwen',4,0);tick(g,1.5);
 assert.equal(replacement.hp,replacement.maxHp-150);assert.equal(safe.hp,safe.maxHp);assert.equal(g.airstrikes.length,0);
});

test('execution is strictly below 25%, applies immediately on damage and on boss arrival',()=>{
 const g=scene(),u=put(g,'qwen');u.hp=u.maxHp*.25;const e=trump(g);assert.ok(u.hp>0);
 g.damageUnit(u,.01);assert.equal(u.hp,0);assert.equal(g.drainEvents().filter(e=>e.type==='execution').length,1);
 const low=put(g,'qwen',1,0);low.hp=low.maxHp*.249;tick(g,.01);assert.ok(!g.units.includes(low));
 const other=scene(),before=put(other,'qwen');before.hp=before.maxHp*.2;trump(other);assert.equal(before.hp,0);
 assert.equal(e.hp,e.maxHp);
});

test('low-HP LLMs are executed before Kimi healing or their own attack turn',()=>{
 const g=scene(),u=put(g,'chatgpt',2,2),kimi=put(g,'kimi',2,1),e=trump(g);u.hp=u.maxHp*.2;u.attackTimer=0;kimi.produceTimer=0;
 tick(g,.01);assert.equal(g.units.includes(u),false);assert.ok(!g.projectiles.some(p=>p.sourceId===u.id));assert.ok(e.hp>0);
});

test('welfare heals each enemy exactly once at 10% to 30%, including a lethal crossing',()=>{
 const g=scene();trump(g);const a=g.spawnEnemy('sam',0);g.damageEnemy(a,a.maxHp*.9,{direct:true});close(a.hp,a.maxHp*.3);assert.equal(a.welfareUsed,true);assert.equal(g.kills,0);
 g.damageEnemy(a,a.maxHp*.2,{direct:true});close(a.hp,a.maxHp*.1);assert.equal(g.drainEvents().filter(e=>e.type==='welfare'&&e.enemy===a.id).length,1);
 g.damageEnemy(a,99999,{direct:true});assert.ok(a.hp<=0);assert.equal(g.kills,1);
 const b=g.spawnEnemy('sam',1);g.damageEnemy(b,99999);close(b.hp,b.maxHp*.3);assert.equal(g.kills,1);g.damageEnemy(b,99999);assert.equal(g.kills,2);
});

test('armor and invulnerability are applied before welfare; direct status damage still triggers it',()=>{
 const g=scene();trump(g);const e=g.spawnEnemy('jensen',0);e.hp=e.maxHp*.11;e.armor=100;e.invuln=1;
 g.damageEnemy(e,99999);assert.equal(e.welfareUsed,undefined);assert.equal(e.armor,100);
 e.invuln=0;g.damageEnemy(e,50);assert.equal(e.welfareUsed,undefined);assert.equal(e.armor,50);
 g.damageEnemy(e,e.maxHp*.02,{direct:true});close(e.hp,e.maxHp*.3);assert.equal(e.armor,50);
});

test('welfare covers other bosses and summoned units but never garden allies or dead units',()=>{
 const g=scene();trump(g);const boss=g.spawnEnemy('ipo',0),bird=g.spawnEnemy('qq_raider',1),dead=g.spawnEnemy('sam',2),ally=g.spawnEnemy('sam',3,{allied:true});
 bird.raid={phase:'landed',row:1,col:0,remaining:8,elapsed:1};dead.hp=0;
 for(const e of [boss,bird]){g.damageEnemy(e,999999,{direct:true});close(e.hp,e.maxHp*.3);}
 g.damageAlly(ally,9999);assert.ok(ally.hp<=0);assert.equal(ally.welfareUsed,undefined);tick(g,.01);assert.equal(dead.hp,0);
});

test('welfare is a lifetime one-use flag, not renewed by another Trump or another healing effect',()=>{
 const g=scene(),e=trump(g),unit=g.spawnEnemy('sam',0);g.damageEnemy(unit,9999);close(unit.hp,unit.maxHp*.3);
 e.withdrawn=true;e.hp=0;trump(g,4);unit.hp=unit.maxHp;g.damageEnemy(unit,99999);assert.ok(unit.hp<=0);assert.equal(unit.welfareUsed,true);
});

test('retreat cannot be bypassed by overkill: welfare first, then 1% HP and 15s invulnerability',()=>{
 const g=scene(),e=trump(g);g.damageEnemy(e,999999,{direct:true});close(e.hp,e.maxHp*.3);assert.equal(e.retreat,undefined);assert.equal(e.welfareUsed,true);
 g.damageEnemy(e,999999,{direct:true});close(e.hp,e.maxHp*.01);assert.equal(e.retreat.remaining,15);assert.equal(enemyTargetable(e),false);
 const hp=e.hp;for(let n=0;n<10;n++)g.damageEnemy(e,1e9,{direct:true});assert.equal(e.hp,hp);assert.equal(g.kills,0);assert.equal(g.score,0);assert.equal(g.defeated.trump,undefined);
 tick(g,14.99);assert.ok(g.enemies.includes(e));tick(g,.01);assert.ok(!g.enemies.includes(e));assert.equal(e.withdrawn,true);
 assert.equal(g.kills,0);assert.equal(g.score,0);assert.ok(g.departures.some(d=>d.exit==='withdraw'));assert.ok(!g.drainEvents().some(e=>e.type==='bossDefeated'));
});

test('retreat threshold is inclusive at 1%, cannot reset after healing and ignores stun',()=>{
 const g=scene(),e=trump(g);e.welfareUsed=true;g.damageEnemy(e,e.hp-e.maxHp*.01,{direct:true});assert.equal(e.retreat.remaining,15);
 e.hp=e.maxHp;e.stun=999;e.trumpKit={strike:0,deploy:0,shift:0};tick(g,15);
 assert.equal(e.withdrawn,true);assert.equal(g.enemies.filter(a=>a.type==='military_claude').length,0);assert.equal(g.airstrikes.length,0);
});

test('pause and time stop freeze bombing, contracts and retreat clocks',()=>{
 const g=scene(),e=trump(g),u=put(g,'qwen',0,0),military=quiet(g.spawnEnemy('military_claude',0));
 castAirstrike(g,e);militaryContract(g,military);e.welfareUsed=true;g.damageEnemy(e,99999,{direct:true});
 const before=[g.time,g.airstrikes[0].remaining,g.militaryWrits[0].age,e.retreat.remaining,u.hp];g.pause();tick(g,2);
 assert.deepEqual([g.time,g.airstrikes[0].remaining,g.militaryWrits[0].age,e.retreat.remaining,u.hp],before);g.resume();g.timeStop=2;tick(g,2);
 assert.deepEqual([g.time,g.airstrikes[0].remaining,g.militaryWrits[0].age,e.retreat.remaining,u.hp],before);
});

test('both passives remain active during retreat and disappear exactly when Trump leaves',()=>{
 const g=scene(),e=trump(g);e.welfareUsed=true;g.damageEnemy(e,999999,{direct:true});const low=put(g,'qwen',0,0);g.damageUnit(low,low.maxHp*.8);assert.equal(low.hp,0);
 const enemy=g.spawnEnemy('sam',1);g.damageEnemy(enemy,9999);close(enemy.hp,enemy.maxHp*.3);tick(g,15);assert.equal(onFieldTrump(g),false);
 const safe=put(g,'qwen',4,0);g.damageUnit(safe,safe.maxHp*.8);close(safe.hp,safe.maxHp*.2);
 const unprotected=g.spawnEnemy('sam',3);g.damageEnemy(unprotected,99999);assert.ok(unprotected.hp<=0);
});

test('a second Trump keeps passives active after the first retreats',()=>{
 const g=scene(),first=trump(g),second=trump(g,4);first.welfareUsed=true;g.damageEnemy(first,99999,{direct:true});tick(g,15);
 assert.ok(!g.enemies.includes(first));assert.equal(onFieldTrump(g),true);const u=put(g,'qwen',0,0);g.damageUnit(u,u.maxHp*.8);assert.equal(u.hp,0);assert.ok(second.hp>0);
});

test('military contracts match three-star Claude: unlimited 125-radius marks and 45 damage after .65s',()=>{
 const g=scene(),military=quiet(g.spawnEnemy('military_claude',2));
 const a=put(g,'qwen',2,7),b=put(g,'qwen',2,8),c=put(g,'qwen',1,8),d=put(g,'qwen',3,8),far=put(g,'qwen',0,8);
 assert.ok(militaryContract(g,military));const writ=g.militaryWrits[0];assert.equal(writ.marks.length,4);assert.equal(writ.damage,45);assert.equal(writ.convert,undefined);
 tick(g,.64);assert.ok([a,b,c,d].every(u=>u.hp===u.maxHp));tick(g,.01);
 for(const u of [a,b,c,d])assert.equal(u.hp,u.maxHp-45);assert.equal(far.hp,far.maxHp);assert.equal(g.allies.length,0);
});

test('military contracts require a target in their own lane and never retarget replacements',()=>{
 const g=scene(),military=quiet(g.spawnEnemy('military_claude',2)),other=put(g,'qwen',1,8);assert.equal(militaryContract(g,military),false);
 const u=put(g,'qwen',2,8);militaryContract(g,military);g.remove(u.row,u.col);const replacement=put(g,'qwen',2,8);
 tick(g,.65);assert.equal(replacement.hp,replacement.maxHp);assert.equal(other.hp,other.maxHp-45);
});

test('military strips converted-enemy shields and supports neighboring Qwen damage reduction',()=>{
 const g=scene(),military=quiet(g.spawnEnemy('military_claude',2)),u=put(g,'qwen',2,8),guard=put(g,'qwen',1,8,3);
 const ally=g.spawnEnemy('sam',2,{allied:true});ally.x=u.x-50;ally.shield=100;const hp=ally.hp;
 militaryContract(g,military);resolveMilitaryWrits(g,.65);assert.equal(ally.shield,0);assert.equal(ally.hp,hp-45);close(u.hp,u.maxHp-45*.75);assert.equal(guard.hp,guard.maxHp-45);
});

test('military basic shots deal 63 damage without advancing; no Harness conversion or language strike',()=>{
 const g=scene(),u=put(g,'qwen',2,7),e=g.spawnEnemy('military_claude',2);e.militaryKit={basic:0,contract:999};g.lang='zh';
 tick(g,.01);const p=g.projectiles.find(p=>p.kind==='militaryClause');assert.ok(p);close(p.damage,63);assert.ok(p.vx<0);assert.equal(p.side,'enemy');tick(g,1);assert.equal(u.hp,u.maxHp-63);assert.equal(e.x,TRUMP_KIT.x);assert.equal(g.allies.length,0);assert.equal(g.harnesses.length,0);
});

test('killed Military Claude leaves its already cast contracts to resolve and can never convert LLMs',()=>{
 const g=scene(),u=put(g,'chatgpt',2,8),e=quiet(g.spawnEnemy('military_claude',2));u.hp=30;militaryContract(g,e);g.damageEnemy(e,999999);tick(g,.65);
 assert.ok(!g.units.includes(u));assert.equal(g.allies.length,0);assert.equal(g.kills,1);assert.equal(g.score,CEO_MAP.military_claude.points);
});

test('Military Claude cannot be converted, pays its defeat score and does not consume Claude Harness cooldown',()=>{
 const g=scene(),u=put(g,'claude',2,0,3);g.equipHarness(u);
 const e=quiet(g.spawnEnemy('military_claude',2));e.hp=1;g.sweep(u,[e]);tick(g,.65);
 assert.equal(CEO_MAP.military_claude.convertible,false);assert.ok(e.hp<=0);assert.equal(g.allies.length,0);
 assert.equal(g.kills,1);assert.equal(g.score,CEO_MAP.military_claude.points);assert.equal(g.harnessFor(u).timer,0);
 const foe=g.spawnEnemy('sam',2);foe.x=600;g.sweep(u,[foe]);g.damageEnemy(foe,999999);
 assert.equal(g.allies.length,1);assert.equal(g.allies[0].type,'sam');assert.ok(g.harnessFor(u).timer>0);
});

test('military spawning enforces one living unit per lane, without extra IDs or replacing the existing soldier',()=>{
 const g=scene(),e=g.spawnEnemy('military_claude',2),id=g.nextId;
 assert.equal(g.spawnEnemy('military_claude',2),e);assert.equal(g.spawnEnemy('military_claude',2,{mini:true}),e);
 assert.equal(g.nextId,id);assert.equal(g.enemies.length,1);
 g.damageEnemy(e,999999);const replacement=g.spawnEnemy('military_claude',2);assert.notEqual(replacement.id,e.id);
 assert.equal(g.enemies.filter(e=>e.type==='military_claude'&&e.row===2&&e.hp>0).length,1);
});

test('multiple Trump deployments share the lane cap, including soldiers surviving a previous commander',()=>{
 const g=scene(),first=trump(g,2),second=trump(g,4);assert.equal(deployMilitary(g,first),4);assert.equal(deployMilitary(g,second),1);
 assert.equal(deployMilitary(g,first),0);assert.equal(deployMilitary(g,second),0);
 first.withdrawn=true;first.hp=0;const third=trump(g,0);assert.equal(deployMilitary(g,third),0);
 for(let row=0;row<5;row++)assert.equal(g.enemies.filter(e=>e.type==='military_claude'&&e.hp>0&&e.row===row).length,1);
});

test('swapping into an occupied origin exchanges garrison slots atomically and never stacks Military Claude',()=>{
 const g=scene(),first=trump(g,2),second=trump(g,4);deployMilitary(g,first);deployMilitary(g,second);
 for(let n=0;n<30;n++){
  const boss=n%2?first:second,from=boss.row;shiftTrump(g,boss);assert.notEqual(boss.row,from);
  for(let row=0;row<5;row++)assert.equal(g.enemies.filter(e=>e.type==='military_claude'&&e.hp>0&&e.row===row).length,1);
 }
});

test('welfare prevents Claude conversion on the protected hit; the second defeat can convert normally',()=>{
 const g=scene();trump(g);const u=put(g,'claude',2,0,3);g.equipHarness(u);const enemy=g.spawnEnemy('sam',2);enemy.x=400;enemy.speed=0;enemy.hp=1;
 // A new aura catches a crossing on damage; set a low HP fixture after spawning.
 g.sweep(u,[enemy]);g.damageEnemy(enemy,99999,{sourceId:u.id});assert.ok(enemy.hp>0);assert.equal(g.allies.length,0);
 g.damageEnemy(enemy,99999,{sourceId:u.id});assert.equal(g.allies.length,1);assert.equal(g.allies[0].allied,true);
});

test('Trump never converts under Claude contracts and retreat does not reset other enemies or their points',()=>{
 const g=scene(),u=put(g,'claude',2,0,3);g.equipHarness(u);const boss=trump(g);boss.welfareUsed=true;g.sweep(u,[boss]);g.damageEnemy(boss,1e9,{sourceId:u.id});
 const survivor=g.spawnEnemy('sam',0);survivor.speed=0;tick(g,15);assert.equal(g.allies.length,0);assert.ok(g.enemies.includes(survivor));assert.equal(g.defeated.trump,undefined);assert.equal(g.score,0);assert.equal(g.phase,'playing');
});

test('dividend attribution counts only damage to the welfare/retreat stopping threshold, not healing or overkill',()=>{
 const g=scene(),u=put(g,'chatgpt'),boss=trump(g),pony=g.spawnEnemy('pony_super',4);pony.superKit={sp:999,monopoly:999,dividend:999};pony.speed=0;g.castDividend(pony);
 boss.armor=0;g.damageEnemy(boss,999999,{sourceId:u.id});close(g.dividends[0].total,boss.maxHp*.9);
 const first=g.dividends[0].total;g.damageEnemy(boss,999999,{sourceId:u.id});close(g.dividends[0].total-first,boss.maxHp*.29);
});

test('bombing, contract, aura and retreat visuals use finite coordinates and restore canvas state',()=>{
 const g=scene(),e=trump(g),u=put(g,'qwen');castAirstrike(g,e);const military=quiet(g.spawnEnemy('military_claude',u.row));militaryContract(g,military);e.welfareUsed=true;g.damageEnemy(e,999999,{direct:true});
 const stack=[],state={globalAlpha:.8},ctx=new Proxy(state,{get(o,k){if(k in o)return o[k];if(k==='save')return ()=>stack.push({...o});if(k==='restore')return ()=>{assert.ok(stack.length);Object.assign(o,stack.pop());};return (...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),String(k));};}});
 for(const t of [0,.5,1.5,14.9]){drawTrumpOrders(ctx,g,t);drawBossBars(ctx,g);for(const type of ['airstrikeBlast','execute','welfare','militaryDeploy','militaryStamp','retreatShield'])for(const age of [0,.4,.8])assert.equal(drawTrumpEffect(ctx,{type,age,duration:.8,x:u.x,y:u.y},t),true);}
 assert.equal(stack.length,0);assert.equal(ctx.globalAlpha,.8);
});
