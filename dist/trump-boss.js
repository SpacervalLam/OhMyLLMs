import {enemyPower} from './enemy-scaling.js';
import {MODEL_MAP} from './data.js';
import {BASIC_ATTACKS} from './ranks.js';
import {playAnimation,advanceAnimation} from './animation.js';
import {pickDistinct} from './super-boss.js';
import {trendAttackScale} from './elon-boss.js';

export const TRUMP_KIT=Object.freeze({x:1055,strikeFirst:5,strikePeriod:14,strikeWarning:1.5,strikeDamage:150,strikeTiles:5,deployFirst:2,deployPeriod:24,shiftFirst:8,shiftPeriod:10,execute:.25,welfare:.1,recover:.3,retreat:.01,retreatTime:15});
export const onFieldTrump=g=>g.enemies.some(e=>e.type==='trump'&&!e.allied&&!e.withdrawn&&e.hp>0);
export const militaryInLane=(g,row)=>[...g.enemies,...g.allies].find(a=>a.type==='military_claude'&&a.hp>0&&a.row===row);

export function executeLowHP(g,u){
 if(u.hp<=0||u.hp>=u.maxHp*TRUMP_KIT.execute||!onFieldTrump(g))return false;
 u.hp=0;g.effect(u.x,u.y-16,'execute','#ba5252','',.7);g.emit('execution',{unit:u.id,model:u.model});return true;
}
export function enforceExecution(g){for(const u of g.units)executeLowHP(g,u);}

export function beginRetreat(g,e){
 if(e.retreat)return;
 e.hp=Math.max(e.maxHp*TRUMP_KIT.retreat,e.hp);e.retreat={ends:g.time+TRUMP_KIT.retreatTime,remaining:TRUMP_KIT.retreatTime};
 e.burn=null;e.slow=0;e.stun=0;e.knockback=null;e.invuln=TRUMP_KIT.retreatTime;
 playAnimation(e,'idle');g.effect(e.x,e.y-18,'retreatShield','#e4c679','',1);g.emit('strategicRetreat',{enemy:e.id,duration:TRUMP_KIT.retreatTime});
}

// Called at the HP threshold before a hit can register a kill or a conversion.
export function resolveTrumpThreshold(g,e,impactHP){
 const protectedNow=onFieldTrump(g);
 let stopped=impactHP;
 if(protectedNow&&!e.welfareUsed&&impactHP<=e.maxHp*TRUMP_KIT.welfare+1e-9){
  stopped=Math.min(e.hp,e.maxHp*TRUMP_KIT.welfare);e.welfareUsed=true;e.hp=e.maxHp*TRUMP_KIT.recover;
  g.effect(e.x,e.y,'welfare','#8cc8a0','30%',.9);g.emit('welfare',{enemy:e.id,enemyType:e.type});
 }else{
  if(e.type==='trump'&&!e.allied&&impactHP<=e.maxHp*TRUMP_KIT.retreat+1e-9){stopped=Math.min(e.hp,e.maxHp*TRUMP_KIT.retreat);e.hp=e.maxHp*TRUMP_KIT.retreat;beginRetreat(g,e);}
  else e.hp=impactHP;
 }
 return Math.max(0,stopped);
}

export function deployMilitary(g,e){
 let count=0;
 for(let row=0;row<5;row++){
  if(row===e.row)continue;
  if(militaryInLane(g,row))continue;
  const unit=g.spawnEnemy('military_claude',row);unit.ownerId=e.id;count++;
  g.effect(unit.x,unit.y-12,'militaryDeploy','#b2bc81','',.9);
 }
 playAnimation(e,'attack');g.emit('militaryDeployment',{enemy:e.id,count});return count;
}

export function shiftTrump(g,e){
 const guards=g.enemies.filter(a=>a.type==='military_claude'&&a.ownerId===e.id&&!a.allied&&a.hp>0&&a.row!==e.row);
 const guard=pickDistinct(guards,1,()=>g.random())[0],from=e.row;
 if(guard){
  const to=guard.row,occupant=militaryInLane(g,from);
  // Multiple commanders share a global lane limit. Exchange existing guards
  // atomically so the guard following Trump never overlaps another garrison.
  if(occupant){occupant.row=to;occupant.y=104+to*96+48;occupant.x=TRUMP_KIT.x;}
  guard.row=from;guard.y=104+from*96+48;guard.x=TRUMP_KIT.x;e.row=to;
 }
 else e.row=pickDistinct([0,1,2,3,4].filter(row=>row!==from),1,()=>g.random())[0];
 e.x=TRUMP_KIT.x;e.y=104+e.row*96+48;
 playAnimation(e,'attack');g.effect(e.x,e.y-20,'laneShift','#a7b3d3','',.7);
 if(guard)g.effect(guard.x,guard.y-20,'laneShift','#cfa679','',.7);
 g.emit('laneShift',{enemyType:e.type,from,to:e.row,swapped:guard?.id});
}

export function castAirstrike(g,e){
 const tiles=new Map(g.units.filter(u=>u.hp>0).map(u=>[`${u.row}:${u.col}`,u]));
 const targets=pickDistinct([...tiles.values()],TRUMP_KIT.strikeTiles,()=>g.random());
 if(!targets.length)return 0;
 for(const u of targets)g.airstrikes.push({id:g.nextId++,ownerId:e.id,row:u.row,col:u.col,x:u.x,y:u.y,ends:g.time+TRUMP_KIT.strikeWarning,remaining:TRUMP_KIT.strikeWarning,damage:TRUMP_KIT.strikeDamage*enemyPower(e)});
 playAnimation(e,'attack');g.emit('militaryStrike',{enemy:e.id,count:targets.length});return targets.length;
}

export function updateTrump(g,e,dt){
 e.x=TRUMP_KIT.x;e.speed=0;e.knockback=null;
 if(e.retreat){advanceAnimation(e,dt,'idle');return;}
 if(e.stun>0){advanceAnimation(e,dt,'idle');return;}
 const kit=e.trumpKit;for(const key of ['strike','deploy','shift'])kit[key]-=dt;
 if(kit.deploy<=1e-9){kit.deploy=TRUMP_KIT.deployPeriod;deployMilitary(g,e);}
 if(kit.shift<=1e-9){kit.shift=TRUMP_KIT.shiftPeriod;shiftTrump(g,e);}
 if(kit.strike<=1e-9){kit.strike=TRUMP_KIT.strikePeriod;castAirstrike(g,e);}
 advanceAnimation(e,dt,'idle');
}

export function updateTrumpOrders(g){
 for(const e of g.enemies){
  if(!e.retreat||e.withdrawn)continue;
  e.retreat.remaining=Math.max(0,e.retreat.ends-g.time);
  if(e.retreat.remaining>1e-9)continue;
  e.withdrawn=true;g.departures.push({...e,kind:'enemy',exit:'withdraw',departureAge:0});e.hp=0;
  g.emit('strategicWithdraw',{enemy:e.id});
 }
 const pending=[];
 for(const strike of g.airstrikes){
  strike.remaining=Math.max(0,strike.ends-g.time);if(strike.remaining>1e-9){pending.push(strike);continue;}
  // Orders target tiles, not identities. Replacing a unit does not move a blast.
  for(const u of g.units.filter(u=>u.hp>0&&u.row===strike.row&&u.col===strike.col)){
   const shelter=g.shelterFor(u);g.damageUnit(u,strike.damage*(1-shelter));playAnimation(u,'hurt');
  }
  g.effect(strike.x,strike.y-12,'airstrikeBlast','#efaa62','',.85);
 }
 g.airstrikes=pending;
}

export function militaryContract(g,e){
 const pool=e.allied?g.enemies.filter(a=>a.hp>0&&!a.retreat&&a.raid?.phase!=='warning'): [...g.units,...g.allies].filter(u=>u.hp>0);
 const direction=e.allied?1:-1;
 const lane=pool.filter(u=>u.row===e.row&&(u.x-e.x)*direction>-20).sort((a,b)=>direction>0?a.x-b.x:b.x-a.x);
 if(!lane.length)return false;
 const anchor=lane[0],marks=pool.filter(u=>(u.x-e.x)*direction>-20&&Math.hypot(u.x-anchor.x,u.y-anchor.y)<=125).map(u=>({id:u.id,x:u.x,y:u.y,allied:!!u.allied}));
 g.militaryWrits.push({id:g.nextId++,ownerId:e.id,side:e.allied?'ally':'enemy',age:0,writ:.65,damage:45*enemyPower(e),marks,resolved:false});
 playAnimation(e,'attack');return true;
}
export function updateMilitary(g,e,dt){
 e.knockback=null;if(!e.allied)e.x=TRUMP_KIT.x;
 if(e.stun>0){advanceAnimation(e,dt,'idle');return;}
 e.militaryKit??={basic:.5,contract:.5};const kit=e.militaryKit,scale=e.abilityScale??1;
 kit.basic-=dt*trendAttackScale(g,e);kit.contract-=dt;
 if(kit.contract<=1e-9)kit.contract=militaryContract(g,e)?MODEL_MAP.claude.period/scale:.15;
 if(kit.basic<=1e-9){
  const pool=e.allied?g.enemies.filter(a=>a.hp>0&&!a.retreat&&a.raid?.phase!=='warning'):[...g.units,...g.allies].filter(u=>u.hp>0);
  const direction=e.allied?1:-1,target=pool.filter(u=>u.row===e.row&&(u.x-e.x)*direction>-20).sort((a,b)=>direction>0?a.x-b.x:b.x-a.x)[0];
  if(target){g.projectiles.push({id:g.nextId++,hostile:true,kind:'militaryClause',model:e.type,side:e.allied?'ally':'enemy',x:e.x+direction*24,y:e.y-16,row:e.row,targetY:target.y-14,vx:BASIC_ATTACKS.claude.speed*direction,damage:BASIC_ATTACKS.claude.damage*1.8*enemyPower(e),age:0,delay:0,color:'#d4a170',hit:[],resolved:false});playAnimation(e,'attack');kit.basic=BASIC_ATTACKS.claude.period/scale;}else kit.basic=.15;
 }
 advanceAnimation(e,dt,'idle');
}

export function resolveMilitaryWrits(g,dt){
 for(const writ of g.militaryWrits){
  writ.age+=dt;
  const pool=writ.side==='ally'?g.enemies:[...g.units,...g.allies];
  for(const mark of writ.marks){const u=pool.find(u=>u.id===mark.id&&u.hp>0);if(u){mark.x=u.x;mark.y=u.y;}}
  if(writ.resolved||writ.age+1e-9<writ.writ)continue;writ.resolved=true;
  for(const mark of writ.marks){
   const u=pool.find(u=>u.id===mark.id&&u.hp>0);if(!u)continue;
   if(writ.side==='ally'){if(u.raid?.phase==='warning'||u.retreat)continue;u.shield=0;g.damageEnemy(u,writ.damage);}
   else {u.shield=0;const damage=writ.damage*(1-g.shelterFor(u));if(u.allied)g.damageAlly(u,damage);else g.damageUnit(u,damage);}
   g.effect(u.x,u.y-18,'militaryStamp','#bd825c','',.6);
  }
 }
 g.militaryWrits=g.militaryWrits.filter(w=>w.age<1.2);
}
