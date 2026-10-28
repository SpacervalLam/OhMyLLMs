import {fullSkill} from './helpers/full-skill.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame} from '../dist/engine.js';
import {MODELS,COPY} from '../dist/data.js';
const make=(opts={})=>new GardenGame({seed:42,starter:false,...opts});
function tick(g,seconds){for(let i=0;i<Math.ceil(seconds*60);i++)g.update(1/60);}

test('placement deducts the cost once, validates tiles, and enforces cooldown while playing',()=>{
 const g=make();assert.equal(g.plant('deepseek',0,0).ok,true);assert.equal(g.tokens,150);
 assert.equal(g.plant('kimi',0,0).reason,'occupied');
 // preparation is a free build phase, so the second copy is not blocked by recharge
 assert.equal(g.plant('deepseek',0,1).ok,true);assert.equal(g.tokens,100);
 assert.equal(g.plant('deepseek',-1,0).ok,false);assert.equal(g.plant('deepseek',0,9).ok,false);
 g.start();
 assert.equal(g.plant('deepseek',0,2).ok,true);assert.equal(g.tokens,50);
 assert.equal(g.plant('deepseek',0,3).reason,'cooldown');
 const cd=MODELS.find(m=>m.id==='deepseek').cooldown;
 tick(g,cd+0.1);assert.equal(g.plant('deepseek',0,3).ok,true);
});
test('preparation never starts a recharge, the run does',()=>{
 const g=make();g.tokens=500;
 assert.equal(g.plant('qwen',0,0).ok,true);
 assert.equal(g.plant('qwen',1,0).ok,true);
 assert.equal(g.plant('qwen',2,0).ok,true);
 assert.deepEqual(g.cooldowns,{});
 g.start();
 assert.equal(g.plant('qwen',3,0).ok,true);
 assert.equal(g.plant('qwen',4,0).reason,'cooldown');
 assert.equal(g.cooldowns.qwen,MODELS.find(m=>m.id==='qwen').cooldown);
});
test('preparation allows setup without passive income or enemies',()=>{
 const g=make();g.plant('deepseek',0,0);tick(g,30);
 assert.equal(g.tokens,150);assert.equal(g.coins.length,0);assert.equal(g.enemies.length,0);assert.equal(g.time,0);
});
test('DeepSeek produces income, collecting is idempotent, and airdrops auto-collect',()=>{
 const g=make();fullSkill(g.plant('deepseek',0,0).unit);g.start();tick(g,7.1);
 const production=g.coins.find(c=>!c.falling);assert.ok(production);const before=g.tokens;
 assert.equal(g.collect(production.id),true);assert.equal(g.tokens,before+100);assert.equal(g.collect(production.id),false);
 assert.ok(g.coins.some(c=>c.falling));tick(g,8.1);assert.ok(g.tokens>=before+125);
});
test('DeepSeek tosses its rice along an arc and the coin lands collectible',()=>{
 const g=make();fullSkill(g.plant('deepseek',0,0).unit);g.start();
 const u=g.units[0];u.produceTimer=.05;tick(g,.06);
 const coin=g.coins.find(c=>!c.falling);
 assert.ok(coin&&coin.arc);                       // tossed, not spawned underfoot
 const x0=coin.x;tick(g,.3);
 assert.ok(coin.x>x0&&coin.y<u.y);                // mid-arc: rightward and off the hand
 tick(g,.4);
 assert.equal(coin.arc,null);                     // landed
 assert.ok(Math.abs(coin.x-(u.x+38))<2&&Math.abs(coin.y-(u.y+2))<2);
 const before=g.tokens;assert.equal(g.collect(coin.id),true);assert.equal(g.tokens,before+100);
});
test('Claude strikes after one second in Chinese and recovers on language or Easter-egg changes',()=>{
 const g=make();const unit=fullSkill(g.plant('claude',0,0).unit);
 tick(g,.9);assert.equal(unit.strike,false);tick(g,.2);assert.equal(unit.strike,true);
 g.setLanguage('en');assert.equal(unit.strike,false);g.setLanguage('ja');assert.equal(unit.strike,false);
 g.setLanguage('zh');assert.equal(unit.strike,true);g.setEggs(false);assert.equal(unit.strike,false);
 assert.ok(g.drainEvents().some(e=>e.type==='resumeClaude'));
});
test('pausing freezes enemy movement, production, cooldowns, coins, and battle time',()=>{
 const g=make();g.start();g.plant('deepseek',0,0);const e=g.spawnEnemy('sam',0);g.coin(300,200);tick(g,.5);g.pause();
 const before=JSON.stringify({x:e.x,t:g.time,tokens:g.tokens,cool:g.cooldowns,coins:g.coins,units:g.units});
 tick(g,20);assert.equal(JSON.stringify({x:e.x,t:g.time,tokens:g.tokens,cool:g.cooldowns,coins:g.coins,units:g.units}),before);
 g.resume();tick(g,.5);assert.ok(e.x<1055);
});
test('Claude contracts resolve together on marked local targets, including adjacent lanes',()=>{
 const g=make({lang:'en'});g.tokens=9999;g.start();g.nextWaveTimer=999;
 const unit=fullSkill(g.plant('claude',1,0).unit);unit.attackTimer=999;unit.basicTimer=999;
 function enemy(row,x){const e=g.spawnEnemy('sam',row);e.x=x;e.speed=0;e.abilityTimer=-999;return e;}
 const anchor=enemy(1,400),near=enemy(1,480),adjacent=enemy(2,400),far=enemy(1,700);
 adjacent.shield=80;assert.equal(g.attack(unit),true);
 tick(g,.6);for(const e of [anchor,near,adjacent,far])assert.equal(e.hp,e.maxHp);
 const newcomer=enemy(1,410);anchor.x+=30;
 tick(g,.1);for(const e of [anchor,near,adjacent])assert.equal(e.maxHp-e.hp,45);
 assert.equal(adjacent.shield,0);for(const e of [far,newcomer])assert.equal(e.hp,e.maxHp);
 const hp=anchor.hp;tick(g,.6);assert.equal(anchor.hp,hp);assert.equal(g.sweeps.length,0);
});

test('two-star Claude caps contracts at two, preserves shields and freezes its warning on pause',()=>{
 const g=make({lang:'en'});g.tokens=9999;const unit=g.plant('claude',1,0).unit;unit.stars=2;
 const enemies=[400,420,430].map(x=>{const e=g.spawnEnemy('sam',1);e.x=x;e.speed=0;e.abilityTimer=-999;return e;});
 enemies[0].shield=80;g.attack(unit);g.start();g.nextWaveTimer=999;unit.attackTimer=999;unit.basicTimer=999;
 tick(g,.3);g.pause();const age=g.sweeps[0].age;tick(g,1);assert.equal(g.sweeps[0].age,age);g.resume();tick(g,.4);
 assert.equal(enemies[0].hp,enemies[0].maxHp);assert.equal(enemies[0].shield,53);
 assert.equal(enemies[1].maxHp-enemies[1].hp,27);assert.equal(enemies[2].hp,enemies[2].maxHp);
});

test('ChatGPT beam channels over the lane and hits every enemy in it',()=>{
 const g=make();g.tokens=999;g.start();const unit=fullSkill(g.plant('chatgpt',2,0).unit);unit.attackTimer=999;
 const a=g.spawnEnemy('sam',2);a.x=300;const b=g.spawnEnemy('sam',2);b.x=420;
 const other=g.spawnEnemy('sam',3);other.x=300;
 assert.equal(g.attack(unit),true);
 assert.ok(unit.beam&&unit.beam.charge>0);
 tick(g,.5); // charge done, channel running
 const ha=a.hp;tick(g,1);
 assert.ok(a.hp<ha&&b.hp<b.maxHp);                 // both lane targets take the same ticks
 assert.equal(ha-a.hp,b.maxHp-b.hp);
 assert.equal(other.hp,other.maxHp);               // other lanes untouched
 tick(g,1.6);
 assert.equal(unit.beam,null);                     // channel ends on its own
 assert.ok(ha-a.hp>=40&&ha-a.hp<=56);              // 4 dmg per 0.12s tick over 1.45s
});
test('Gemini stars link two lanes and the segment damages enemies between',()=>{
 const g=make();g.tokens=999;g.start();const unit=fullSkill(g.plant('gemini',1,0).unit);unit.attackTimer=999;
 // Equal x keeps spawn order in the sort, so the two stars pick rows 0 and 2.
 const up=g.spawnEnemy('sam',0);up.x=300;
 const down=g.spawnEnemy('sam',2);down.x=300;
 const mid=g.spawnEnemy('sam',1);mid.x=300;
 assert.equal(g.attack(unit),true);
 tick(g,2);
 assert.equal(up.maxHp-up.hp,20);                  // star damage only
 assert.equal(down.maxHp-down.hp,20);
 assert.equal(mid.maxHp-mid.hp,20);                // segment only, no star touched it
 assert.equal(g.links&&Object.keys(g.links).length,0);
});
test('Kimi heals a neighboring ally and emits a link effect to it',()=>{
 const g=make();g.tokens=999;g.start();
 const q=fullSkill(g.plant('qwen',1,1).unit);q.hp=100;
 const k=fullSkill(g.plant('kimi',1,2).unit);k.produceTimer=.01;
 tick(g,.1);
 assert.equal(q.hp,140);
 assert.ok(g.effects.some(f=>f.type==='link'&&Math.abs(f.tx-q.x)<1&&Math.abs(f.ty-(q.y-10))<1));
});
test('GLM creates an enemy-centered frost field without impact damage',()=>{
 const g=make();g.tokens=999;g.start();const unit=fullSkill(g.plant('glm',0,0).unit);unit.attackTimer=999;unit.freezeBasics=4;
 const a=g.spawnEnemy('sam',0);a.x=400;a.speed=0;
 assert.equal(g.attack(unit),true);
 assert.equal(g.zones.length,1);
 const z=g.zones[0];
 assert.equal(z.x1-z.x0,200);                       // two tiles wide
 assert.equal(z.y1-z.y0,96);                        // and exactly one lane tall
 tick(g,.42);assert.equal(a.maxHp-a.hp,0);          // the landing stone deals no damage
 tick(g,.6);assert.ok(a.slow>0);                    // the frost only slows
 const hp=a.hp;tick(g,1.5);assert.equal(a.hp,hp);    // and never bleeds
 const outside=g.spawnEnemy('sam',0);outside.x=900;outside.speed=0;
 tick(g,.5);assert.equal(outside.slow||0,0);         // outside the two tiles nothing happens
 const otherLane=g.spawnEnemy('sam',1);otherLane.x=400;otherLane.speed=0;
 tick(g,.5);assert.equal(otherLane.slow||0,0);       // the patch never leaves its lane
 tick(g,2.2);assert.equal(g.zones.length,0);
 tick(g,3.2);assert.equal(a.slow,0);                 // the slow decays after the ice is gone
});
test('Elon ignores frost slow at normal speed and during rocket boost',()=>{
 for(const boost of [0,2]){
  const g=make();g.start();g.nextWaveTimer=999;
  const elon=g.spawnEnemy('elon',2);elon.x=500;elon.boost=boost;
  const sam=g.spawnEnemy('sam',2);sam.x=530;
  g.zones.push({x:500,y:elon.y,x0:400,x1:600,y0:elon.y-48,y1:elon.y+48,age:1,until:3,landed:true,slowFactor:.45,slowDuration:3});
  g.update(.1);
  assert.equal(elon.slow,0);
  assert.ok(Math.abs(elon.x-(500-elon.speed*(boost?3:1)*.1))<1e-8);
  assert.ok(sam.slow>0,'other enemies still receive the frost slow');
 }
});

test('Grok blast knocks enemies back and blows Elon off his rocket',()=>{
 const g=make();g.tokens=999;g.start();const unit=fullSkill(g.plant('grok',0,0).unit);unit.attackTimer=999;
 const a=g.spawnEnemy('sam',0);a.x=300;const b=g.spawnEnemy('sam',0);b.x=330;
 g.attack(unit);tick(g,.6);
 assert.ok(a.x>300-14*.6&&b.x>330-14*.6);                      // both shoved down-lane by the blast
 assert.ok(a.hp<a.maxHp&&b.hp<b.maxHp);            // direct hit plus splash
 const elon=g.spawnEnemy('elon',0);elon.x=320;elon.boost=2;
 unit.attackTimer=999;g.attack(unit);
 let before=elon.x;
 for(let i=0;i<60&&elon.boost>0;i++){before=elon.x;g.update(1/60);}
 assert.equal(elon.boost,0);                       // the rocket is blown off course
 assert.ok(elon.knockback);assert.ok(Math.abs(elon.x-before)<3); // impact schedules a push, never teleports
 const impactX=elon.x;tick(g,.35);assert.ok(elon.x>impactX+8);
});
test('MiniMax rewinds its strip across three lanes and freezes what it passes',()=>{
 const g=make();g.tokens=999;g.start();const unit=fullSkill(g.plant('minimax',1,0).unit);unit.attackTimer=999;
 const a=g.spawnEnemy('sam',1);a.x=350;
 const up=g.spawnEnemy('sam',0);up.x=350;
 g.attack(unit);tick(g,.3);                        // the strip reaches both CEOs on the way out
 assert.ok(a.stun>0&&up.stun>0);                   // the sweep covers adjacent lanes
 const x0=a.x;tick(g,.2);
 assert.ok(Math.abs(a.x-x0)<1);                    // frozen frame: no movement at all
 tick(g,.3);
 assert.ok(a.x<x0);                                // and it walks again afterwards
});
test('the rewind leg pays CEOs that already walked past MiniMax',()=>{
 const g=make();g.tokens=999;g.start();const unit=fullSkill(g.plant('minimax',2,4).unit);unit.attackTimer=999;
 const behind=g.spawnEnemy('sam',2);behind.x=unit.x-120;behind.speed=0;behind.hp=behind.maxHp=500;behind.abilityTimer=-999;
 const front=g.spawnEnemy('sam',2);front.x=unit.x+300;front.speed=0;front.hp=front.maxHp=500;front.abilityTimer=-999;
 g.attack(unit);tick(g,.6);
 assert.equal(behind.hp,500,'the outbound leg never reaches behind her');
 assert.ok(front.hp<500,'the outbound leg pays the front');
 tick(g,1.8);
 assert.ok(behind.hp<500,'the rewind leg covers the CEOs behind her');
 // Nothing left in front is still a reason to fire: the strip comes back anyway.
 g.enemies=g.enemies.filter(e=>e!==front);g.projectiles=[];
 const leaked=g.spawnEnemy('sam',2);leaked.x=unit.x-200;leaked.speed=0;leaked.hp=leaked.maxHp=500;leaked.abilityTimer=-999;
 assert.equal(g.attack(unit),true,'a leaked CEO behind her must still pull a cast');
 tick(g,1.9);
 assert.ok(leaked.hp<500,'the rewind leg reaches a lane that had already leaked');
});
test('Qwen force field shelters adjacent allies but not distant ones',()=>{
 const g=make();g.tokens=999;g.start();
 const q=fullSkill(g.plant('qwen',1,1).unit);
 const ally=fullSkill(g.plant('chatgpt',1,2).unit);
 const far=fullSkill(g.plant('glm',2,4).unit);
 const e=g.spawnEnemy('jensen',1);e.x=ally.x+40;e.attackTimer=.05;
 tick(g,.2);
 assert.equal(ally.maxHp-ally.hp,Math.round(e.damage*.75)); // sheltered: 27 of 36
 const e2=g.spawnEnemy('jensen',2);e2.x=far.x+40;e2.attackTimer=.05;
 tick(g,.2);
 assert.equal(far.maxHp-far.hp,e2.damage);                  // unsheltered: full 36
});
test('CEO special abilities activate: rocket, shields, forks, and Token theft',()=>{
 const g=make();g.start();g.nextWaveTimer=999;
 const elon=g.spawnEnemy('elon',0),dario=g.spawnEnemy('dario',1),mark=g.spawnEnemy('mark',2),liang=g.spawnEnemy('liang',3);
 elon.abilityTimer=8.95;dario.abilityTimer=9.95;mark.abilityTimer=11.95;liang.abilityTimer=11.95;
 tick(g,.1);assert.ok(elon.boost>0);assert.equal(dario.shield,80);assert.equal(g.enemies.filter(e=>e.mini).length,2);assert.equal(g.tokens,180);
});
test('Jensen armor absorbs damage and Qwen counterattacks armor when hit',()=>{
 const g=make();g.tokens=999;g.start();const q=fullSkill(g.plant('qwen',0,4).unit),e=g.spawnEnemy('jensen',0);e.x=q.x+55;
 const hp=e.hp;g.damageEnemy(e,50);assert.equal(e.hp,hp);assert.equal(e.armor,100);tick(g,.1);assert.equal(e.armor,70);assert.ok(q.hp<q.maxHp);
});
test('each lane has exactly one rescue and a second breach ends the run',()=>{
 const g=make();g.start();g.nextWaveTimer=999;const first=g.spawnEnemy('sam',2);first.x=60;tick(g,.02);
 assert.equal(g.mowers[2],false);assert.equal(g.phase,'playing');assert.equal(g.kills,1);
 const second=g.spawnEnemy('sam',2);second.x=60;tick(g,.02);assert.equal(g.phase,'lost');
});

test('Jensen stops a GPU cart, restores armor, and protects enemies behind him',()=>{
 const g=make();g.start();g.nextWaveTimer=999;
 const breach=g.spawnEnemy('sam',2);breach.x=60;
 const front=g.spawnEnemy('elon',2);front.x=250;
 const jensen=g.spawnEnemy('jensen',2);jensen.x=480;jensen.armor=0;
 const behind=g.spawnEnemy('sam',2);behind.x=700;
 const second=g.spawnEnemy('jensen',2);second.x=800;second.armor=20;
 const otherLane=g.spawnEnemy('sam',1);otherLane.x=250;
 const hp=jensen.hp;
 g.update(.01);
 assert.ok(breach.hp<=0);assert.ok(front.hp<=0);
 assert.equal(jensen.hp,hp);assert.equal(jensen.armor,150);
 assert.equal(second.armor,20);assert.ok(behind.hp>0);assert.ok(otherLane.hp>0);
 assert.equal(g.mowers[2],false);assert.equal(g.kills,2);
 const cart=g.effects.find(f=>f.type==='mower');
 assert.ok(Math.abs(cart.endX-(jensen.x-30))<1);
});

test('Jensen triggering the cart himself survives and restores full armor',()=>{
 const g=make();g.start();g.nextWaveTimer=999;
 const jensen=g.spawnEnemy('jensen',0);jensen.x=60;jensen.armor=5;
 const hp=jensen.hp;g.update(.01);
 assert.equal(jensen.hp,hp);assert.equal(jensen.armor,150);
 assert.equal(g.kills,0);assert.equal(g.mowers[0],false);
});
test('removal refunds half cost and cannot duplicate refunds',()=>{
 const g=make();const cost=MODELS.find(m=>m.id==='claude').cost;
 g.plant('claude',0,0);assert.equal(g.tokens,200-cost);
 assert.equal(g.remove(0,0).ok,true);const refunded=200-cost+Math.floor(cost/2);assert.equal(g.tokens,refunded);
 assert.equal(g.remove(0,0).ok,false);assert.equal(g.tokens,refunded);
});
test('six real waves continue into wave seven without emitting a victory',()=>{
 const g=make();g.start();const types=new Set();
 for(let i=0;i<36000&&g.phase==='playing'&&g.wave<7;i++){
  g.update(1/60);
  for(const e of g.enemies){types.add(e.type);e.armor=0;e.shield=0;g.damageEnemy(e,99999);}
 }
 assert.equal(g.phase,'playing');assert.equal(g.wave,7);assert.equal(types.size,14);assert.ok(g.score>0);
 assert.equal(g.drainEvents().filter(e=>e.type==='win').length,0);tick(g,1);assert.equal(g.drainEvents().filter(e=>e.type==='win').length,0);
});
test('all eleven model abilities and every interface string exist in all three languages',()=>{
 assert.equal(MODELS.length,11);
 const keys=Object.keys(COPY.zh).sort();
 for(const lang of ['en','ja'])assert.deepEqual(Object.keys(COPY[lang]).sort(),keys);
 for(const m of MODELS)for(const key of ['role','skill','desc','quote'])for(const lang of ['zh','en','ja'])assert.equal(typeof m[key][lang],'string');
});

test('a budget-constrained strategy rebuilds abducted units and reaches the endless seventh wave',()=>{
 const g=new GardenGame({lang:'zh',difficulty:'normal',eggs:true,seed:42});
 const plan=[['deepseek',2,0],['deepseek',2,0]];
 for(const row of [0,1,3,4])plan.push(['chatgpt',row,2]);
 for(const row of [0,1])for(let k=0;k<3;k++)plan.push(['deepseek',row,0]);
 for(const row of [0,1,3,4])plan.push(['qwen',row,5]);
 for(const row of [2,0,1,3,4])for(let k=0;k<2;k++)plan.push(['chatgpt',row,2]);
 for(const row of [2,0,1,3,4])for(let k=0;k<4;k++)plan.push(['chatgpt',row,2]);
 const goals=new Map(g.units.map(u=>[`${u.row},${u.col}`,{model:u.model,row:u.row,col:u.col,copies:u.copies}]));
 g.start();let step=0,upgrades=0,repairs=0,abductions=0;
 for(let n=0;n<30000&&g.phase==='playing'&&g.wave<7;n++){
  for(const goal of goals.values()){
   const unit=g.units.find(u=>u.row===goal.row&&u.col===goal.col);
   if((unit?.copies??0)<goal.copies&&g.plant(goal.model,goal.row,goal.col).ok)repairs++;
  }
  if(step<plan.length){const result=g.plant(...plan[step]);if(result.ok){const u=result.unit;goals.set(`${u.row},${u.col}`,{model:u.model,row:u.row,col:u.col,copies:u.copies});step++;}}
  for(const coin of [...g.coins])g.collect(coin.id);
  g.update(1/60);assert.ok(g.tokens>=0);
  for(const e of g.drainEvents()){if(e.type==='upgrade')upgrades++;if(e.type==='abducted')abductions++;}
 }
 assert.equal(g.phase,'playing');assert.equal(g.wave,7);assert.ok(upgrades>=6);assert.ok(g.units.some(u=>u.stars===3));assert.ok(g.kills>=40);assert.ok(g.score>0);assert.ok(abductions>0&&repairs>0);
});


test('president mode allows deployment and promotion at zero tokens without free-copy refunds',()=>{
 const g=make({presidentMode:true});g.tokens=0;
 assert.equal(g.availableTokens,Infinity);
 let u;for(let i=0;i<7;i++){const r=g.plant('claude',0,0);assert.equal(r.ok,true);u=r.unit;}
 assert.equal(u.stars,3);assert.equal(g.tokens,0);assert.equal(u.invested,0);
 assert.equal(g.remove(0,0).ok,true);assert.equal(g.tokens,0);
 g.setPresidentMode(false);assert.equal(g.availableTokens,0);assert.equal(g.plant('claude',0,0).reason,'lackTokens');
});

test('president mode preserves ordinary balance and deployment cooldowns when toggled',()=>{
 const g=make();g.tokens=1000;const u=g.plant('claude',0,0).unit;
 const balance=g.tokens;g.setPresidentMode(true);g.start();
 assert.equal(g.plant('claude',0,0).ok,true);assert.equal(g.tokens,balance);
 assert.equal(g.plant('claude',0,0).reason,'cooldown');
 g.setPresidentMode(false);assert.equal(g.tokens,balance);
 assert.equal(u.invested,200);
});
