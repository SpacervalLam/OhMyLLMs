import { MODEL_MAP, CEO_MAP } from './data.js';
import {playAnimation,advanceAnimation} from './animation.js';

export const FIELD = Object.freeze({width:1120,height:650,x:100,y:104,cols:9,rows:5,cw:100,ch:96});
const WAVE_TYPES = [
 ['sam','sam','sam','elon'],
 ['sam','dario','sam','elon','dario','sam'],
 ['mark','sam','elon','liang','sam','mark','dario'],
 ['jensen','dario','elon','sam','liang','mark','sam','elon'],
 ['mark','jensen','liang','elon','dario','sam','jensen','elon','liang'],
 ['jensen','dario','mark','elon','liang','sam','jensen','mark','dario','elon','liang','jensen']
];

export class GardenGame {
 constructor({lang='zh',difficulty='normal',eggs=true,seed=Date.now(),starter=true}={}) {
  this.lang=lang; this.difficulty=difficulty; this.eggs=eggs;
  this.seed=seed>>>0; this.phase='ready'; this.time=0; this.tickTime=0;
  this.tokens=difficulty==='easy'?250:difficulty==='hard'?150:200;
  this.units=[]; this.enemies=[]; this.projectiles=[]; this.coins=[]; this.effects=[];this.departures=[];
  this.cooldowns={}; this.events=[]; this.kills=0; this.wave=0; this.totalWaves=6;
  this.mowers=Array(5).fill(true); this.queue=[]; this.spawnTimer=0;
  this.airdropTimer=6; this.nextWaveTimer=null; this.nextId=1;
  if(starter)for(const [model,row,col] of [['deepseek',2,0],['chatgpt',2,2],['qwen',2,5]]){
   const m=MODEL_MAP[model];this.units.push({id:this.nextId++,model,row,col,x:FIELD.x+col*100+50,y:FIELD.y+row*96+48,hp:m.hp,maxHp:m.hp,age:0,attackTimer:.5,produceTimer:m.period,shots:0,strike:false,flash:0});
  }
 }
 random(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296;}
 emit(type,detail={}){this.events.push({type,...detail});}
 drainEvents(){return this.events.splice(0);}
 start(){if(this.phase!=='ready')return false;this.phase='playing';this.nextWaveTimer=5;this.emit('start');return true;}
 pause(){if(this.phase==='playing'){this.phase='paused';return true;}return false;}
 resume(){if(this.phase==='paused'){this.phase='playing';return true;}return false;}
 setLanguage(lang){this.lang=lang;this.refreshStrikes();}
 setEggs(on){this.eggs=on;this.refreshStrikes();}
 refreshStrikes(){
  for(const u of this.units.filter(u=>u.model==='claude')){
   const strike=this.eggs&&this.lang==='zh'&&u.age>=1;
   if(u.strike!==strike){u.strike=strike;playAnimation(u,strike?'special':'idle');this.emit(strike?'strike':'resumeClaude',{unit:u.id});}
  }
 }
 plant(model,row,col){
  if(!['ready','playing'].includes(this.phase))return {ok:false,reason:'notPlaying'};
  const m=MODEL_MAP[model];
  if(!m||!Number.isInteger(row)||!Number.isInteger(col)||row<0||row>=5||col<0||col>=9)return {ok:false,reason:'empty'};
  if(this.units.some(u=>u.row===row&&u.col===col))return {ok:false,reason:'occupied'};
  if((this.cooldowns[model]||0)>0)return {ok:false,reason:'cooldown'};
  if(this.tokens<m.cost)return {ok:false,reason:'lackTokens'};
  this.tokens-=m.cost;this.cooldowns[model]=m.cooldown;
  const u={id:this.nextId++,model,row,col,x:FIELD.x+col*100+50,y:FIELD.y+row*96+48,hp:m.hp,maxHp:m.hp,age:0,attackTimer:0.5,produceTimer:m.period,shots:0,strike:false,flash:0};
  this.units.push(u);this.emit('plant',{unit:u.id,model,row,col});this.effect(u.x,u.y,'plant',m.color);
  return {ok:true,unit:u};
 }
 remove(row,col){
  if(!['ready','playing'].includes(this.phase))return {ok:false,reason:'notPlaying'};
  const i=this.units.findIndex(u=>u.row===row&&u.col===col);
  if(i<0)return {ok:false,reason:'empty'};
  const u=this.units.splice(i,1)[0];this.tokens+=Math.floor(MODEL_MAP[u.model].cost/2);this.depart(u,'unit');
  this.effect(u.x,u.y,'plant','#d8b56f');this.emit('remove',{model:u.model});return {ok:true};
 }
 collect(id){const i=this.coins.findIndex(c=>c.id===id);if(i<0)return false;const c=this.coins.splice(i,1)[0];this.tokens+=c.value;this.emit('collect',{value:c.value});this.effect(c.x,c.y,'token','#e9ba55',`+${c.value}`);return true;}
 coin(x,y,value=25,falling=false){this.coins.push({id:this.nextId++,x,y:falling?-20:y,targetY:y,value,age:0,falling});}
 effect(x,y,type,color,text=''){this.effects.push({x,y,type,color,text,age:0,duration:type==='blast'?0.55:type==='mower'?1.6:1});}
 spawnEnemy(type,row,options={}){
  const c=CEO_MAP[type],scale=this.difficulty==='easy'?.8:this.difficulty==='hard'?1.2:1;
  const growth=1+(this.wave-1)*0.075;
  const e={id:this.nextId++,type,row,x:1055+(options.offset||0),y:FIELD.y+row*96+48,hp:Math.round(c.hp*scale*growth),maxHp:Math.round(c.hp*scale*growth),speed:c.speed*(this.difficulty==='hard'?1.1:1),damage:c.damage,armor:c.armor||0,shield:0,age:0,slow:0,attackTimer:0,abilityTimer:0,boost:0,flash:0,mini:!!options.mini};
  if(e.mini){e.hp=e.maxHp=70;e.speed=21;e.damage=12;}
  playAnimation(e,'walk');e.animation.time=e.id*.067;this.enemies.push(e);return e;
 }
 beginWave(){
  if(this.wave>=this.totalWaves)return;
  this.wave++;this.nextWaveTimer=null;
  let types=[...WAVE_TYPES[this.wave-1]];
  if(this.difficulty==='hard')types.push('sam','elon');
  if(this.difficulty==='easy'&&this.wave>1)types=types.slice(0,-1);
  const firstRow=(this.wave-1)%5;
  this.queue=types.map((type,i)=>({type,row:i<5?(firstRow+i)%5:Math.floor(this.random()*5)}));
  this.spawnTimer=1.1;this.tokens+=this.wave===1?0:40;
  this.emit('wave',{wave:this.wave});
 }
 nextWave(){if(this.phase!=='playing'||this.nextWaveTimer===null)return false;this.tokens+=25;this.beginWave();return true;}
 damageEnemy(e,damage){
  if(e.hp<=0)return;
  let remaining=damage;
  for(const kind of ['shield','armor']){const blocked=Math.min(e[kind]||0,remaining);e[kind]-=blocked;remaining-=blocked;}
  e.hp-=remaining;e.flash=.14;playAnimation(e,'hurt');
  if(e.hp<=0){this.kills++;this.tokens+=e.mini?5:10;if(e.type==='liang'&&!e.mini)this.tokens+=40;this.emit('kill',{type:e.type});this.depart(e,'enemy');this.effect(e.x,e.y,'poof',CEO_MAP[e.type].color);}
 }
 depart(actor,kind){const ghost={...actor,kind,departureAge:0};playAnimation(ghost,'defeat');this.departures.push(ghost);}
 fire(u,target,{damage,slow=0,splash=0,pierce=1,delay=0}={}){
  const m=MODEL_MAP[u.model];
  this.projectiles.push({id:this.nextId++,model:u.model,x:u.x+27,y:u.y-14,targetY:target.y-14,row:target.row,vx:340,damage:damage??m.damage,slow,splash,pierce,hit:[],delay,targetId:target.id,age:0,color:m.color});
  u.flash=.2;playAnimation(u,'attack');this.emit('shoot',{model:u.model});
 }
 attack(u){
  const m=MODEL_MAP[u.model];
  const inFront=e=>e.hp>0&&e.x>u.x-20;
  const lane=this.enemies.filter(e=>e.row===u.row&&inFront(e)).sort((a,b)=>a.x-b.x);
  if(u.model==='gemini'){
   const targets=this.enemies.filter(e=>Math.abs(e.row-u.row)<=1&&inFront(e)).sort((a,b)=>a.x-b.x).slice(0,2);
   for(const e of targets)this.fire(u,e);
   return targets.length>0;
  }
  if(!lane.length)return false;
  const target=lane[0];u.shots++;
  if(u.model==='claude')this.fire(u,target,{pierce:3});
  else if(u.model==='glm')this.fire(u,target,{slow:3});
  else if(u.model==='grok')this.fire(u,target,{splash:90});
  else if(u.model==='minimax')this.fire(u,target,{splash:140});
  else {this.fire(u,target);if(u.model==='chatgpt'&&u.shots%4===0)this.fire(u,target,{delay:.18});}
  return true;
 }
 update(dt){
  if(this.phase==='paused'||dt<=0)return;
  dt=Math.min(dt,.1);this.tickTime+=dt;
  for(const d of this.departures){d.departureAge+=dt;advanceAnimation(d,dt,'defeat');}
  this.departures=this.departures.filter(d=>d.departureAge<.85);
  // Let the final defeat finish even when the last hit ends the battle.
  if(this.phase==='won'||this.phase==='lost'){
   for(const u of this.units)advanceAnimation(u,dt,u.strike?'special':'idle');
   return;
  }
  for(const id of Object.keys(this.cooldowns))this.cooldowns[id]=Math.max(0,this.cooldowns[id]-dt);
  for(const f of this.effects)f.age+=dt;this.effects=this.effects.filter(f=>f.age<f.duration);
  for(const u of this.units){u.age+=dt;u.flash=Math.max(0,u.flash-dt);advanceAnimation(u,dt,u.strike?'special':'idle');}
  this.refreshStrikes();
  if(this.phase!=='playing')return;
  this.time+=dt;
  if(this.nextWaveTimer!==null){this.nextWaveTimer-=dt;if(this.nextWaveTimer<=0)this.beginWave();}
  if(this.queue.length){this.spawnTimer-=dt;if(this.spawnTimer<=0){const next=this.queue.shift();this.spawnEnemy(next.type,next.row);this.spawnTimer=Math.max(1.6,3.9-this.wave*.25);}}
  this.airdropTimer-=dt;
  if(this.airdropTimer<=0){this.coin(FIELD.x+35+this.random()*830,FIELD.y+25+this.random()*420,25,true);this.airdropTimer=this.difficulty==='easy'?6:8;}
  for(const coin of [...this.coins]){coin.age+=dt;if(coin.falling)coin.y=Math.min(coin.targetY,coin.y+95*dt);if(coin.age>=8)this.collect(coin.id);}
  for(const u of this.units){
   if(u.hp<=0||u.strike)continue;
   const m=MODEL_MAP[u.model];
   if(m.damage===0){
    u.produceTimer-=dt;
    if(u.produceTimer<=0){u.produceTimer=m.period;playAnimation(u,'attack');
     if(u.model==='deepseek')this.coin(u.x+15,u.y-26,25);
     if(u.model==='kimi'){this.coin(u.x+15,u.y-26,15);for(const ally of this.units.filter(a=>Math.abs(a.row-u.row)<=1&&Math.abs(a.col-u.col)<=1)){ally.hp=Math.min(ally.maxHp,ally.hp+40);this.effect(ally.x,ally.y,'heal','#7ba88a','+40');}}
     if(u.model==='qwen'){u.hp=Math.min(u.maxHp,u.hp+30);this.effect(u.x,u.y,'heal','#7ba88a','+30');}
    }
   }else{u.attackTimer-=dt;if(u.attackTimer<=0){if(this.attack(u))u.attackTimer=m.period;else u.attackTimer=.15;}}
  }
  for(const e of [...this.enemies]){
   if(e.hp<=0)continue;e.age+=dt;e.flash=Math.max(0,e.flash-dt);e.slow=Math.max(0,e.slow-dt);e.boost=Math.max(0,e.boost-dt);e.abilityTimer+=dt;
   if(e.type==='dario'&&e.abilityTimer>=10){e.abilityTimer=0;e.shield=80;playAnimation(e,'attack');this.effect(e.x,e.y,'shield','#d49b6c');}
   if(e.type==='elon'&&e.abilityTimer>=9){e.abilityTimer=0;e.boost=2;this.effect(e.x,e.y,'boost','#da8a51');}
   if(e.type==='mark'&&!e.mini&&e.abilityTimer>=12){e.abilityTimer=-999;playAnimation(e,'attack');for(const offset of [18,55]){const baby=this.spawnEnemy('mark',e.row,{mini:true});baby.x=e.x+offset;}this.effect(e.x,e.y,'poof','#6e93b0');}
   if(e.type==='liang'&&e.abilityTimer>=12){e.abilityTimer=0;playAnimation(e,'attack');this.tokens=Math.max(0,this.tokens-20);this.emit('stolen');this.effect(e.x,e.y,'token','#ce715d','−20');}
   const blocker=this.units.filter(u=>u.row===e.row&&u.hp>0&&e.x-u.x<62&&e.x-u.x>-28).sort((a,b)=>b.x-a.x)[0];
   advanceAnimation(e,dt,blocker?'idle':'walk',e.slow>0?.55:e.boost>0?2.5:1);
   if(blocker){
    e.attackTimer-=dt;if(e.attackTimer<=0){e.attackTimer=1;blocker.hp-=e.damage;blocker.flash=.18;playAnimation(e,'attack');playAnimation(blocker,'hurt');this.effect(blocker.x,blocker.y-22,'hit','#d78a70');if(blocker.model==='qwen'&&e.type==='jensen')e.armor=Math.max(0,e.armor-30);}
   }else{e.x-=e.speed*(e.slow>0?.45:1)*(e.boost>0?3:1)*dt;}
   if(e.x<FIELD.x-32){
    if(this.mowers[e.row]){this.mowers[e.row]=false;for(const same of this.enemies.filter(a=>a.row===e.row&&a.hp>0)){same.armor=0;same.shield=0;this.damageEnemy(same,99999);}this.effect(20,e.y,'mower','#6c8355');this.emit('mower',{row:e.row});}
    else {this.phase='lost';this.emit('lose');return;}
   }
  }
  for(const p of this.projectiles){
   p.age+=dt;if(p.delay>0){p.delay-=dt;continue;}
   const previous=p.x;p.x+=p.vx*dt;p.y+=(p.targetY-p.y)*Math.min(1,dt*7);
   const targets=this.enemies.filter(e=>e.hp>0&&e.row===p.row&&!p.hit.includes(e.id)&&e.x+25>=previous&&e.x-25<=p.x).sort((a,b)=>a.x-b.x);
   for(const e of targets){
    let dmg=p.damage;if(this.eggs&&p.model==='grok'&&e.type==='elon')dmg*=1.4;
    this.damageEnemy(e,dmg);p.hit.push(e.id);if(p.slow)e.slow=p.slow;
    if(p.splash){this.effect(e.x,e.y-12,'blast',p.color);for(const near of this.enemies.filter(a=>a.id!==e.id&&a.hp>0&&Math.hypot(a.x-e.x,(a.row-e.row)*96)<p.splash))this.damageEnemy(near,p.damage*.7);}
    else this.effect(e.x,e.y-12,'hit',p.color);
    if(p.hit.length>=p.pierce){p.x=1300;break;}
   }
  }
  this.projectiles=this.projectiles.filter(p=>p.x<1200);
  this.enemies=this.enemies.filter(e=>e.hp>0);
  for(const u of this.units)if(u.hp<=0)this.depart(u,'unit');
  this.units=this.units.filter(u=>u.hp>0);
  if(this.wave>0&&!this.queue.length&&!this.enemies.length&&this.nextWaveTimer===null){
   if(this.wave===this.totalWaves){this.phase='won';this.emit('win');}
   else {this.nextWaveTimer=8;this.emit('waveClear',{wave:this.wave});}
  }
 }
}
