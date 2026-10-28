import {enemyPower} from './enemy-scaling.js';
import {playAnimation,advanceAnimation} from './animation.js';

export const ELON_KIT=Object.freeze({
 first:Object.freeze({starlink:2,search:5,notes:8,autopilot:11,launch:14,think:20,projection:26,repost:32,trend:36,limit:40}),
 periods:Object.freeze({starlink:22,search:18,notes:30,autopilot:16,launch:18,think:25,projection:28,repost:20,trend:26,limit:24}),
 castGap:1.5,searchWindow:6,searchWarning:2,searchDamage:100,shiftWarning:1.5,charge:2,distance:100,rushSpeed:360,rushDamage:120,
 recovery:3,rageRecovery:4,rageLaunch:12,trailLife:2,trailTick:.5,trailDamage:8,satellites:3,satelliteLife:10,satelliteReduction:.15,
 thinkTime:3,thinkThreshold:160,thinkStagger:2,thinkDamage:48,projectionLife:8,projectionPeriod:2.4,
 repostWarning:1,repostHop:.35,repostRange:160,repostDamage:Object.freeze([80,48,28]),
 trendLife:6,trendBoost:.3,trendStack:.05,trendMax:3,limitLife:5,limitScale:1.4,noteLife:8,noteReduction:.35,noteTypes:3,vulnerability:4
});
const alive=e=>e.hp>0&&!e.withdrawn;
const defenders=g=>[...g.units,...g.allies].filter(alive);
const ownerAlive=(g,id)=>g.enemies.some(e=>e.id===id&&e.type==='elon_super'&&alive(e));
const bosses=g=>g.enemies.filter(e=>e.elonKit&&alive(e));
const yFor=row=>152+row*96;
const liveNote=(g,k)=>k.note&&k.note.ends>g.time+1e-9;
const recovering=(g,k)=>k.recoverUntil>g.time+1e-9;
const label=(g,zh,en,ja)=>g.lang==='zh'?zh:g.lang==='ja'?ja:en;

export function initElon(g,e){
 e.elonKit={timers:{...ELON_KIT.first},action:null,recoverUntil:0,gap:0,note:null,vulnerableUntil:0,trend:null,lastSearch:null};
 g.elonIntel??={damage:[],attacks:[]};g.elonOrders??=[];g.elonTrails??=[];g.elonLimits??=[];
}
function announce(g,e,skill){playAnimation(e,'attack');g.emit('elonCast',{enemy:e.id,skill});}
function hurt(g,u,amount){
 if(!u||u.hp<=0)return;
 const damage=amount*(1-g.shelterFor(u));
 if(u.allied)g.damageAlly(u,damage);else g.damageUnit(u,damage);
 u.flash=.18;playAnimation(u,'hurt');
}
function order(g,e,kind,delay,extra){
 const o={id:g.nextId++,ownerId:e.id,kind,created:g.time,ends:g.time+delay,remaining:delay,fromX:e.x,fromY:e.y-25,...extra};
 g.elonOrders.push(o);return o;
}
export function recordElonAttack(g,u){
 if(!g.elonIntel||!bosses(g).length)return;
 g.elonIntel.attacks.push({id:u.id,time:g.time});
}
export function recordElonDamage(g,e,sourceId,amount,sourceModel=null){
 if(!(amount>0))return;
 const u=g.units.find(u=>u.id===sourceId)||g.departures.find(u=>u.kind==='unit'&&u.id===sourceId);
 const model=sourceModel||u?.model||g.projectiles.find(p=>p.sourceId===sourceId)?.model||(e.burn?.sourceId===sourceId?'grok':null)||(g.sweeps.some(s=>s.unitId===sourceId)?'claude':null);
 if(model&&g.elonIntel&&bosses(g).length)g.elonIntel.damage.push({id:sourceId,time:g.time,amount});
 const k=e.elonKit;if(!k||e.hp<=0)return;
 if(k.action?.kind==='think'){
  k.action.taken+=amount;
  if(k.action.taken+1e-9>=ELON_KIT.thinkThreshold*enemyPower(e)){
   k.action=null;k.recoverUntil=g.time+ELON_KIT.thinkStagger;k.recoveryKind='think';
   g.effect(e.x,e.y-30,'elonInterrupted','#d4b1f4',label(g,'推理中断','INTERRUPTED','推論中断'),.9);
   g.emit('elonInterrupted',{enemy:e.id,skill:'think'});
  }
 }
 if(model&&liveNote(g,k)&&!k.note.models.includes(model)){
  k.note.models.push(model);
  if(k.note.models.length>=ELON_KIT.noteTypes){
   k.note=null;k.vulnerableUntil=g.time+ELON_KIT.vulnerability;
   g.effect(e.x,e.y-48,'elonCorrection','#b9e2c4',label(g,'社区注释：仍可击穿','NOTE: ARMOR IS BREAKABLE','注記：装甲は破壊可能'),1.5);
   g.emit('elonCorrected',{enemy:e.id});
  }
 }
}
export function elonDamageScale(g,e){
 const k=e.elonKit;if(!k)return 1;
 const satellites=recovering(g,k)&&k.recoveryKind==='booster'?0:Math.min(ELON_KIT.satellites,g.enemies.filter(a=>a.type==='starlink_drone'&&a.ownerId===e.id&&alive(a)&&a.expires>g.time+1e-9).length);
 return (1-satellites*ELON_KIT.satelliteReduction)*(liveNote(g,k)?1-ELON_KIT.noteReduction:1)*(k.vulnerableUntil>g.time+1e-9?1.25:1);
}
export function basicIntervalScale(g,u){return g.elonLimits?.some(l=>l.unitId===u.id&&l.ends>g.time+1e-9&&ownerAlive(g,l.ownerId))?ELON_KIT.limitScale:1;}
export function trendAttackScale(g,e){
 return bosses(g).reduce((best,b)=>{const t=b.elonKit.trend;return t&&t.row===e.row&&t.ends>g.time+1e-9?Math.max(best,1+ELON_KIT.trendBoost+t.heat*ELON_KIT.trendStack):best;},1);
}
export function addTrendHeat(g,row){
 for(const e of bosses(g)){const t=e.elonKit.trend;if(t&&t.row===row&&t.ends>g.time+1e-9)t.heat=Math.min(ELON_KIT.trendMax,t.heat+1);}
}
function ranked(g,field){
 const totals=new Map();
 for(const hit of g.elonIntel?.[field]??[])if(hit.time>g.time-ELON_KIT.searchWindow-1e-9)totals.set(hit.id,(totals.get(hit.id)||0)+(hit.amount??1));
 return g.units.filter(alive).sort((a,b)=>(totals.get(b.id)||0)-(totals.get(a.id)||0)||a.id-b.id);
}
function spawnOwned(g,e,type,row,lifetime,x){
 const a=g.spawnEnemy(type,row);a.ownerId=e.id;a.expires=g.time+lifetime;a.x=Math.max(125,Math.min(1000,x));a.y=yFor(row);a.attackTimer=.8;return a;
}
export function castStarlink(g,e){
 const existing=g.enemies.filter(a=>a.type==='starlink_drone'&&a.ownerId===e.id&&alive(a));
 const rows=[0,1,2,3,4].sort((a,b)=>Math.abs(a-e.row)-Math.abs(b-e.row)||a-b);
 for(let n=existing.length;n<ELON_KIT.satellites;n++)spawnOwned(g,e,'starlink_drone',rows[n],ELON_KIT.satelliteLife,e.x-65);
 announce(g,e,'starlink');return ELON_KIT.satellites-existing.length;
}
export function castAutopilot(g,e,after=null){
 const rows=[e.row-1,e.row+1].filter(row=>row>=0&&row<5);
 const load=row=>defenders(g).filter(u=>u.row===row&&u.x<=e.x&&e.x-u.x<330).length;
 rows.sort((a,b)=>load(a)-load(b)||a-b);
 e.elonKit.action={kind:'shift',remaining:ELON_KIT.shiftWarning,duration:ELON_KIT.shiftWarning,from:e.row,row:rows[0],after};
 announce(g,e,'autopilot');return rows[0];
}
function charge(g,e){e.elonKit.action={kind:'charge',remaining:ELON_KIT.charge,duration:ELON_KIT.charge};announce(g,e,'launch');}
export function castLaunch(g,e){if(e.enraged)castAutopilot(g,e,'launch');else charge(g,e);return true;}
export function recoverBooster(g,e){
 const k=e.elonKit;k.action=null;k.recoverUntil=g.time+(e.enraged?ELON_KIT.rageRecovery:ELON_KIT.recovery);k.recoveryKind='booster';
 playAnimation(e,'hurt');g.emit('elonRecovery',{enemy:e.id,duration:e.enraged?ELON_KIT.rageRecovery:ELON_KIT.recovery});
 g.effect(e.x,e.y+10,'elonLanding','#eab26c','',.65);
}
export function interruptElonRocket(g,e){
 if(!e.elonKit||!['charge','rush'].includes(e.elonKit.action?.kind)||e.hp<=0)return false;
 recoverBooster(g,e);g.emit('elonInterrupted',{enemy:e.id,skill:'launch'});return true;
}
export function castSearch(g,e){
 const pool=ranked(g,'damage');if(!pool.length)return false;
 const recent=g.elonIntel.damage.some(d=>d.time>g.time-ELON_KIT.searchWindow-1e-9&&pool.some(u=>u.id===d.id));
 const u=recent?pool[0]:pool.sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y)||a.id-b.id)[0];
 e.elonKit.lastSearch={unitId:u.id,row:u.row,col:u.col};
 order(g,e,'search',ELON_KIT.searchWarning,{row:u.row,col:u.col,x:u.x,y:u.y,damage:ELON_KIT.searchDamage*enemyPower(e)});
 announce(g,e,'search');return true;
}
export function castThink(g,e){e.elonKit.action={kind:'think',remaining:ELON_KIT.thinkTime,duration:ELON_KIT.thinkTime,taken:0,nodes:0};announce(g,e,'think');return true;}
export function castProjections(g,e){
 const rows=[0,1,2,3,4].filter(row=>row!==e.row).sort((a,b)=>Math.abs(a-e.row)-Math.abs(b-e.row)||a-b).slice(0,2);
 for(const row of rows){const count=g.enemies.filter(a=>a.type==='grok_projection'&&a.ownerId===e.id&&a.row===row&&alive(a)).length;if(!count)spawnOwned(g,e,'grok_projection',row,ELON_KIT.projectionLife,e.x-35);}
 announce(g,e,'projection');return rows.length;
}
export function castRepost(g,e){
 const pool=g.units.filter(alive);if(!pool.length)return false;
 const preferred=e.enraged&&pool.find(u=>u.id===e.elonKit.lastSearch?.unitId);
 const first=preferred||pool.sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y)||a.id-b.id)[0];
 const marks=[first];
 while(marks.length<3){const prev=marks.at(-1),next=pool.filter(u=>!marks.includes(u)&&Math.hypot(u.x-prev.x,u.y-prev.y)<=ELON_KIT.repostRange).sort((a,b)=>Math.hypot(a.x-prev.x,a.y-prev.y)-Math.hypot(b.x-prev.x,b.y-prev.y)||a.id-b.id)[0];if(!next)break;marks.push(next);}
 const path=marks.map(u=>({id:u.id,x:u.x,y:u.y}));
 order(g,e,'repost',ELON_KIT.repostWarning,{marks:path,hop:0,power:enemyPower(e),x:first.x,y:first.y});
 announce(g,e,'repost');return path;
}
export function castTrend(g,e){
 const counts=Array(5).fill(0);for(const u of g.units.filter(alive))counts[u.row]++;
 if(!counts.some(Boolean))return false;
 const row=counts.indexOf(Math.max(...counts));e.elonKit.trend={row,ends:g.time+ELON_KIT.trendLife,heat:0};announce(g,e,'trend');return row;
}
export function castLimit(g,e){
 const active=new Set((g.elonIntel?.attacks??[]).filter(h=>h.time>g.time-ELON_KIT.searchWindow-1e-9).map(h=>h.id));
 const units=ranked(g,'attacks').filter(u=>active.has(u.id)).slice(0,2);if(!units.length)return false;
 for(const u of units){const old=g.elonLimits.find(l=>l.ownerId===e.id&&l.unitId===u.id);if(old)old.ends=g.time+ELON_KIT.limitLife;else g.elonLimits.push({ownerId:e.id,unitId:u.id,ends:g.time+ELON_KIT.limitLife});}
 announce(g,e,'limit');return units.map(u=>u.id);
}
export function castNotes(g,e){e.elonKit.note={ends:g.time+ELON_KIT.noteLife,models:[]};announce(g,e,'notes');return true;}
const CASTERS={starlink:castStarlink,search:castSearch,notes:castNotes,autopilot:castAutopilot,launch:castLaunch,think:castThink,projection:castProjections,repost:castRepost,trend:castTrend,limit:castLimit};

function updateAction(g,e,dt){
 const k=e.elonKit,a=k.action;if(!a)return;
 if(a.kind==='rush'){
  const old=e.x,step=Math.min(a.distance,ELON_KIT.rushSpeed*(e.slow>0?(e.slowFactor??.45):1)*dt);
  const next=old-step;
  const blocker=defenders(g).filter(u=>u.row===e.row&&u.x+42>=next&&u.x-28<=old).sort((a,b)=>b.x-a.x)[0];
  e.x=blocker?Math.min(old,blocker.x+42):next;a.distance-=old-e.x;
  if(old>e.x){
   let trail=g.elonTrails.find(t=>t.id===a.trailId);
   if(!trail){trail={id:g.nextId++,ownerId:e.id,row:e.row,x0:e.x,x1:old,ends:g.time+ELON_KIT.trailLife,power:enemyPower(e),nextTick:g.time+ELON_KIT.trailTick};a.trailId=trail.id;g.elonTrails.push(trail);}
   else {trail.x0=e.x;trail.ends=g.time+ELON_KIT.trailLife;}
  }
  if(blocker){hurt(g,blocker,ELON_KIT.rushDamage*enemyPower(e));recoverBooster(g,e);}
  else if(a.distance<=1e-9)recoverBooster(g,e);
  return;
 }
 a.remaining=Math.max(0,a.remaining-dt);
 if(a.kind==='think')a.nodes=Math.min(3,Math.floor(a.duration-a.remaining+1e-9));
 if(a.remaining>1e-9)return;
 if(a.kind==='shift'){
  e.row=a.row;e.y=yFor(e.row);k.action=null;g.emit('laneShift',{enemyType:e.type,from:a.from,to:e.row});
  if(a.after==='launch')charge(g,e);
 }else if(a.kind==='charge'){
  k.action={kind:'rush',distance:ELON_KIT.distance};playAnimation(e,'attack');
 }else if(a.kind==='think'){
  const pool=g.units.filter(alive).sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y)||a.id-b.id).slice(0,1+a.nodes);
  for(const u of pool)order(g,e,'thoughtBolt',.7,{targetId:u.id,x:u.x,y:u.y,damage:ELON_KIT.thinkDamage*enemyPower(e)});
  k.action=null;playAnimation(e,'attack');g.emit('elonThoughtVolley',{enemy:e.id,count:pool.length});
 }
}

// Returns whether the encounter owns movement/attacking for this frame.
export function updateElon(g,e,dt,frozen=false){
 const k=e.elonKit;
 if(!e.enraged&&e.hp<=e.maxHp*.5){
  e.enraged=true;k.timers.launch=Math.min(k.timers.launch,ELON_KIT.rageLaunch);
  g.emit('bossRage',{enemyType:e.type});g.effect(e.x,e.y-35,'elonViral','#dca8ec',label(g,'超级传播','VIRAL MODE','超拡散'),1.3);
 }
 if(k.note&&!liveNote(g,k))k.note=null;
 if(k.trend&&k.trend.ends<=g.time+1e-9)k.trend=null;
 if(frozen)return !!k.action||recovering(g,k);
 k.gap=Math.max(0,k.gap-dt);
 for(const key of Object.keys(k.timers))k.timers[key]-=dt;
 if(recovering(g,k))return true;
 if(k.action){updateAction(g,e,dt);return true;}
 if(k.gap<=1e-9){
  const key=Object.keys(k.timers).filter(key=>k.timers[key]<=1e-9).sort((a,b)=>k.timers[a]-k.timers[b])[0];
  if(key){
   const cast=CASTERS[key](g,e);
   k.timers[key]=cast===false?1:(key==='launch'&&e.enraged?ELON_KIT.rageLaunch:ELON_KIT.periods[key]);
   if(cast!==false)k.gap=ELON_KIT.castGap;
  }
 }
 return !!k.action||recovering(g,k);
}

export function updateElonSummon(g,e,dt){
 if(e.expires<=g.time+1e-9||!ownerAlive(g,e.ownerId)){e.hp=0;e.expired=true;g.depart(e,'enemy');return;}
 if(e.stun>0||e.type==='starlink_drone'){advanceAnimation(e,dt,'idle');return;}
 e.attackTimer-=dt*trendAttackScale(g,e);
 if(e.attackTimer<=1e-9){
  const target=defenders(g).filter(u=>u.row===e.row&&u.x<e.x+20).sort((a,b)=>b.x-a.x)[0];
  if(target){
   g.projectiles.push({id:g.nextId++,hostile:true,ownerId:e.ownerId,kind:'grokProjection',model:e.type,side:'enemy',x:e.x-20,y:e.y-16,row:e.row,targetY:target.y-14,vx:-360,damage:e.damage,age:0,delay:0,color:'#af95da',hit:[],resolved:false});
   playAnimation(e,'attack');e.attackTimer=ELON_KIT.projectionPeriod;
  }else e.attackTimer=.15;
 }
 advanceAnimation(e,dt,'idle');
}

export function cleanupElon(g,e){
 if(!e.elonKit)return;
 g.elonOrders=g.elonOrders.filter(o=>o.ownerId!==e.id);g.elonLimits=g.elonLimits.filter(o=>o.ownerId!==e.id);g.elonTrails=g.elonTrails.filter(o=>o.ownerId!==e.id);
 g.projectiles=g.projectiles.filter(p=>p.ownerId!==e.id);
 for(const a of g.enemies)if(a.ownerId===e.id&&['starlink_drone','grok_projection'].includes(a.type)){a.hp=0;a.expired=true;}
 e.elonKit.action=null;e.elonKit.note=null;e.elonKit.trend=null;
}
export function updateElonOrders(g){
 if(!g.elonIntel)return;
 const cutoff=g.time-ELON_KIT.searchWindow;
 for(const key of ['damage','attacks'])g.elonIntel[key]=g.elonIntel[key].filter(h=>h.time>cutoff-1e-9);
 g.elonLimits=g.elonLimits.filter(l=>l.ends>g.time+1e-9&&ownerAlive(g,l.ownerId)&&g.units.some(u=>u.id===l.unitId&&alive(u)));
 for(const o of [...g.elonOrders]){
  if(!ownerAlive(g,o.ownerId)){o.done=true;continue;}
  o.remaining=Math.max(0,o.ends-g.time);if(o.remaining>1e-9)continue;
  if(o.kind==='search'){
   for(const u of g.units.filter(u=>alive(u)&&u.row===o.row&&u.col===o.col))hurt(g,u,o.damage);
   g.effect(o.x,o.y-20,'elonRay','#78dbec','',.5);o.done=true;
  }else if(o.kind==='thoughtBolt'){
   hurt(g,g.units.find(u=>u.id===o.targetId),o.damage);g.effect(o.x,o.y-20,'elonThoughtHit','#bc9ee8','',.45);o.done=true;
  }else if(o.kind==='repost'){
   const mark=o.marks[o.hop],u=g.units.find(u=>u.id===mark.id&&alive(u));
   if(u){hurt(g,u,ELON_KIT.repostDamage[o.hop]*o.power);g.effect(u.x,u.y-20,'elonRepostHit','#cee2ef',String(o.hop+1),.5);}
   o.hop++;if(o.hop>=o.marks.length)o.done=true;else{o.ends+=ELON_KIT.repostHop;o.remaining=Math.max(0,o.ends-g.time);}
  }
 }
 g.elonOrders=g.elonOrders.filter(o=>!o.done);
 // Segment trails are merged for each owner/lane/tick, so a defender can never
 // take a separate burn from every simulation step of the same rocket rush.
 const hit=new Set();
 for(const trail of g.elonTrails){
  if(!ownerAlive(g,trail.ownerId))continue;
  if(trail.nextTick>g.time+1e-9)continue;
  trail.nextTick+=ELON_KIT.trailTick;
  for(const u of defenders(g).filter(u=>u.row===trail.row&&u.x+25>=trail.x0&&u.x-25<=trail.x1)){
   const key=`${trail.ownerId}:${u.id}`;if(hit.has(key))continue;hit.add(key);hurt(g,u,ELON_KIT.trailDamage*trail.power);
  }
 }
 g.elonTrails=g.elonTrails.filter(t=>t.ends>g.time+1e-9&&ownerAlive(g,t.ownerId));
}
