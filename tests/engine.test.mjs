import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame} from '../dist/engine.js';
import {MODELS,COPY} from '../dist/data.js';
const make=(opts={})=>new GardenGame({seed:42,starter:false,...opts});
function tick(g,seconds){for(let i=0;i<Math.ceil(seconds*60);i++)g.update(1/60);}

test('placement deducts the cost once, validates tiles, and enforces cooldown',()=>{
 const g=make();assert.equal(g.plant('deepseek',0,0).ok,true);assert.equal(g.tokens,150);
 assert.equal(g.plant('deepseek',0,0).reason,'occupied');
 assert.equal(g.plant('deepseek',0,1).reason,'cooldown');
 assert.equal(g.plant('deepseek',-1,0).ok,false);assert.equal(g.plant('deepseek',0,9).ok,false);
 tick(g,5.1);assert.equal(g.plant('deepseek',0,1).ok,true);assert.equal(g.tokens,100);
});
test('preparation allows setup without passive income or enemies',()=>{
 const g=make();g.plant('deepseek',0,0);tick(g,30);
 assert.equal(g.tokens,150);assert.equal(g.coins.length,0);assert.equal(g.enemies.length,0);assert.equal(g.time,0);
});
test('DeepSeek produces income, collecting is idempotent, and airdrops auto-collect',()=>{
 const g=make();g.plant('deepseek',0,0);g.start();tick(g,7.1);
 const production=g.coins.find(c=>!c.falling);assert.ok(production);const before=g.tokens;
 assert.equal(g.collect(production.id),true);assert.equal(g.tokens,before+25);assert.equal(g.collect(production.id),false);
 assert.ok(g.coins.some(c=>c.falling));tick(g,8.1);assert.ok(g.tokens>=before+50);
});
test('Claude strikes after one second in Chinese and recovers on language or Easter-egg changes',()=>{
 const g=make();const {unit}=g.plant('claude',0,0);
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
test('Claude projectiles pierce multiple CEOs and do not hit a target twice',()=>{
 const g=make({lang:'en'});g.tokens=999;g.start();const {unit}=g.plant('claude',1,0);unit.attackTimer=999;
 const targets=[300,400,500].map(x=>{const e=g.spawnEnemy('sam',1);e.x=x;return e;});
 g.fire(unit,targets[0],{pierce:3});tick(g,1.4);
 for(const e of targets)assert.ok(e.hp<e.maxHp);
 assert.equal(g.projectiles.length,0);
});
test('GLM slows enemies and Grok splash damages nearby targets',()=>{
 const g=make();g.tokens=999;g.start();const {unit}=g.plant('glm',0,0);unit.attackTimer=999;
 const a=g.spawnEnemy('sam',0);a.x=300;g.fire(unit,a,{slow:3});tick(g,.5);assert.ok(a.slow>2);
 const b=g.spawnEnemy('sam',0);b.x=a.x+30;const hp=b.hp;
 g.fire({...unit,model:'grok'},a,{splash:90,damage:50});tick(g,.5);assert.ok(b.hp<hp);
});
test('Gemini reaches an adjacent lane and Kimi heals a neighboring ally',()=>{
 const g=make();g.tokens=999;g.start();const {unit}=g.plant('gemini',1,0);unit.attackTimer=999;
 const e=g.spawnEnemy('sam',2);e.x=300;assert.equal(g.attack(unit),true);tick(g,.7);assert.ok(e.hp<e.maxHp);
 const q=g.plant('qwen',1,1).unit;q.hp=300;const k=g.plant('kimi',1,2).unit;k.produceTimer=.01;tick(g,.1);assert.equal(q.hp,340);
});
test('CEO special abilities activate: rocket, shields, forks, and Token theft',()=>{
 const g=make();g.start();g.nextWaveTimer=999;
 const elon=g.spawnEnemy('elon',0),dario=g.spawnEnemy('dario',1),mark=g.spawnEnemy('mark',2),liang=g.spawnEnemy('liang',3);
 elon.abilityTimer=8.95;dario.abilityTimer=9.95;mark.abilityTimer=11.95;liang.abilityTimer=11.95;
 tick(g,.1);assert.ok(elon.boost>0);assert.equal(dario.shield,80);assert.equal(g.enemies.filter(e=>e.mini).length,2);assert.equal(g.tokens,180);
});
test('Jensen armor absorbs damage and Qwen counterattacks armor when hit',()=>{
 const g=make();g.tokens=999;g.start();const q=g.plant('qwen',0,4).unit,e=g.spawnEnemy('jensen',0);e.x=q.x+55;
 const hp=e.hp;g.damageEnemy(e,50);assert.equal(e.hp,hp);assert.equal(e.armor,100);tick(g,.1);assert.equal(e.armor,70);assert.ok(q.hp<q.maxHp);
});
test('each lane has exactly one rescue and a second breach ends the run',()=>{
 const g=make();g.start();g.nextWaveTimer=999;const first=g.spawnEnemy('sam',2);first.x=60;tick(g,.02);
 assert.equal(g.mowers[2],false);assert.equal(g.phase,'playing');assert.equal(g.kills,1);
 const second=g.spawnEnemy('sam',2);second.x=60;tick(g,.02);assert.equal(g.phase,'lost');
});
test('removal refunds half cost and cannot duplicate refunds',()=>{
 const g=make();g.plant('claude',0,0);assert.equal(g.tokens,25);assert.equal(g.remove(0,0).ok,true);assert.equal(g.tokens,112);assert.equal(g.remove(0,0).ok,false);assert.equal(g.tokens,112);
});
test('six real waves can complete and emit a victory only once',()=>{
 const g=make();g.start();const types=new Set();
 for(let i=0;i<18000&&g.phase==='playing';i++){
  g.update(1/60);
  for(const e of g.enemies){types.add(e.type);e.armor=0;e.shield=0;g.damageEnemy(e,99999);}
 }
 assert.equal(g.phase,'won');assert.equal(g.wave,6);assert.equal(types.size,6);
 assert.equal(g.drainEvents().filter(e=>e.type==='win').length,1);tick(g,10);assert.equal(g.drainEvents().filter(e=>e.type==='win').length,0);
});
test('all nine model abilities and every interface string exist in all three languages',()=>{
 assert.equal(MODELS.length,9);
 const keys=Object.keys(COPY.zh).sort();
 for(const lang of ['en','ja'])assert.deepEqual(Object.keys(COPY[lang]).sort(),keys);
 for(const m of MODELS)for(const key of ['role','skill','desc','quote'])for(const lang of ['zh','en','ja'])assert.equal(typeof m[key][lang],'string');
});

test('a budget-constrained farming and defense strategy wins all six standard waves',()=>{
 const g=new GardenGame({lang:'zh',difficulty:'normal',eggs:true,seed:42});
 const plan=[];
 for(const row of [0,1,3,4])plan.push(['deepseek',row,0]);
 for(const row of [0,1,3,4])plan.push(['chatgpt',row,2]);
 for(const model of ['glm','grok'])for(let row=0;row<5;row++)plan.push([model,row,model==='glm'?3:4]);
 for(const row of [0,1,3,4])plan.push(['qwen',row,5]);
 for(let row=0;row<5;row++)plan.push(['minimax',row,6]);
 g.start();let step=0;
 for(let n=0;n<24000&&g.phase==='playing';n++){
  if(step<plan.length&&g.plant(...plan[step]).ok)step++;
  for(const coin of [...g.coins])g.collect(coin.id);
  g.update(1/60);assert.ok(g.tokens>=0);
 }
 assert.equal(g.phase,'won');assert.equal(g.wave,6);assert.equal(step,plan.length);assert.ok(g.kills>=40);
});
