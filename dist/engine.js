import { MODEL_MAP, CEO_MAP, MINI_POINTS } from './data.js';
import {starsOf,skillScale,STAR_COPIES,BASIC_ATTACKS,HARNESSES,harnessOptions,DEEPSEEK_INCOME,harnessCost,DEEPSEEK_HARNESS} from './ranks.js';
import {playAnimation,advanceAnimation,loopingFrame,ANIMATION_STATES} from './animation.js';
import {SUPER_KIT,pickDistinct,bossForWave} from './super-boss.js';
import {enemyCycleScale,enemyPower,scaleEnemyCycle} from './enemy-scaling.js';
import {TRUMP_KIT,militaryInLane,executeLowHP,enforceExecution,resolveTrumpThreshold,updateTrump,updateTrumpOrders,updateMilitary,resolveMilitaryWrits} from './trump-boss.js';
import {initElon,elonDamageScale,recordElonDamage,recordElonAttack,basicIntervalScale,trendAttackScale,addTrendHeat,updateElon,updateElonOrders,updateElonSummon,interruptElonRocket,cleanupElon} from './elon-boss.js';

export const FIELD = Object.freeze({width:1120,height:650,x:100,y:104,cols:9,rows:5,cw:100,ch:96});
export const GROK_CONTROL=Object.freeze({direct:12,splash:6,duration:.32,recovery:4.5,armoredScale:.6});
// ChatGPT's drawn cast drawing is frame 3 of the attack row. The visible channel
// cycles that drawing and its two neighbours (wind-up → beam → recoil), so a
// 1.45-second laser keeps moving instead of holding one still.
export const BEAM_CAST=Object.freeze({frame:3,spread:1});
// GLM's patch is a pure control effect: two tiles of frozen lawn, no damage at
// all. Its worth has to come from the slow and from the Grok melt, never from a
// damage column in the economy table.
export const GLM_FREEZE=Object.freeze({tiles:2,landing:.4,lifetime:3.4,slow:3});
// Grok's burn: three seconds of direct damage in half-second ticks.
export const GROK_BURN=Object.freeze({damage:2,every:.5,duration:3});
// Frost + fire cancel each other and the remaining burn vents at one and a half.
export const MELT=Object.freeze({scale:1.5});
// MiniMax's clapperboard is a film strip, not an impact: it runs out to the right
// edge, turns around, and rewinds all the way to the left of the board. Every
// enemy it passes is paid once per pass, so the return leg is what covers the
// CEOs that already walked past her. The rewind leg is discounted, and the
// neighbouring lanes only take a share — the strip is wide, the damage is not.
export const MINIMAX_REWIND=Object.freeze({speed:700,out:1,back:.7,rowFalloff:.6,reach:28});
// Claude Code's contract is a recruitment, not a copy. The CEO keeps its identity
// but arrives at half strength and the clause cannot be reused for twice as long.
export const CONTRACT=Object.freeze({cooldown:200,scale:.5});
export const PONY_RAID=Object.freeze({warning:3,steal:8,descent:.45});
export const enemyTargetable=e=>e.hp>0&&!e.retreat&&!e.withdrawn&&e.raid?.phase!=='warning';


const WAVE_TYPES = [
 ['sam','sam','sam','sam','elon','sam'],
 ['sam','dario','runner','elon','medic','dario','elon','runner','sam'],
 ['sam','mark','bulwark','elon','liang','medic','jack','dario','runner','sam','liang','ipo'],
 ['runner','jensen','pony','elon','banner','liang','medic','elon','jensen','bulwark','mark','jack','sam','runner','sam','dario'],
 ['dario','jensen','runner','banner','liang','medic','pony','jensen','mark','bulwark','jack','elon','sam','jensen','banner','dario','runner','liang','medic','bulwark'],
 ['runner','bulwark','jensen','elon','banner','liang','pony','runner','medic','mark','jack','sam','jensen','elon','banner','dario','medic','elon','jensen','mark','runner','bulwark','elon','overlord']
];
export const WAVE_PACING=Object.freeze({intervals:[5.8,4.8,4,3.3,2.8,2.35],deadlines:[66,64,62,62,64],breather:10});
export function waveInterval(wave){return WAVE_PACING.intervals[wave-1]??Math.max(.9,2.35*Math.pow(.96,wave-6));}
export function waveTypes(wave,random=Math.random){
 if(WAVE_TYPES[wave-1])return [...WAVE_TYPES[wave-1]];
 const pool=['sam','dario','elon','jensen','mark','liang','runner','medic','bulwark','banner','pony','jack'];
 const count=Math.min(48,24+Math.floor((wave-6)*1.5));
 const types=Array.from({length:count},()=>pool[Math.floor(random()*pool.length)]);
 if(bossForWave(wave))types[types.length-1]=bossForWave(wave);
 return types;
}
// Distance from a point to a segment — Gemini's star link damages everything the
// line between its two impact points crosses.
function pointSegDist(px,py,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy||1;
 const t=Math.max(0,Math.min(1,((px-a.x)*dx+(py-a.y)*dy)/len2));
 return Math.hypot(px-(a.x+t*dx),py-(a.y+t*dy));
}

export class GardenGame {
 constructor({lang='zh',difficulty='normal',eggs=true,seed=Date.now(),starter=true,presidentMode=false}={}) {
  this.lang=lang; this.difficulty=difficulty; this.eggs=eggs;this.presidentMode=!!presidentMode;
  this.seed=seed>>>0; this.phase='ready'; this.time=0; this.tickTime=0;
  this.tokens=difficulty==='easy'?250:difficulty==='hard'?150:200;
  this.units=[]; this.enemies=[]; this.projectiles=[]; this.coins=[]; this.effects=[];this.departures=[];
  // Ground patches (GLM frost), lane sweeps (Claude clauses) and star-link
  // bookkeeping (Gemini) live beside projectiles as their own delivery shapes.
  this.zones=[]; this.sweeps=[]; this.links={};this.harnesses=[];this.timeStop=0;this.allies=[];
  this.cooldowns={}; this.events=[]; this.kills=0; this.score=0;this.defeated={};this.wave=0; this.totalWaves=Infinity;
  this.mowers=Array(5).fill(true); this.queue=[]; this.spawnTimer=0;this.waveCleared=false;
  this.airdropTimer=6; this.nextWaveTimer=null; this.nextId=1;
  this.monopolyRemaining=0;this.systemPaused=false;this.dividends=[];this.airstrikes=[];this.militaryWrits=[];
  this.elonOrders=[];this.elonTrails=[];this.elonLimits=[];this.elonIntel={damage:[],attacks:[]};
  if(starter)for(const [model,row,col] of [['deepseek',2,0],['chatgpt',2,2],['qwen',2,5]]){
   const m=MODEL_MAP[model];this.units.push({id:this.nextId++,model,row,col,x:FIELD.x+col*100+50,y:FIELD.y+row*96+48,hp:m.hp,maxHp:m.hp,stars:1,copies:1,invested:0,age:0,attackTimer:.5,produceTimer:m.period,shots:0,strike:false,stun:0,flash:0});
  }
 }
 random(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296;}
 emit(type,detail={}){this.events.push({type,...detail});}
 drainEvents(){return this.events.splice(0);}
 start(){if(this.phase!=='ready')return false;this.phase='playing';this.nextWaveTimer=5;this.emit('start');return true;}
 get controlsLocked(){return this.monopolyRemaining>0&&['playing','paused'].includes(this.phase);}
 pause({system=false}={}){if(this.controlsLocked&&!system)return false;if(this.phase==='playing'){this.phase='paused';this.systemPaused=system;return true;}return false;}
 resume({system=false}={}){if(this.controlsLocked&&!system)return false;if(this.phase==='paused'){this.phase='playing';this.systemPaused=false;return true;}return false;}
 get availableTokens(){return this.presidentMode?Infinity:this.tokens;}
 setPresidentMode(on){if(this.controlsLocked)return false;this.presidentMode=!!on;return true;}
 setLanguage(lang){if(this.controlsLocked)return false;this.lang=lang;this.refreshStrikes();return true;}
 setEggs(on){if(this.controlsLocked)return false;this.eggs=on;this.refreshStrikes();return true;}
 refreshStrikes(){
  for(const u of this.units.filter(u=>u.model==='claude')){
   const strike=this.eggs&&this.lang==='zh'&&u.age>=1;
   if(u.strike!==strike){u.strike=strike;playAnimation(u,strike?'special':'idle');this.emit(strike?'strike':'resumeClaude',{unit:u.id});}
  }
 }
 plant(model,row,col){
  if(this.controlsLocked)return {ok:false,reason:'monopoly'};
  if(!['ready','playing'].includes(this.phase))return {ok:false,reason:'notPlaying'};
  const m=MODEL_MAP[model];
  if(!m||!Number.isInteger(row)||!Number.isInteger(col)||row<0||row>=5||col<0||col>=9)return {ok:false,reason:'empty'};
  const existing=this.units.find(u=>u.row===row&&u.col===col);
  if(existing&&existing.model!==model)return {ok:false,reason:'occupied'};
  if(existing&&starsOf(existing)===3)return {ok:false,reason:'maxStars'};
  // Preparation is a free build phase: models answer instantly, so no recharge.
  const preparing=this.phase==='ready';
  if(!preparing&&(this.cooldowns[model]||0)>0)return {ok:false,reason:'cooldown'};
  if(this.availableTokens<m.cost)return {ok:false,reason:'lackTokens'};
  if(!this.presidentMode)this.tokens-=m.cost;if(!preparing)this.cooldowns[model]=m.cooldown;
  if(existing){
   existing.copies=(existing.copies||STAR_COPIES[starsOf(existing)])+1;
   existing.invested=(existing.invested??m.cost)+(this.presidentMode?0:m.cost);
   const before=starsOf(existing),after=existing.copies>=7?3:existing.copies>=3?2:1;
   existing.stars=after;
   if(after>before){
    const hp=existing.hp/existing.maxHp;existing.maxHp=Math.round(m.hp*([0,1,1.8,3][after]));existing.hp=Math.max(1,Math.round(existing.maxHp*hp));
    existing.produceTimer=Math.min(existing.produceTimer??m.period,m.period);existing.attackTimer=.35;
    this.effect(existing.x,existing.y,'rankUp',m.color,String(after),1.25);
    this.emit('upgrade',{model,unit:existing.id,stars:after,row,col});this.refreshStrikes();
   }else this.effect(existing.x,existing.y,'merge',m.color,'',.55);
   this.emit('merge',{model,unit:existing.id,copies:existing.copies,stars:after});addTrendHeat(this,row);
   return {ok:true,unit:existing,merged:true,upgraded:after>before};
  }
  const u={id:this.nextId++,model,row,col,x:FIELD.x+col*100+50,y:FIELD.y+row*96+48,hp:m.hp,maxHp:m.hp,stars:1,copies:1,invested:this.presidentMode?0:m.cost,age:0,attackTimer:0.5,produceTimer:m.period,shots:0,strike:false,stun:0,flash:0};
  this.units.push(u);this.emit('plant',{unit:u.id,model,row,col});this.effect(u.x,u.y,'plant',m.color);addTrendHeat(this,row);
  return {ok:true,unit:u};
 }
 remove(row,col){
  if(this.controlsLocked)return {ok:false,reason:'monopoly'};
  if(!['ready','playing'].includes(this.phase))return {ok:false,reason:'notPlaying'};
  const i=this.units.findIndex(u=>u.row===row&&u.col===col);
  if(i<0)return {ok:false,reason:'empty'};
  const u=this.units.splice(i,1)[0];this.tokens+=Math.floor((u.invested??MODEL_MAP[u.model].cost)/2);this.depart(u,'unit');
  this.effect(u.x,u.y,'plant','#d8b56f');this.emit('remove',{model:u.model});return {ok:true};
 }
 equipHarness(u,variant=null){
  if(this.controlsLocked)return {ok:false,reason:'monopoly'};
  if(!['ready','playing','paused'].includes(this.phase))return {ok:false,reason:'notPlaying'};
  if(!this.units.includes(u)||u.hp<=0)return {ok:false,reason:'empty'};
  if(starsOf(u)!==3)return {ok:false,reason:'requiresThreeStars'};
  if(this.harnessFor(u))return {ok:false,reason:'alreadyEquipped'};
  const cost=harnessCost(MODEL_MAP[u.model]);
  if(this.availableTokens<cost)return {ok:false,reason:'lackTokens',required:cost};
  if(!this.presidentMode){this.tokens-=cost;u.invested=(u.invested||0)+cost;}
  const option=harnessOptions(MODEL_MAP[u.model]).find(o=>o.variant===variant)||HARNESSES[u.model];
  const h={unitId:u.id,row:u.row,col:u.col,model:u.model,stars:3,age:0,timer:0,cycles:0,...option};
  this.harnesses.push(h);this.emit('equipHarness',{unit:u.id,model:u.model,cost,variant:h.variant,name:h.name});
  if(u.model==='chatgpt'){
   this.resetQuota(u);h.timer=10;
  }
  return {ok:true,harness:h};
 }
 harnessFor(u){if(starsOf(u)!==3||u.hp<=0||!this.units.includes(u))return null;return this.harnesses.find(h=>h.unitId===u.id);}
 resetQuota(u){
  this.cooldowns.chatgpt=0;u.attackTimer=0;u.basicTimer=0;
  if(u.beam){u.beam.charge=0;u.beam.fire=1.45;}
  this.effect(u.x,u.y,'quotaReset','#a4eedc',this.lang==='zh'?'额度重置':this.lang==='ja'?'上限リセット':'Quota reset',1.2);
 }
 reviveNearby(u){
  const healer=this.units.find(k=>k.model==='kimi'&&k.hp>0&&k.id!==u.id&&Math.abs(k.row-u.row)<=1&&Math.abs(k.col-u.col)<=1&&this.harnessFor(k)?.timer<=0);
  if(!healer)return false;
  this.harnessFor(healer).timer=60;u.hp=u.maxHp;u.flash=.3;playAnimation(u,'idle');playAnimation(healer,'attack');
  this.effect(u.x,u.y,'heal','#c4b6f1','Kimi Code',1.2);
  this.effects.push({x:healer.x,y:healer.y-10,type:'link',tx:u.x,ty:u.y-10,color:'#c4b6f1',age:0,duration:1.2});
  return true;
 }
 basicAttack(u,lane){
  if(u.model==='qwen'){
   if(starsOf(u)===1)return false;
   const left=FIELD.x+u.col*FIELD.cw,right=left+FIELD.cw*1.5;
   const target=this.enemies.filter(e=>enemyTargetable(e)&&e.row===u.row&&e.x>=left&&e.x<=right).sort((a,b)=>a.x-b.x)[0];
   if(!target)return false;
   recordElonAttack(this,u);
   this.damageEnemy(target,BASIC_ATTACKS.qwen.damage*(starsOf(u)===3?1.8:1.35),{sourceId:u.id});
   u.flash=.2;playAnimation(u,'attack');this.emit('shoot',{model:u.model});
   this.skillEffect('qwen',target.x,target.y-14,'skillImpact',{melee:true,stars:starsOf(u),duration:.3});
   return true;
  }
  const a=BASIC_ATTACKS[u.model];if(a.damage<=0||!lane.length)return false;
  this.fire(u,lane[0],{damage:a.damage*(starsOf(u)===3?1.8:starsOf(u)===2?1.35:1),basic:true});
  if(u.model==='glm'&&starsOf(u)>1){u.freezeBasics=(u.freezeBasics||0)+1;if(u.freezeBasics>=4)this.attack(u);}
  if(u.model==='chatgpt'&&starsOf(u)===2){u.beamBasics=(u.beamBasics||0)+1;if(u.beamBasics>=3)this.attack(u);}
  return true;
 }
 collect(id,{automatic=false}={}){if(this.controlsLocked&&!automatic)return false;const i=this.coins.findIndex(c=>c.id===id);if(i<0)return false;const c=this.coins.splice(i,1)[0];this.tokens+=c.value;this.emit('collect',{value:c.value});this.effect(c.x,c.y,'token','#e9ba55',`+${c.value}`);return true;}
 coin(x,y,value=25,falling=false,arc=null){this.coins.push({id:this.nextId++,x,y:falling?-20:y,targetY:y,value,age:0,falling,arc:arc?{...arc,t:arc.t??0}:null});}
 effect(x,y,type,color,text='',duration=null){this.effects.push({x,y,type,color,text,age:0,duration:duration??(type==='blast'?0.55:type==='mower'?1.6:1)});}
 skillEffect(model,x,y,type='skillCast',extra={}){
  this.effects.push({model,x,y,type,age:0,duration:type==='skillCast'?1.05:type==='skillGuard'?.6:.8,...extra});
 }
 spawnEnemy(type,row,options={}){
  if(type==='military_claude'){const existing=militaryInLane(this,row);if(existing)return existing;}
  const c=CEO_MAP[type],scale=this.difficulty==='easy'?.8:this.difficulty==='hard'?1.1:1;
  const growth=enemyCycleScale(this.wave);
  const e={id:this.nextId++,type,row,x:1055+(options.offset||0),y:FIELD.y+row*96+48,hp:Math.round(c.hp*scale*growth),maxHp:Math.round(c.hp*scale*growth),cycleScale:growth,cycleBaseHp:c.hp*scale,speed:c.speed*growth*(this.difficulty==='hard'?1.05:1),damage:c.damage*growth,armor:(c.armor||0)*growth,shield:(c.shield||0)*growth,boss:!!c.boss&&!options.mini,enraged:false,stun:0,age:0,slow:0,attackTimer:0,abilityTimer:0,boost:0,flash:0,invuln:0,mini:!!options.mini,shift:c.shift?{taken:0,cd:0,count:0,threshold:c.shift.damage,cooldown:c.shift.cooldown,max:c.shift.max}:null,prospectusTimer:c.prospectus?8:0};
  if(e.mini){e.cycleBaseHp=70;e.hp=e.maxHp=Math.round(70*growth);e.speed=21*growth;e.damage=12*growth;}
  // 'walk' keeps the simulated gait clock running (bob/sway/tilt on the idle
  // opening pose); stagger the phase so a wave does not step in lockstep.
  if(options.allied)e.allied=true;
  playAnimation(e,'walk');e.animation.time=e.id*.067;(e.allied?this.allies:this.enemies).push(e);
  if(c.ability==='abduct'){
   e.damage=0;e.speed=0;
   if(!e.allied){e.raid={phase:'waiting',remaining:0,elapsed:0};this.lockPonyTarget(e,options.raidTarget);}
  }
  if(c.ability==='super')e.superKit={sp:6,monopoly:12,dividend:8};
  if(c.anchored){e.x=TRUMP_KIT.x;e.speed=0;playAnimation(e,'idle');}
  if(c.ability==='trump'){
   e.trumpKit={strike:TRUMP_KIT.strikeFirst,deploy:TRUMP_KIT.deployFirst,shift:TRUMP_KIT.shiftFirst};
   for(const unit of this.enemies)if(unit.hp>0&&unit.hp<=unit.maxHp*TRUMP_KIT.welfare)resolveTrumpThreshold(this,unit,unit.hp);
   enforceExecution(this);
  }
  if(c.ability==='military')e.militaryKit={basic:.5,contract:.5};
  if(c.ability==='elon_super')initElon(this,e);
  if(e.boss&&!e.allied)this.emit('bossSpawn',{enemyType:type});return e;
 }
 beginWave(){
  this.wave++;this.waveCleared=false;
  for(const enemy of this.enemies)scaleEnemyCycle(enemy,enemyCycleScale(this.wave));
  let types=waveTypes(this.wave,()=>this.random());
  if(this.difficulty==='hard')types.push('sam','elon');
  if(this.difficulty==='easy'&&this.wave>1){const removable=types.findLastIndex(type=>!CEO_MAP[type].boss);types.splice(removable,1);}
  const deadline=WAVE_PACING.deadlines[this.wave-1]??Math.max(52,64-(this.wave-6)*.4);
  this.nextWaveTimer=Math.max(deadline,types.length*waveInterval(this.wave)+2)*(this.difficulty==='easy'?1.12:this.difficulty==='hard'?.96:1);
  const opening=[2,1,3,2,0,4],rotation=this.wave===1?0:Math.floor(this.random()*5);
  const lanes=this.wave===1?opening:[0,1,2,3,4,0,2,4,1,3];
  this.queue.push(...types.map((type,i)=>({type,row:(lanes[i%lanes.length]+rotation)%5})));
  this.spawnTimer=Math.min(this.spawnTimer||1.1,1.1);this.tokens+=this.wave===1?0:40;
  this.emit('wave',{wave:this.wave});
 }
 nextWave(){if(this.controlsLocked||this.phase!=='playing'||this.nextWaveTimer===null)return false;this.tokens+=25;this.beginWave();return true;}
 damageEnemy(e,damage,{direct=false,react=true,sourceId=null,sourceModel=null}={}){
  if(!enemyTargetable(e)||e.invuln>0)return;
  const hpBefore=Math.max(0,e.hp),defenseBefore=(e.shield||0)+(e.armor||0);
  let remaining=Math.max(0,damage)*elonDamageScale(this,e);
  if(!direct)for(const kind of ['shield','armor']){const blocked=Math.min(e[kind]||0,remaining);e[kind]-=blocked;remaining-=blocked;}
  const impactHP=resolveTrumpThreshold(this,e,e.hp-remaining);
  if(react&&!e.retreat){if(e.flash<=0)playAnimation(e,'hurt');e.flash=.14;}
  const dealt=Math.max(0,hpBefore-impactHP)+Math.max(0,defenseBefore-(e.shield||0)-(e.armor||0));
  this.recordDividendDamage(sourceId,dealt);
  recordElonDamage(this,e,sourceId,dealt,sourceModel);
  if(e.shift&&damage>0)e.shift.taken+=damage;
  if(e.hp<=0){cleanupElon(this,e);this.kills++;this.tokens+=e.mini?5:CEO_MAP[e.type].reward??10;if(e.type==='liang'&&!e.mini)this.tokens+=40;
   const points=e.mini?MINI_POINTS:CEO_MAP[e.type].points;this.score+=points;
   const record=this.defeated[e.type]??={count:0,points:0};record.count++;record.points+=points;
   this.effect(e.x,e.y-35,'score',e.boss?'#b45b56':'#8d743e',`+${points}`,1.1);
   this.emit('kill',{enemyType:e.type,points,score:this.score,mini:e.mini});
   if(e.boss)this.emit('bossDefeated',{enemyType:e.type,reward:CEO_MAP[e.type].reward});
   // The contract binds rank-and-file capital, never a listing BOSS: a boss
   // defeat must still pay its bounty and go through the normal departure.
   const contract=!e.boss&&CEO_MAP[e.type].convertible!==false&&this.sweeps.find(s=>s.convert&&(!s.resolved||s.resolving)&&s.marks.some(m=>m.id===e.id)&&this.harnesses.some(h=>h.unitId===s.unitId&&h.timer<=0));
   const contracted=!!contract;
   if(contracted){
    this.harnesses.find(h=>h.unitId===contract.unitId).timer=CONTRACT.cooldown;
    const k=CONTRACT.scale,base=CEO_MAP[e.type];
    const ally={...e,id:this.nextId++,allied:true,hp:Math.ceil(e.maxHp*k),damage:Math.round(e.damage*k),speed:e.speed*k,armor:Math.floor((base.armor||0)*(e.cycleScale??1)*k),abilityScale:k,shield:0,slow:0,stun:0,burn:null,knockback:null,knockRecovery:0,boost:0,abilityTimer:0,attackTimer:0,flash:0,invuln:0,raid:null,shift:e.shift?{...e.shift,taken:0,cd:0,count:0}:null,prospectusTimer:e.prospectusTimer!==undefined?8:0};
    playAnimation(ally,'idle');this.allies.push(ally);this.effect(e.x,e.y,'heal','#a4eedc','',1);
   }else{this.depart(e,'enemy');this.effect(e.x,e.y,'poof',CEO_MAP[e.type].color);}
  }
 }
 damageUnit(u,damage){
  const reflect=u.model==='qwen'&&this.harnessFor(u);
  const taken=Math.min(Math.max(0,u.hp),Math.max(0,damage));u.hp-=damage;
  if(reflect&&taken>0){
   const target=this.enemies.filter(e=>enemyTargetable(e)&&Math.abs(e.x-u.x)<=FIELD.cw&&Math.abs(e.y-u.y)<=FIELD.ch).sort((a,b)=>Math.hypot(a.x-u.x,a.y-u.y)-Math.hypot(b.x-u.x,b.y-u.y)||a.id-b.id)[0];
   if(target){this.damageEnemy(target,taken*.08,{sourceId:u.id});this.effects.push({x:u.x,y:u.y-10,type:'link',tx:target.x,ty:target.y-10,color:'#9dbbe9',age:0,duration:.45});}
  }
  executeLowHP(this,u);
 }
 damageAlly(a,damage){
  let remaining=damage;for(const kind of ['shield','armor']){const blocked=Math.min(a[kind]||0,remaining);a[kind]-=blocked;remaining-=blocked;}
  a.hp-=remaining;a.flash=.14;playAnimation(a,a.hp<=0?'defeat':'hurt');
 }
 lockPonyTarget(e,target=null){
  const candidates=this.units.filter(u=>u.hp>0);if(!candidates.length)return false;
  if(!target||!candidates.includes(target))target=candidates[Math.floor(this.random()*candidates.length)];
  e.raid={phase:'warning',remaining:PONY_RAID.warning,elapsed:0,targetId:target.id,row:target.row,col:target.col};
  e.row=target.row;e.x=target.x;e.y=target.y;playAnimation(e,'idle');
  this.emit('raidLock',{enemy:e.id,enemyType:e.type,model:target.model,row:target.row,col:target.col});return true;
 }
 updatePonyRaid(e,dt){
  const raid=e.raid;
  if(raid.phase==='waiting'){this.lockPonyTarget(e);advanceAnimation(e,dt,'idle');return;}
  // A rope fixes the landing tile: controls never slide it off its victim.
  e.row=raid.row;e.x=FIELD.x+raid.col*FIELD.cw+FIELD.cw/2;e.y=FIELD.y+raid.row*FIELD.ch+FIELD.ch/2;
  e.knockback=null;raid.remaining-=dt;raid.elapsed+=dt;
  if(raid.phase==='warning'&&raid.remaining<=1e-9){
   const overflow=Math.max(0,-raid.remaining);raid.phase='landed';raid.remaining=PONY_RAID.steal-overflow;raid.elapsed=overflow;
   playAnimation(e,'idle');this.emit('raidLand',{enemy:e.id,row:raid.row,col:raid.col});
  }
  if(raid.phase==='landed')raid.remaining=Math.max(0,raid.remaining);
  advanceAnimation(e,dt,'idle');
 }
 finishPonyRaid(e){
  const raid=e.raid;if(e.hp<=0||raid?.phase!=='landed'||raid.remaining>1e-9)return;
  const victim=this.units.find(u=>u.hp>0&&u.row===raid.row&&u.col===raid.col);
  if(victim){
   this.units=this.units.filter(u=>u.id!==victim.id);
   this.depart(victim,'unit',{abducted:true});
   this.emit('abducted',{enemy:e.id,enemyType:e.type,unit:victim.id,model:victim.model,row:raid.row,col:raid.col});
  }
  // Escaping is not a defeat and pays no kill score or Token bounty.
  this.departures.push({...e,raid:{...raid},kind:'enemy',exit:'rope',carried:victim?{...victim}:null,departureAge:0});
  raid.phase='escaped';e.hp=0;
 }
 nearbyTroops(e){return (e.allied?this.allies:this.enemies).filter(a=>a.id!==e.id&&enemyTargetable(a)&&Math.abs(a.row-e.row)<=1&&Math.abs(a.x-e.x)<=220);}
 marchBonus(e){return (e.allied?this.allies:this.enemies).some(a=>a.id!==e.id&&a.hp>0&&a.stun<=0&&!a.knockback&&CEO_MAP[a.type].ability==='haste'&&Math.abs(a.row-e.row)<=1&&Math.abs(a.x-e.x)<=220)?1.25:1;}
 castSP(e){
  const targets=pickDistinct(this.units.filter(u=>u.hp>0),SUPER_KIT.penguins,()=>this.random());
  for(let n=0;n<SUPER_KIT.penguins;n++){
   const penguin=this.spawnEnemy('qq_raider',e.row,{raidTarget:targets.length?targets[n%targets.length]:null});penguin.ownerId=e.id;
  }
  playAnimation(e,'attack');this.emit('superSP',{enemy:e.id});this.effect(e.x,e.y-20,'superCast','#65c9d9','SP',.8);
 }
 castMonopoly(e){
  this.monopolyRemaining=Math.max(this.monopolyRemaining,SUPER_KIT.lock);
  playAnimation(e,'attack');this.emit('monopoly',{enemy:e.id,duration:SUPER_KIT.lock});
  this.effect(e.x,e.y-20,'superCast','#d9b86d','',1);
 }
 castDividend(e){
  const targets=pickDistinct(this.units.filter(u=>u.hp>0),SUPER_KIT.marks,()=>this.random());if(!targets.length)return false;
  this.dividends.push({id:this.nextId++,ownerId:e.id,ends:this.time+SUPER_KIT.window,remaining:SUPER_KIT.window,total:0,marks:targets.map(u=>({id:u.id,model:u.model,row:u.row,col:u.col,x:u.x,y:u.y}))});
  playAnimation(e,'attack');this.emit('dividendMark',{enemy:e.id,count:targets.length});return true;
 }
 recordDividendDamage(sourceId,amount){
  if(sourceId===null||amount<=0)return;
  for(const d of this.dividends)if(this.time<=d.ends+1e-9&&d.marks.some(m=>m.id===sourceId))d.total+=amount;
 }
 resolveDividends(){
  const pending=[];
  for(const d of this.dividends){
   d.remaining=Math.max(0,d.ends-this.time);
   if(d.remaining>1e-9){pending.push(d);continue;}
   let healed=0;
   for(const e of this.enemies.filter(e=>e.hp>0)){
    const amount=Math.min(d.total,Math.max(0,e.maxHp-e.hp));if(amount<=0)continue;
    e.hp+=amount;healed+=amount;this.effect(e.x,e.y,'heal','#8ed5b1',`+${Math.round(amount)}`,.9);
   }
   this.emit('dividendPaid',{enemy:d.ownerId,damage:d.total,healed});
  }
  this.dividends=pending;
 }
 updateSuperKit(e,dt){
  if(e.allied)return;
  for(const key of ['sp','monopoly','dividend'])e.superKit[key]-=dt;
  if(e.superKit.sp<=1e-9){e.superKit.sp=SUPER_KIT.sp;this.castSP(e);}
  if(e.superKit.monopoly<=1e-9){e.superKit.monopoly=SUPER_KIT.monopoly;this.castMonopoly(e);}
  if(e.superKit.dividend<=1e-9){e.superKit.dividend=SUPER_KIT.dividend;this.castDividend(e);}
 }
 updateEnemyKit(e,dt=0){
  const c=CEO_MAP[e.type];if(e.mini||['abduct','trump','military','elon_super','elon_summon'].includes(c.ability))return;
  if(c.ability==='super'){this.updateSuperKit(e,dt);return;}
  if(e.boss&&!e.enraged&&e.hp<=e.maxHp*.5){
   e.enraged=true;e.damage=Math.round(e.damage*1.35);e.speed*=1.2;e.shield=Math.max(e.shield,120*enemyPower(e));
   this.effect(e.x,e.y,'shield',c.color);
   if(!e.allied)this.emit('bossRage',{enemyType:e.type});
  }
  const period=e.enraged?(c.ability==='summon'?8:7):(c.abilityPeriod?c.abilityPeriod/(e.abilityScale??1):c.abilityPeriod);
  if(!period||e.abilityTimer<period)return;
  e.abilityTimer=0;playAnimation(e,'attack');
  if(c.ability==='commerce'){
   for(const row of [e.row-1,e.row,e.row+1].filter(row=>row>=0&&row<FIELD.rows)){
    const recruit=this.spawnEnemy('jack',row,{mini:true,allied:!!e.allied});recruit.x=Math.max(FIELD.x,Math.min(1080,e.x+(e.allied?-45:45)));
   }
   this.effect(e.x,e.y,'poof',c.color);return;
  }
  if(c.ability==='summon'){
   for(const [i,offset] of [24,65].entries()){
    const row=Math.max(0,Math.min(4,e.row+(i===0?-1:1)));
    const recruit=this.spawnEnemy('runner',row,{mini:true,allied:!!e.allied});
    recruit.x=Math.min(1080,Math.max(FIELD.x,e.x+(e.allied?-offset:offset)));
   }
   this.bellWave(e);
   this.effect(e.x,e.y,'poof',c.color);return;
  }
  if(c.ability==='fortify')e.shield=Math.max(e.shield,160*enemyPower(e));
  for(const a of this.nearbyTroops(e)){
   if(c.ability==='heal'){const healed=Math.min(Math.round(45*enemyPower(e)),a.maxHp-a.hp);if(healed<=0)continue;a.hp+=healed;this.effect(a.x,a.y,'heal',c.color,`+${healed}`);}
   else if(c.ability==='shield'||c.ability==='fortify'){a.shield=Math.max(a.shield,Math.round((c.ability==='fortify'?80:60)*enemyPower(e)));this.effect(a.x,a.y,'shield',c.color);}
  }
  this.effect(e.x,e.y,'shield',c.color);
 }
 // Qwen's open-source field shelters its neighbours: adjacent allies take 25% less.
 shelterFor(u){
  if(!u||u.allied||u.col===undefined)return 0;
  const guards=this.units.filter(q=>q.model==='qwen'&&starsOf(q)>1&&q.hp>0&&q.id!==u.id&&Math.abs(q.row-u.row)<=1&&Math.abs(q.col-u.col)<=1);
  return guards.reduce((best,q)=>Math.max(best,.25*skillScale(q)),0);
 }
 strikeUnit(e,u){
  const shelter=this.shelterFor(u),dealt=shelter>0?Math.max(1,Math.round(e.damage*(1-shelter))):e.damage;
  if(u.allied)this.damageAlly(u,dealt);else this.damageUnit(u,dealt);
  u.flash=.18;playAnimation(e,'attack');playAnimation(u,'hurt');this.effect(u.x,u.y-22,'hit','#d78a70');
  if(shelter>0||(u.model==='qwen'&&starsOf(u)>1))this.skillEffect('qwen',u.x,u.y-10,'skillGuard');
 }
 // Ranged CEOs hold their ground once a target is inside their lane reach.
 rangedTarget(e){
  const r=CEO_MAP[e.type].ranged;if(!r||e.mini)return null;
  const dir=e.allied?1:-1,pool=e.allied?this.enemies.filter(enemyTargetable):[...this.units,...this.allies];
  return pool.filter(u=>u.hp>0&&u.id!==e.id&&u.row===e.row&&(u.x-e.x)*dir>28&&Math.abs(e.x-u.x)<=r.range)
   .sort((a,b)=>dir>0?a.x-b.x:b.x-a.x)[0]??null;
 }
 fireEnemyShot(e,target){
  const r=CEO_MAP[e.type].ranged,dir=e.allied?1:-1;
  this.projectiles.push({id:this.nextId++,hostile:true,kind:r.kind,model:e.type,side:e.allied?'ally':'enemy',x:e.x+dir*24,y:e.y-16,row:e.row,targetY:target.y-14,vx:r.speed*dir,damage:Math.round(e.damage*r.mult),age:0,delay:0,color:CEO_MAP[e.type].color,hit:[],resolved:false});
  playAnimation(e,'attack');
 }
 hitByEnemyShot(p,u){
  const shelter=this.shelterFor(u),dealt=shelter>0?Math.max(1,Math.round(p.damage*(1-shelter))):p.damage;
  if(u.allied)this.damageAlly(u,dealt);else this.damageUnit(u,dealt);
  u.flash=.18;playAnimation(u,'hurt');this.effect(u.x,u.y-22,'hit',p.color);
  if(shelter>0)this.skillEffect('qwen',u.x,u.y-10,'skillGuard');
 }
 updateHostileShot(p,dt){
  if(p.arc){
   const a=p.arc;a.t+=dt;const q=Math.min(1,a.t/a.dur);
   p.x=a.x0+(a.x1-a.x0)*q;p.y=a.y0+(a.y1-a.y0)*q-58*Math.sin(q*Math.PI);
   if(q>=1){this.prospectusImpact(p);p.x=-1e5;}
   return;
  }
  const previous=p.x;p.x+=p.vx*dt;p.y+=(p.targetY-p.y)*Math.min(1,dt*7);
  const pool=p.side==='ally'?this.enemies.filter(en=>enemyTargetable(en)&&en.row===p.row):[...this.units,...this.allies].filter(u=>u.hp>0&&u.row===p.row);
  const hit=pool.filter(u=>p.vx<0?u.x+22>=p.x&&u.x-22<=previous:u.x-22<=p.x&&u.x+22>=previous)
   .sort((a,b)=>p.vx<0?b.x-a.x:a.x-b.x)[0];
  if(!hit)return;
  if(p.side==='ally'){this.damageEnemy(hit,p.damage);this.effect(hit.x,hit.y-22,'hit',p.color);}
  else this.hitByEnemyShot(p,hit);
  p.x=-1e5;p.resolved=true;
 }
 // IPO Chairman switches listing boards after taking enough punishment.
 shiftLane(e){
  const s=e.shift,rows=[e.row-1,e.row+1].filter(row=>row>=0&&row<FIELD.rows);
  if(!rows.length){s.taken=0;s.cd=s.cooldown;return;}
  const pool=e.allied?this.allies:this.enemies,load=row=>pool.filter(a=>a.hp>0&&a.id!==e.id&&a.row===row).length;
  rows.sort((a,b)=>load(a)-load(b)||Math.abs(a-e.row)-Math.abs(b-e.row)||a-b);
  const from=e.row;e.row=rows[0];e.y=FIELD.y+e.row*96+48;
  s.taken=0;s.cd=s.cooldown;s.count++;e.invuln=.4;
  playAnimation(e,'walk');this.effect(e.x,e.y-26,'laneShift','#d9b76a','',.7);
  this.emit('laneShift',{enemyType:e.type,from,to:e.row});
 }
 // 敲钟·开盘: the listing bell rallies nearby capital and stuns the garden.
 bellWave(e){
  const damage=Math.round(e.damage*.7);
  this.effect(e.x,e.y-18,'bellWave',e.enraged?'#e0a15a':'#d9b76a','',.85);
  if(e.allied){
   for(const en of this.enemies)if(enemyTargetable(en)&&Math.abs(en.row-e.row)<=1&&Math.abs(en.x-e.x)<=220){this.damageEnemy(en,damage);en.stun=Math.max(en.stun||0,.5);this.effect(en.x,en.y-20,'stun','#d9b76a','',.6);}
   for(const a of this.allies)if(a.id!==e.id&&a.hp>0&&Math.abs(a.row-e.row)<=1&&Math.abs(a.x-e.x)<=220){a.shield=Math.max(a.shield||0,60*enemyPower(e));this.effect(a.x,a.y,'shield','#d9b76a');}
  }else{
   for(const u of this.units)if(u.hp>0&&Math.abs(u.row-e.row)<=1&&Math.abs(u.x-e.x)<=220){
    const shelter=this.shelterFor(u);this.damageUnit(u,shelter>0?Math.max(1,Math.round(damage*(1-shelter))):damage);
    u.stun=Math.max(u.stun||0,.5);playAnimation(u,'hurt');this.effect(u.x,u.y-20,'stun','#d9b76a','',.6);
    if(shelter>0)this.skillEffect('qwen',u.x,u.y-10,'skillGuard');
   }
   for(const a of this.nearbyTroops(e)){a.shield=Math.max(a.shield||0,60*enemyPower(e));this.effect(a.x,a.y,'shield','#d9b76a');}
  }
 }
 // 招股书·路演: three telegraphed prospectuses, one per nearest lane.
 prospectusVolley(e){
  const dir=e.allied?1:-1,color=e.enraged?'#e08a5a':'#d9b76a';
  const rows=Array.from({length:FIELD.rows},(_,row)=>row).sort((a,b)=>Math.abs(a-e.row)-Math.abs(b-e.row)||a-b).slice(0,3).sort((a,b)=>a-b);
  for(const row of rows){
   const pool=e.allied?this.enemies.filter(en=>en.hp>0&&en.row===row):[...this.units,...this.allies].filter(u=>u.hp>0&&u.row===row);
   const target=pool.sort((a,b)=>dir>0?a.x-b.x:b.x-a.x)[0];
   const tx=target?target.x:Math.max(FIELD.x+70,Math.min(930,e.x+dir*250)),ty=FIELD.y+row*96+48;
   this.effect(tx,ty,'prospectusMark',color,'',1);
   this.projectiles.push({id:this.nextId++,hostile:true,kind:'prospectus',model:'ipo',side:e.allied?'ally':'enemy',x:e.x,y:e.y-24,row,targetY:ty-14,vx:0,damage:Math.round(e.damage*.6),radius:80,age:0,delay:0,color,arc:{x0:e.x,y0:e.y-24,x1:tx,y1:ty-14,t:0,dur:1},hit:[],resolved:false});
  }
  playAnimation(e,'attack');this.effect(e.x,e.y,'poof',CEO_MAP.ipo.color);
 }
 prospectusImpact(p){
  this.effect(p.x,p.y+10,'blast',p.color);
  if(p.side==='ally'){for(const en of this.enemies)if(en.hp>0&&Math.hypot(en.x-p.x,en.y-p.y)<=p.radius){this.damageEnemy(en,p.damage);this.effect(en.x,en.y-22,'hit',p.color);}return;}
  for(const u of [...this.units,...this.allies])if(u.hp>0&&Math.hypot(u.x-p.x,u.y-p.y)<=p.radius)this.hitByEnemyShot(p,u);
 }
 updateAllies(dt){
  for(const a of [...this.allies]){
   if(a.hp<=0)continue;
   a.age+=dt;a.flash=Math.max(0,a.flash-dt);a.boost=Math.max(0,a.boost-dt);a.abilityTimer+=dt;
   if(a.type==='military_claude'){a.stun=Math.max(0,(a.stun||0)-dt);updateMilitary(this,a,dt);continue;}
   if(CEO_MAP[a.type].ability==='abduct'){advanceAnimation(a,dt,'idle');continue;}
   this.updateEnemyKit(a);
   const target=this.enemies.filter(e=>enemyTargetable(e)&&e.row===a.row&&e.x>=a.x-28).sort((x,y)=>x.x-y.x)[0];
   if(a.type==='dario'&&a.abilityTimer>=10){a.abilityTimer=0;a.shield=80*(a.cycleScale??1);this.effect(a.x,a.y,'shield','#d49b6c');}
   if(a.type==='elon'&&a.abilityTimer>=9){a.abilityTimer=0;a.boost=2;this.effect(a.x,a.y,'boost','#da8a51');}
   if(a.type==='mark'&&!a.mini&&a.abilityTimer>=12){a.abilityTimer=-999;for(const offset of [18,55]){const baby=this.spawnEnemy('mark',a.row,{mini:true,allied:true});baby.x=Math.max(FIELD.x,a.x-offset);}}
   if(a.type==='liang'&&a.abilityTimer>=12){a.abilityTimer=0;this.tokens+=20;playAnimation(a,'attack');this.effect(a.x,a.y,'token','#79b99d','+20');}
   const blocked=target&&target.x-a.x<62;
   const shot=blocked?null:this.rangedTarget(a);
   advanceAnimation(a,dt,blocked||shot||!target?'idle':'walk');
   if(blocked){a.attackTimer-=dt;if(a.attackTimer<=0){a.attackTimer=1;playAnimation(a,'attack');this.damageEnemy(target,a.damage);this.effect(target.x,target.y-22,'hit','#79b99d');}}
   else if(shot){a.attackTimer-=dt;if(a.attackTimer<=0){a.attackTimer=CEO_MAP[a.type].ranged.period;this.fireEnemyShot(a,shot);}}
   else if(target)a.x=Math.min(target.x-50,a.x+a.speed*this.marchBonus(a)*(a.boost>0?3:1)*dt);
  }
  for(const a of this.allies)if(a.hp<=0)this.depart(a,'ally');
  this.allies=this.allies.filter(a=>a.hp>0);
 }
 depart(actor,kind,{abducted=false}={}){if(kind==='unit'){
  if(!abducted&&actor.model==='grok'&&!actor.deathrattleUsed&&this.harnesses.some(h=>h.unitId===actor.id)){
   actor.deathrattleUsed=true;
   this.projectiles.push({id:this.nextId++,sourceId:actor.id,model:'grok',deathrattle:true,basic:false,stars:3,x:actor.x,y:actor.y-14,originX:actor.x,row:actor.row,targetY:actor.y-14,vx:650,hit:[],delay:0,age:0,color:'#e4b58f'});
  }
  this.harnesses=this.harnesses.filter(h=>h.unitId!==actor.id);this.effects=this.effects.filter(f=>!(f.type==='codexStop'&&f.x===actor.x&&f.y===actor.y));if(this.timeStopUnit===actor.id){this.timeStop=0;this.timeStopUnit=null;}}
  if(abducted)return;
  const ghost={...actor,kind,departureAge:0};playAnimation(ghost,'defeat');this.departures.push(ghost);
 }
 fire(u,target,{damage,splash=0,knock=0,stun=0,star=false,link=0,delay=0,basic=false,chain=0,pierce=0,replay=false,silent=false}={}){
  if(u.model==='deepseek'||u.model==='kimi')return false;
  const m=MODEL_MAP[u.model];
  if(basic)recordElonAttack(this,u);
  const x=target.raid?.phase==='landed'&&target.row===u.row&&Math.abs(target.x-u.x)<30?target.x-12:u.x+27;
  this.projectiles.push({id:this.nextId++,sourceId:u.id,model:u.model,basic,stars:starsOf(u),x,y:u.y-14,targetY:target.y-14,row:target.row,vx:basic?BASIC_ATTACKS[u.model].speed:u.model==='mimo'?560:340,damage:damage??m.damage,splash,knock,stun,star,link,chain,pierce,replay,hit:[],delay,targetId:target.id,age:0,color:m.color,resolved:false});
  if(silent)return true;
  u.flash=.2;playAnimation(u,'attack');this.emit('shoot',{model:u.model});
  if(!basic)this.skillEffect(u.model,u.x+15,u.y-18);
  return true;
 }
 attack(u){
  if(u.model==='deepseek'||u.model==='kimi')return false;
  if(u.model==='qwen')return this.basicAttack(u,[]);
  const inFront=e=>enemyTargetable(e)&&e.x>u.x-20;
  const lane=this.enemies.filter(e=>e.row===u.row&&inFront(e)).sort((a,b)=>a.x-b.x);
  if(starsOf(u)===1)return this.basicAttack(u,lane);
  const power=skillScale(u);
  if(u.model==='gemini'){
   const candidates=this.enemies.filter(e=>Math.abs(e.row-u.row)<=1&&inFront(e)).sort((a,b)=>a.x-b.x);
   const first=candidates[0],second=first&&(candidates.find(e=>e.row!==first.row)||candidates.find(e=>e.id!==first.id));
   const targets=[first,second].filter(Boolean);
   if(targets.length){const link=this.nextId++;this.links[link]={points:[],expected:targets.length,ttl:4};for(const e of targets)this.fire(u,e,{star:true,link,damage:MODEL_MAP[u.model].damage*power});}
   return targets.length>0;
  }
  if(!lane.length){
   // MiniMax is the only model that can still answer a lane that has already
   // leaked: the strip turns around and comes back, so a CEO behind her is a
   // valid reason to fire even when nothing is left in front.
   if(u.model!=='minimax'||!this.enemies.some(e=>e.row===u.row&&enemyTargetable(e)))return false;
   this.rewindCast(u,power);return true;
  }
  const target=lane[0];
  if(u.model==='doubao'){
   const harness=this.harnessFor(u),trae=harness?.variant==='trae';
   const damage=MODEL_MAP.doubao.damage*power,chain=trae?5:starsOf(u)===3?3:2;
   this.fire(u,target,{damage,chain});
   // Seedance renders a short clip of the same bounce chain and premieres it 0.6s later.
   if(harness&&!trae){
    this.effect(u.x,u.y-18,'renderClip','#a8c7f1','',.6);
    this.fire(u,target,{damage:damage*.4,chain:3,delay:.6,replay:true,silent:true});
   }else if(trae)this.effect(u.x,u.y-18,'multiEdit','#32F08C','',.6);
   return true;
  }
  if(u.model==='mimo'){this.fire(u,target,{damage:MODEL_MAP.mimo.damage*power,pierce:starsOf(u)===3?3:2});return true;}
  if(u.model==='chatgpt'){if(starsOf(u)===2){if((u.beamBasics||0)<3||u.beam)return false;u.beamBasics=0;}u.beam={charge:.45,fire:starsOf(u)===3?1.45:1.1,tick:.12,damage:starsOf(u)===3?4:3};u.flash=.2;playAnimation(u,'attack');this.emit('shoot',{model:u.model});return true;}
  if(u.model==='claude'){this.sweep(u,lane);return true;}
  if(u.model==='glm'){if((u.freezeBasics||0)<4)return false;u.freezeBasics=0;this.dropGoStone(u,target);return true;}
  if(u.model==='grok')this.fire(u,target,{damage:MODEL_MAP[u.model].damage*power,splash:starsOf(u)===3?90:60,knock:GROK_CONTROL.direct*(starsOf(u)===3?1:.5)});
  else if(u.model==='minimax'){this.rewindCast(u,power);return true;}
  else this.fire(u,target);
  return true;
 }
 // ChatGPT: a channeled beam replaces the bolt — no travel time, nothing to miss.
 updateBeam(u,dt){
  const b=u.beam;
  if(b.charge>0){b.charge-=dt;return;}
  b.fire-=dt;b.tick-=dt;
  // Cast clock: only the visible channel advances the cast drawing loop.
  b.castTime=(b.castTime||0)+dt;
  while(b.tick<=0&&b.fire>0){
   b.tick+=.12;
   for(const e of this.enemies){
    if(enemyTargetable(e)&&e.row===u.row&&e.x>u.x-20){this.damageEnemy(e,b.damage??4,{sourceId:u.id});this.effect(e.x,e.y-12,'hit','#e6dcff','',.18);}
   }
  }
  if(b.fire<=0)u.beam=null;
 }
 syncBeamAnimations(){
  const sources=this.units.filter(u=>u.hp>0&&u.beam);
  for(const u of this.units){
   if(u.hp>0&&u.beam){
    if(u.animation?.state!=='attack')playAnimation(u,'attack');
    if(u.beam.charge<=0){
     // The firing drawings loop across the cast drawing and one neighbour each
     // side; stopping on a single still made the laser look paused.
     u.animation=loopingFrame('attack',BEAM_CAST.frame-BEAM_CAST.spread,BEAM_CAST.spread*2+1,u.beam.castTime||0);
    }else{
     // The wind-up still plays at its drawn speed, then waits on the cast drawing
     // until the beam actually leaves the aperture.
     u.animation.time=Math.min(u.animation.time,BEAM_CAST.frame/ANIMATION_STATES.attack.fps);
    }
    u.channeling=true;
   }else if(u.channeling){u.channeling=false;playAnimation(u,u.strike?'special':'idle');}
  }
  for(const e of this.enemies){
   if(e.hp<=0)continue;
   const hit=enemyTargetable(e)&&sources.some(u=>u.beam.charge<=0&&u.beam.fire>0&&e.row===u.row&&e.x>u.x-20);
   if(hit){e.beamHit=true;e.animation={state:'hurt',time:2.1/15};}
   else if(e.beamHit){
    e.beamHit=false;
    const blocked=this.units.some(u=>u.hp>0&&u.row===e.row&&e.x-u.x<62&&e.x-u.x>-28);
    playAnimation(e,blocked?'idle':'walk');
   }
  }
 }
 // Claude locks a local group into individual contracts, then resolves one verdict.
 sweep(u,lane){
  const anchor=lane[0],radius=starsOf(u)===3?125:85,maxHits=starsOf(u)===3?Infinity:2;
  const targets=this.enemies.filter(e=>enemyTargetable(e)&&e.x>u.x-20&&Math.hypot(e.x-anchor.x,e.y-anchor.y)<=radius).sort((a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y)).slice(0,maxHits);
  this.sweeps.push({id:this.nextId++,unitId:u.id,row:u.row,stars:starsOf(u),damage:45*skillScale(u),maxHits,strip:starsOf(u)===3,convert:!!this.harnessFor(u),hit:[],marks:targets.map(e=>({id:e.id,x:e.x,y:e.y})),age:0,writ:.65,resolved:false,radius});
  this.skillEffect('claude',u.x+12,u.y-14);
  u.flash=.2;playAnimation(u,'attack');this.emit('shoot',{model:u.model});
 }
 // GLM drops directly over its target; the field stays at the impact location.
 dropGoStone(u,target){
  const width=starsOf(u)===3?200:100,height=96;
  this.zones.push({id:this.nextId++,row:target.row,x:target.x,y:target.y,x0:target.x-width/2,x1:target.x+width/2,y0:target.y-height/2,y1:target.y+height/2,width,height,until:starsOf(u)===3?GLM_FREEZE.lifetime:1.9,slowFactor:starsOf(u)===3?.45:.7,slowDuration:starsOf(u)===3?GLM_FREEZE.slow:1.5,age:0,landed:false,targetId:target.id});
  this.skillEffect('glm',u.x+8,u.y-20);
  u.flash=.2;playAnimation(u,'attack');this.emit('shoot',{model:u.model});
 }
 // MiniMax: the strip leaves her side, crosses the whole board to the right edge,
 // then rewinds to the left edge before it is collected. No impact point, no
 // explosion — every CEO on the way is clipped once per leg.
 rewindCast(u,power){
  const m=MODEL_MAP.minimax;
  this.projectiles.push({id:this.nextId++,sourceId:u.id,model:'minimax',basic:false,stars:starsOf(u),
   x:u.x+24,y:u.y-14,targetY:u.y-14,row:u.row,vx:MINIMAX_REWIND.speed,dir:1,
   damage:m.damage*power,stun:starsOf(u)===3?.4:.2,age:0,delay:0,hit:[],hitOut:[],hitBack:[],
   color:m.color,resolved:false,rewind:true});
  this.skillEffect('minimax',u.x+15,u.y-18);
  u.flash=.2;playAnimation(u,'attack');this.emit('shoot',{model:u.model});
 }
 // One pass of the strip. Collecting the strip at the left edge is what ends the
 // attack; without the flag the filter below would keep it alive forever, since
 // a projectile that flew left never satisfies the right-edge cull by itself.
 updateRewind(p,dt){
  // The turn happens at the right edge of the lawn, not at the canvas edge: past
  // it is the dirt strip where nothing walks, and the strip has to look like it
  // bounced off the frame of the shot.
  const right=FIELD.x+FIELD.cols*FIELD.cw,left=FIELD.x-20;
  const previous=p.x;p.x+=p.dir*MINIMAX_REWIND.speed*dt;
  const lo=Math.min(previous,p.x),hi=Math.max(previous,p.x);
  const outbound=p.dir>0,seen=outbound?p.hitOut:p.hitBack;
  const leg=outbound?MINIMAX_REWIND.out:MINIMAX_REWIND.back;
  for(const e of this.enemies){
   if(!enemyTargetable(e)||seen.includes(e.id))continue;
   if(Math.abs(e.row-p.row)>1)continue;
   if(!(e.x+MINIMAX_REWIND.reach>=lo&&e.x-MINIMAX_REWIND.reach<=hi))continue;
   seen.push(e.id);
   const falloff=e.row===p.row?1:MINIMAX_REWIND.rowFalloff;
   this.damageEnemy(e,p.damage*leg*falloff,{sourceId:p.sourceId});
   if(p.stun)e.stun=Math.max(e.stun||0,p.stun);
   this.effects.push({x:e.x,y:e.y-14,type:'rewindHit',model:'minimax',row:e.row,leg:outbound?'out':'back',color:p.color,age:0,duration:.5});
  }
  if(outbound&&p.x>=right){
   p.dir=-1;p.x=right;
   this.effects.push({x:right-14,y:p.y,type:'rewindTurn',color:p.color,age:0,duration:.55});
   this.emit('rewindTurn',{model:'minimax',row:p.row});
  }else if(!outbound&&p.x<=left)p.done=true;
 }
 // Gemini: once both stars land, the segment between them hits everything it crosses.
 starImpact(p,e){
  const link=this.links[p.link]||(this.links[p.link]={points:[]});
  link.points.push({x:e.x,y:e.y-14,id:e.id});
  if(link.expected===1){delete this.links[p.link];return;}
  if(link.points.length<2)return;
  const [a,b]=link.points;
  this.effects.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2,type:'linkline',ax:a.x,ay:a.y,bx:b.x,by:b.y,color:'#d9c8f8',age:0,duration:.5});
  for(const o of this.enemies){
   if(enemyTargetable(o)&&o.id!==a.id&&o.id!==b.id&&pointSegDist(o.x,o.y-14,a,b)<30)this.damageEnemy(o,p.stars===2?12:20,{sourceId:p.sourceId});
  }
  delete this.links[p.link];
 }
 // Everything that still flies shares one hit resolution: splash, knockback, stun, star links.
 applyImpact(p,e){
  if(p.basic){this.effect(e.x,e.y-12,'hit',p.color,'',.18);return;}
  this.skillEffect(p.model,e.x,e.y-12,'skillImpact',{radius:p.splash||45});
  if(p.chain){
   let previous=e,damage=p.damage;
   for(let hop=1;hop<p.chain;hop++){
    const next=this.enemies.filter(a=>enemyTargetable(a)&&!p.hit.includes(a.id)&&Math.hypot(a.x-previous.x,a.y-previous.y)<=160).sort((a,b)=>Math.hypot(a.x-previous.x,a.y-previous.y)-Math.hypot(b.x-previous.x,b.y-previous.y)||a.id-b.id)[0];
    if(!next)break;damage*=.8;p.hit.push(next.id);this.damageEnemy(next,damage,{sourceId:p.sourceId});
    this.effects.push({type:'chatBounce',x:previous.x,y:previous.y-12,tx:next.x,ty:next.y-12,age:0,duration:.45});
    this.skillEffect('doubao',next.x,next.y-12,'skillImpact');previous=next;
   }
  }
  if(p.stun)e.stun=Math.max(e.stun||0,p.stun);
  if(p.star)this.starImpact(p,e);
  if(p.model==='grok'&&e.hp>0){e.burn={sourceId:p.sourceId,remaining:p.stars===2?1.5:GROK_BURN.duration,tick:e.burn?.tick??GROK_BURN.every};}
  if(p.model==='grok')interruptElonRocket(this,e);
  if(p.splash){
   for(const near of this.enemies.filter(a=>a.id!==e.id&&enemyTargetable(a)&&Math.hypot(a.x-e.x,(a.row-e.row)*96)<p.splash)){
    this.damageEnemy(near,p.damage*.7,{sourceId:p.sourceId});
    if(p.stun)near.stun=Math.max(near.stun||0,p.stun);
    if(p.knock)this.knockback(near,p.model==='grok'?GROK_CONTROL.splash*(p.stars===2?.5:1):p.knock);
   }
  }
  if(p.knock)this.knockback(e,p.knock);
 }
 // Frost and fire cannot coexist: the moment an enemy carries both GLM's freeze
 // and Grok's burn, the two statuses cancel and whatever burn was left vents at
 // once as steam at double strength. Resolved in one place so it does not matter
 // which status arrived first.
 meltFrozen(){
  for(const e of this.enemies){
   if(e.hp<=0||!e.burn||!(e.slow>0))continue;
   const ticks=Math.max(1,Math.ceil(e.burn.remaining/GROK_BURN.every-1e-9));
   const sourceId=e.burn.sourceId;e.burn=null;e.slow=0;
   this.effect(e.x,e.y-18,'melt','#9fe0f5','',.7);
   this.emit('melt',{enemyType:e.type,damage:ticks*GROK_BURN.damage*MELT.scale});
   this.damageEnemy(e,ticks*GROK_BURN.damage*MELT.scale,{direct:true,sourceId,sourceModel:'grok'});
  }
 }
 // Grok: shove the target down-lane; Elon's rocket gets blown off course.
 knockback(e,px){
  if(CEO_MAP[e.type].anchored||e.retreat)return false;
  if(e.raid&&e.raid.phase!=='waiting')return false;
  if(e.type==='elon')e.boost=0;
  // Recovery belongs to the enemy, shared across every attacker. Staggering
  // several Groks cannot repeatedly restart the recoil or accumulate distance.
  if((e.knockRecovery||0)>0)return false;
  const from=e.x,old=e.knockback;
  const remaining=old?old.distance*Math.pow(1-Math.min(1,old.elapsed/old.duration),3):0;
  const resistance=e.boss||CEO_MAP[e.type].armor?GROK_CONTROL.armoredScale:1;
  e.knockback={elapsed:0,duration:GROK_CONTROL.duration,distance:Math.min((px+remaining)*resistance,Math.max(0,1075-e.x))};
  e.knockRecovery=GROK_CONTROL.recovery;
  this.effect(from,e.y-16,'knock','#ffd2ab','',.4);
  return true;
 }
 update(dt){
  if(this.phase==='paused'||dt<=0)return;
  dt=Math.min(dt,.1);
  // Equipment activation freezes the simulation, while its own reveal can finish.
  // Pausing returns above, so even the reveal clock stops with the pause control.
  if(this.timeStop>0){
   const stopped=Math.min(dt,this.timeStop);this.timeStop=Math.max(0,this.timeStop-stopped);
   for(const h of this.harnesses)h.age+=stopped;
   for(const f of this.effects)if(f.type==='codexStop'||f.type==='rankUp')f.age+=stopped;
   this.effects=this.effects.filter(f=>f.age<f.duration);dt-=stopped;if(dt<1e-9)return;
  }
  this.tickTime+=dt;
  for(const h of this.harnesses)h.age+=dt;
  for(const d of this.departures){d.departureAge+=dt;advanceAnimation(d,dt,'defeat');}
  this.departures=this.departures.filter(d=>d.departureAge<.85);
  // Let the final defeat finish even when the last hit ends the battle.
  if(this.phase==='won'||this.phase==='lost'){
   for(const u of this.units)u.beam=null;
   this.syncBeamAnimations();
   for(const u of this.units)advanceAnimation(u,dt,u.strike?'special':'idle');
   return;
  }
  for(const id of Object.keys(this.cooldowns))this.cooldowns[id]=Math.max(0,this.cooldowns[id]-dt);
  for(const f of this.effects)f.age+=dt;this.effects=this.effects.filter(f=>f.age<f.duration);
  for(const h of this.harnesses)if(h.model==='kimi'||h.model==='claude')h.timer=Math.max(0,h.timer-dt);
  for(const [id,link] of Object.entries(this.links)){if(link.ttl!==undefined&&(link.ttl-=dt)<=0)delete this.links[id];}
  // GLM frozen patches: no damage anywhere. Everything standing on the ice just
  // keeps its slow refreshed for as long as it stays inside.
  for(const z of this.zones){
   z.age+=dt;z.until-=dt;
   if(!z.landed){const target=this.enemies.find(e=>e.id===z.targetId&&e.hp>0);if(target){z.x=target.x;z.y=target.y;z.row=target.row;z.x0=z.x-z.width/2;z.x1=z.x+z.width/2;z.y0=z.y-z.height/2;z.y1=z.y+z.height/2;}}
   if(!z.landed&&z.age>=GLM_FREEZE.landing){z.landed=true;this.skillEffect('glm',z.x,z.y-10,'skillImpact',{duration:.8});}
   if(!z.landed)continue;
   for(const e of this.enemies){
    if(e.type==='elon'){e.slow=0;continue;}
    if(enemyTargetable(e)&&((e.x-z.x)/((z.x1-z.x0)/2))**2+((e.y-z.y)/((z.y1-z.y0)/2))**2<=1){
     e.slowFactor=e.slow>0?Math.min(e.slowFactor??.45,z.slowFactor??.45):(z.slowFactor??.45);e.slow=Math.max(e.slow,z.slowDuration??GLM_FREEZE.slow);
    }
   }
  }
  this.zones=this.zones.filter(z=>z.until>0);
  if(this.phase==='playing'){
   this.time+=dt;updateTrumpOrders(this);updateElonOrders(this);enforceExecution(this);resolveMilitaryWrits(this,dt);
  }
  // Marked contracts follow their original targets; new arrivals cannot be hit.
  for(const s of this.sweeps){
   s.age+=dt;
   for(const mark of s.marks){const e=this.enemies.find(e=>e.id===mark.id&&e.hp>0);if(e){mark.x=e.x;mark.y=e.y;}}
   if(s.resolved||s.age<s.writ)continue;
   s.resolved=true;s.resolving=true;
   for(const mark of s.marks){
    const e=this.enemies.find(e=>e.id===mark.id&&e.hp>0);if(!e)continue;
    if(s.strip&&e.shield>0){e.shield=0;this.effect(e.x,e.y-34,'hit','#d8b68a','',.3);}
    this.damageEnemy(e,s.damage,{sourceId:s.unitId});s.hit.push(e.id);
    this.skillEffect('claude',e.x,e.y-12,'skillImpact',{stars:s.stars});
   }
   s.resolving=false;
  }
  this.sweeps=this.sweeps.filter(s=>s.age<1.2);
  for(const u of this.units){u.age+=dt;u.flash=Math.max(0,u.flash-dt);advanceAnimation(u,dt,u.strike?'special':'idle');}
  this.refreshStrikes();
  if(this.phase!=='playing')return;
  const wasLocked=this.monopolyRemaining>0;this.monopolyRemaining=Math.max(0,this.monopolyRemaining-dt);
  if(wasLocked&&this.monopolyRemaining<=1e-9){this.monopolyRemaining=0;this.emit('monopolyEnd');}
  if(this.nextWaveTimer!==null){this.nextWaveTimer-=dt;if(this.nextWaveTimer<=0)this.beginWave();}
  if(this.queue.length){this.spawnTimer-=dt;if(this.spawnTimer<=0){const next=this.queue.shift();this.spawnEnemy(next.type,next.row);this.spawnTimer=waveInterval(this.wave)*(this.difficulty==='easy'?1.1:this.difficulty==='hard'?.96:1);}}
  enforceExecution(this);
  this.airdropTimer-=dt;
  if(this.airdropTimer<=0){this.coin(FIELD.x+35+this.random()*830,FIELD.y+25+this.random()*420,25,true);this.airdropTimer=this.difficulty==='easy'?6:8;}
  for(const coin of [...this.coins]){
   coin.age+=dt;
   if(coin.arc){const a=coin.arc;a.t+=dt;const p=Math.min(1,a.t/a.dur);coin.x=a.x0+(a.x1-a.x0)*p;coin.y=a.y0+(a.y1-a.y0)*p-26*Math.sin(p*Math.PI);if(p>=1)coin.arc=null;}
   else if(coin.falling)coin.y=Math.min(coin.targetY,coin.y+95*dt);
   if(coin.age>=8)this.collect(coin.id,{automatic:true});
  }
  for(const u of this.units){
   if(u.hp<=0)continue;
   u.stun=Math.max(0,(u.stun||0)-dt);
   if(u.strike)continue;
   if(u.stun>0){advanceAnimation(u,dt,'idle');continue;}
   const m=MODEL_MAP[u.model];
   const power=skillScale(u);
   if(starsOf(u)===1&&!['deepseek','kimi'].includes(u.model)){u.attackTimer-=dt/basicIntervalScale(this,u);if(u.attackTimer<=0)u.attackTimer=this.attack(u)?BASIC_ATTACKS[u.model].period:.15;continue;}
   if(BASIC_ATTACKS[u.model].damage>0&&!(u.model==='chatgpt'&&starsOf(u)===2&&u.beam)){
   u.basicTimer=(u.basicTimer??.5)-dt/basicIntervalScale(this,u);
   if(u.basicTimer<=0){const targets=this.enemies.filter(e=>enemyTargetable(e)&&e.row===u.row&&e.x>u.x-20).sort((a,b)=>a.x-b.x);u.basicTimer=this.basicAttack(u,targets)?BASIC_ATTACKS[u.model].period:.15;}
   }
   const harness=this.harnessFor(u);
   if(harness&&u.model==='chatgpt'){harness.timer-=dt;if(harness.timer<=0){harness.timer=10;this.resetQuota(u);}}
   if(m.verb==='produce'){
    u.produceTimer-=dt;
    if(u.produceTimer<=0){u.produceTimer=m.period*(harness&&!['deepseek','chatgpt','kimi','claude','grok','qwen'].includes(u.model)?(starsOf(u)===3?.88:.94):1);playAnimation(u,'attack');
     this.skillEffect(u.model,u.x,u.y-10,'skillCast',{duration:u.model==='deepseek'?1.4:1.2});
     if(u.model==='deepseek'){
      let value=DEEPSEEK_INCOME[starsOf(u)];
      if(harness){harness.cycles++;value+=DEEPSEEK_HARNESS.bonus;if(harness.cycles%DEEPSEEK_HARNESS.every===0){value+=DEEPSEEK_HARNESS.dividend;this.effect(u.x,u.y-42,'token','#e9ba55','+50',.9);}}
      this.coin(u.x+8,u.y-30,value,false,{x0:u.x+8,y0:u.y-30,x1:u.x+38,y1:u.y+2,dur:.5,t:0});
     }
     if(u.model==='kimi'){
      const oneStar=starsOf(u)===1,healing=oneStar?18:40*power;
      if(!oneStar)this.coin(u.x+15,u.y-26,starsOf(u)===3?15:7);
      for(const ally of this.units.filter(a=>a.hp>0&&(oneStar?a.row===u.row&&a.col===u.col+1:Math.abs(a.row-u.row)<=1&&Math.abs(a.col-u.col)<=1))){
       ally.hp=Math.min(ally.maxHp,ally.hp+healing);this.effect(ally.x,ally.y,'heal','#7ba88a',`+${healing}`);this.effects.push({x:u.x,y:u.y-10,type:'link',tx:ally.x,ty:ally.y-10,color:'#8ed3a6',age:0,duration:1.2});
      }
     }
     if(u.model==='qwen'){u.hp=Math.min(u.maxHp,u.hp+30*power);this.effect(u.x,u.y,'heal','#7ba88a',`+${30*power}`);}
    }
   }else{
    u.attackTimer-=dt;
    if(u.beam)this.updateBeam(u,dt);
    else if(u.attackTimer<=0){if(this.attack(u))u.attackTimer=m.period*(harness&&!['deepseek','chatgpt','claude','grok','qwen','doubao'].includes(u.model)?(starsOf(u)===3?.88:.94):1);else u.attackTimer=.15;}
   }
  }
  for(const e of [...this.enemies]){
   if(e.hp<=0)continue;e.age+=dt;e.flash=Math.max(0,e.flash-dt);e.slow=Math.max(0,e.slow-dt);e.boost=Math.max(0,e.boost-dt);e.stun=Math.max(0,(e.stun||0)-dt);
   e.knockRecovery=Math.max(0,(e.knockRecovery||0)-dt);e.invuln=Math.max(0,(e.invuln||0)-dt);
   if(e.shift)e.shift.cd=Math.max(0,e.shift.cd-dt);
   if(e.burn){
    const burn=e.burn,active=Math.min(dt,burn.remaining);burn.remaining=Math.max(0,burn.remaining-active);burn.tick-=active;
    while(burn.tick<=1e-9&&e.hp>0){burn.tick+=GROK_BURN.every;this.damageEnemy(e,GROK_BURN.damage,{direct:true,react:false,sourceId:burn.sourceId});}
    if(burn.remaining<=1e-9)e.burn=null;
    if(e.hp<=0)continue;
   }
   if(e.type==='trump'){updateTrump(this,e,dt);continue;}
   if(e.type==='military_claude'){updateMilitary(this,e,dt);continue;}
   if(CEO_MAP[e.type].ability==='elon_summon'){updateElonSummon(this,e,dt);continue;}
   if(e.raid){this.updatePonyRaid(e,dt);continue;}
   const pushed=!!e.knockback;
   if(pushed){const k=e.knockback,p0=Math.min(1,k.elapsed/k.duration);k.elapsed+=dt;const p1=Math.min(1,k.elapsed/k.duration);e.x+=k.distance*(Math.pow(1-p0,3)-Math.pow(1-p1,3));if(p1>=1)e.knockback=null;}
   // MiniMax's CUT freezes the frame: no movement and no abilities while stunned.
   const controlled=e.elonKit?updateElon(this,e,dt,e.stun>0||pushed):false;
   const frozen=e.stun>0||pushed||controlled;
   if(!frozen){
    if(e.shift&&e.shift.cd<=0&&e.shift.taken>=e.shift.threshold&&e.shift.count<e.shift.max)this.shiftLane(e);
    e.abilityTimer+=dt;this.updateEnemyKit(e,dt);
    if(e.type==='ipo'&&!e.mini){
     e.prospectusTimer+=dt;const period=e.enraged?CEO_MAP.ipo.prospectus.enraged:CEO_MAP.ipo.prospectus.period;
     if(e.prospectusTimer>=period){e.prospectusTimer=0;this.prospectusVolley(e);}
    }
   }
   if(e.type==='dario'&&!frozen&&e.abilityTimer>=10){e.abilityTimer=0;e.shield=80*enemyPower(e);playAnimation(e,'attack');this.effect(e.x,e.y,'shield','#d49b6c');}
   if(e.type==='elon'&&!frozen&&e.abilityTimer>=9){e.abilityTimer=0;e.boost=2;this.effect(e.x,e.y,'boost','#da8a51');}
   if(e.type==='mark'&&!e.mini&&!frozen&&e.abilityTimer>=12){e.abilityTimer=-999;playAnimation(e,'attack');for(const offset of [18,55]){const baby=this.spawnEnemy('mark',e.row,{mini:true});baby.x=e.x+offset;}this.effect(e.x,e.y,'poof','#6e93b0');}
   if(e.type==='liang'&&!frozen&&e.abilityTimer>=12){e.abilityTimer=0;playAnimation(e,'attack');this.tokens=Math.max(0,this.tokens-20);this.emit('stolen');this.effect(e.x,e.y,'token','#ce715d','−20');}
   const blocker=[...this.units,...this.allies].filter(u=>u.row===e.row&&u.hp>0&&e.x-u.x<62&&e.x-u.x>-28).sort((a,b)=>b.x-a.x)[0];
   // Moving keeps the simulated walk clock (slowed by GLM, hastened by boost);
   // blocked by a unit the CEO falls back to the idle animation. Ranged units
   // hold position once a target enters range, so the same idle pose applies.
   const shot=blocker||frozen?null:this.rangedTarget(e);
   advanceAnimation(e,dt,blocker||shot||controlled?'idle':'walk',frozen&&!controlled?0:e.slow>0?Math.sqrt(e.slowFactor??.45):e.boost>0?2.5:1);
   if(blocker){
    if(!frozen){e.attackTimer-=dt*trendAttackScale(this,e);if(e.attackTimer<=0){e.attackTimer=1;
     this.strikeUnit(e,blocker);
     if(blocker.model==='qwen'&&CEO_MAP[e.type].armor&&starsOf(blocker)>1)e.armor=Math.max(0,e.armor-30*skillScale(blocker));}}
   }else if(!frozen){
    if(shot){e.attackTimer-=dt*trendAttackScale(this,e);if(e.attackTimer<=0){e.attackTimer=CEO_MAP[e.type].ranged.period;this.fireEnemyShot(e,shot);}}
    else e.x-=e.speed*this.marchBonus(e)*(e.slow>0?(e.slowFactor??.45):1)*(e.boost>0?3:1)*dt;
   }
   if(e.x<FIELD.x-32){
    if(this.mowers[e.row]){
     this.mowers[e.row]=false;
     const lane=this.enemies.filter(a=>a.row===e.row&&enemyTargetable(a));
     const stopper=lane.filter(a=>a.type==='jensen'||a.boss).sort((a,b)=>a.x-b.x)[0];
     for(const same of lane){
      if(stopper&&same.x>=stopper.x)continue;
      same.armor=0;same.shield=0;this.damageEnemy(same,99999);
     }
     if(stopper){if(stopper.boss)this.damageEnemy(stopper,800);else stopper.armor=CEO_MAP.jensen.armor*(stopper.cycleScale??1);this.effect(stopper.x,stopper.y,'shield',CEO_MAP[stopper.type].color);}
     const endX=stopper?Math.max(60,stopper.x-30):1140;
     this.effects.push({x:60,y:e.y,type:'mower',endX,age:0,duration:Math.max(.08,(endX-60)/1080*1.6)});
     this.emit('mower',{row:e.row});
    }
    else {this.phase='lost';this.emit('lose');return;}
   }
  }
  this.updateAllies(dt);
  for(const p of this.projectiles){
   if(p.ownerId&&!this.enemies.some(e=>e.id===p.ownerId&&e.hp>0))continue;
   p.age+=dt;if(p.delay>0){p.delay-=dt;continue;}
   if(p.hostile){this.updateHostileShot(p,dt);continue;}
   if(p.rewind){this.updateRewind(p,dt);continue;}
   const previous=p.x;p.x+=p.vx*dt;p.y+=(p.targetY-p.y)*Math.min(1,dt*7);
   if(p.deathrattle){
    for(const e of this.enemies.filter(e=>enemyTargetable(e)&&Math.abs(e.row-p.row)<=1&&e.x>=p.originX&&e.x+25>=previous&&e.x-25<=p.x&&!p.hit.includes(e.id))){
     this.damageEnemy(e,Math.max(0,e.maxHp-e.hp),{sourceId:p.sourceId});p.hit.push(e.id);this.skillEffect('grok',e.x,e.y-12,'skillImpact',{radius:60});
    }
    continue;
   }
   const targets=this.enemies.filter(e=>enemyTargetable(e)&&e.row===p.row&&!p.hit.includes(e.id)&&e.x+25>=previous&&e.x-25<=p.x).sort((a,b)=>a.x-b.x);
   for(const e of targets){
    let dmg=p.damage;if(!p.basic&&this.eggs&&p.model==='grok'&&['elon','elon_super'].includes(e.type))dmg*=1.4;
    this.damageEnemy(e,dmg,{sourceId:p.sourceId});p.hit.push(e.id);p.resolved=true;
    this.applyImpact(p,e);
    if(!p.pierce||p.hit.length>=p.pierce){p.x=1300;break;}
   }
  }
  // A star that never lands must not strand its partner's link.
  for(const p of this.projectiles)if(p.link&&!p.resolved&&p.x>=1200)delete this.links[p.link];
  // The rewinding strip is culled by its own flag: it spends a frame at the right
  // edge and then lives entirely left of it, so an edge test would eat it mid-turn.
  this.projectiles=this.projectiles.filter(p=>p.rewind?!p.done:(p.hostile?p.x>FIELD.x-80:p.x<1200));
  // Statuses meet only after everything has landed this frame.
  this.meltFrozen();
  // Resolve the last frame's hits before an expired rope takes its victim.
  for(const e of this.enemies)if(e.raid)this.finishPonyRaid(e);
  this.resolveDividends();
  this.enemies=this.enemies.filter(e=>e.hp>0);
  for(const u of this.units)if(u.hp<=0&&!this.reviveNearby(u))this.depart(u,'unit');
  this.units=this.units.filter(u=>u.hp>0);
  // Resolve pose priority after melee/projectile reactions, without changing
  // movement, attack timers or damage: beam-hit is a visual hold, not a stun, so
  // an illuminated CEO keeps its hit drawing and keeps walking into the garden.
  this.syncBeamAnimations();
  if(this.wave>0&&!this.queue.length&&!this.enemies.length&&!this.waveCleared){
   this.waveCleared=true;
   this.nextWaveTimer=Math.min(this.nextWaveTimer??Infinity,WAVE_PACING.breather);this.emit('waveClear',{wave:this.wave});
  }
 }
}
