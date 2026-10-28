import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame} from '../dist/engine.js';
import {MODELS} from '../dist/data.js';
import {BASIC_ATTACKS,starsOf,HARNESSES,DEEPSEEK_INCOME,skillDescription,harnessDescription,stackDescription,harnessCost} from '../dist/ranks.js';
const scene=()=>{const g=new GardenGame({starter:false,lang:'en',seed:42});g.tokens=99999;return g;};
const tick=(g,s)=>{for(let i=0;i<Math.round(s*100);i++)g.update(.01);};
function put(g,model,stars=1,row=2,col=0){let u;for(let i=0;i<[0,1,3,7][stars];i++)u=g.plant(model,row,col).unit;return u;}
function target(g,row=2,x=500){const e=g.spawnEnemy('sam',row);e.x=x;e.hp=e.maxHp=9999;e.speed=0;e.abilityTimer=-999;return e;}
function battle(g){g.start();g.nextWaveTimer=999;g.timeStop=0;}

test('all starters are one-star and free copies refund no unpaid cost',()=>{
 const g=new GardenGame();assert.equal(g.units.length,3);for(const u of g.units){assert.equal(u.stars,1);assert.equal(u.copies,1);assert.equal(u.invested,0);}
 const tokens=g.tokens;g.remove(2,0);assert.equal(g.tokens,tokens);
});

test('exactly 1+2+4 copies merge in place, with no premature promotion or extra unit',()=>{
 for(const m of MODELS){const g=scene(),start=g.tokens;let id;
  for(let n=1;n<=7;n++){const r=g.plant(m.id,1,2);assert.ok(r.ok);const u=r.unit;id??=u.id;assert.equal(u.id,id);assert.equal(g.units.length,1);assert.equal(u.copies,n);assert.equal(u.stars,n<3?1:n<7?2:3);assert.equal(g.tokens,start-n*m.cost);assert.equal(g.harnesses.length,0);}
  const before=JSON.stringify([g.tokens,g.units,g.cooldowns,g.harnesses]);assert.deepEqual(g.plant(m.id,1,2),{ok:false,reason:'maxStars'});assert.equal(JSON.stringify([g.tokens,g.units,g.cooldowns,g.harnesses]),before);
  assert.equal(g.drainEvents().filter(e=>e.type==='upgrade').length,2);
 }
});

test('failed wrong-model, quota, cooldown and paused merges are atomic',()=>{
 const g=scene(),u=put(g,'deepseek');let before;
 for(const [act,reason]of [[()=>g.plant('kimi',2,0),'occupied'],[()=>{g.tokens=0;return g.plant('deepseek',2,0);},'lackTokens']]){before=u.copies;assert.equal(act().reason,reason);assert.equal(u.copies,before);}
 g.tokens=1000;g.start();assert.ok(g.plant('deepseek',2,0).ok);before=JSON.stringify([g.tokens,u,g.cooldowns]);assert.equal(g.plant('deepseek',2,0).reason,'cooldown');assert.equal(JSON.stringify([g.tokens,u,g.cooldowns]),before);
 tick(g,5.1);assert.ok(g.plant('deepseek',2,0).ok);assert.equal(u.stars,2);
 g.pause();before=JSON.stringify([g.tokens,u,g.cooldowns]);assert.equal(g.plant('deepseek',2,0).reason,'notPlaying');assert.equal(JSON.stringify([g.tokens,u,g.cooldowns]),before);
});

test('promotion preserves health fraction, raises the cap, and refunds every paid copy once',()=>{
 const g=scene(),start=g.tokens,u=put(g,'qwen');u.hp=u.maxHp/2;
 g.plant('qwen',2,0);g.plant('qwen',2,0);assert.equal(u.maxHp,1170);assert.equal(u.hp,585);
 for(let i=0;i<4;i++)g.plant('qwen',2,0);assert.equal(u.maxHp,1950);assert.equal(u.hp,975);
 assert.ok(g.remove(2,0).ok);assert.equal(g.tokens,start-770+385);assert.equal(g.remove(2,0).ok,false);assert.equal(g.tokens,start-385);
});

test('one-star attacks are strictly single-target basics with no skill payload for all attacking models',()=>{
 for(const m of MODELS){const g=scene(),u=put(g,m.id),e=target(g);target(g,1);if(['deepseek','kimi','qwen'].includes(m.id)){assert.equal(g.attack(u),false);assert.equal(g.projectiles.length,0);continue;}assert.ok(g.attack(u));
  assert.equal(g.projectiles.length,1);const p=g.projectiles[0];assert.equal(p.basic,true);assert.equal(p.damage,BASIC_ATTACKS[m.id].damage);assert.equal(p.splash,0);assert.equal(p.stun,0);assert.equal(p.knock,0);assert.equal(p.link,0);assert.ok(!u.beam);assert.equal(g.zones.length,0);assert.equal(g.sweeps.length,0);assert.ok(!g.effects.some(f=>f.type==='skillCast'));
  g.applyImpact(p,e);assert.ok(!e.burn);assert.equal(e.stun,0);
 }
});

test('one-star Kimi and Qwen do not produce or self-heal; one-star Qwen has no shelter or armor chip',()=>{
 for(const model of ['kimi','qwen']){const g=scene(),u=put(g,model);u.hp=80;u.produceTimer=.01;battle(g);tick(g,9);assert.equal(g.coins.filter(c=>!c.falling).length,0);assert.equal(u.hp,80);}
 const g=scene(),q=put(g,'qwen',1,2,0),ally=put(g,'deepseek',1,2,1);battle(g);const e=g.spawnEnemy('jensen',2);e.x=ally.x+45;e.attackTimer=0;g.update(.01);assert.equal(ally.maxHp-ally.hp,e.damage);e.x=q.x+45;e.attackTimer=0;g.update(.01);assert.equal(e.armor,150);
});

test('one-star Kimi heals only the next forward tile by 18 every eight seconds',()=>{
 const g=scene(),k=put(g,'kimi',1,2,2),front=put(g,'qwen',1,2,3),behind=put(g,'qwen',1,2,1),side=put(g,'qwen',1,1,2),far=put(g,'qwen',1,2,4);
 for(const u of [k,front,behind,side,far])u.hp=50;
 battle(g);target(g,4,1000);tick(g,7.99);assert.equal(front.hp,50);
 tick(g,.02);assert.equal(front.hp,68);for(const u of [k,behind,side,far])assert.equal(u.hp,50);
 tick(g,8.02);assert.equal(front.hp,86);assert.equal(g.coins.filter(c=>!c.falling).length,0);
 front.hp=front.maxHp-5;tick(g,8.02);assert.equal(front.hp,front.maxHp);assert.equal(g.projectiles.length,0);
});

test('Claude account hold applies at every rank and follows language and egg settings',()=>{
 for(const stars of [1,2,3]){
  const g=new GardenGame({starter:false,lang:'zh'});g.tokens=9999;const u=put(g,'claude',stars);
  tick(g,.9);assert.equal(u.strike,false);tick(g,.2);assert.equal(u.strike,true);
  assert.equal(g.drainEvents().filter(e=>e.type==='strike').length,1);
  tick(g,.2);assert.equal(g.drainEvents().filter(e=>e.type==='strike').length,0);
  for(const lang of ['en','ja']){g.setLanguage(lang);assert.equal(u.strike,false);g.setLanguage('zh');assert.equal(u.strike,true);}
  g.setEggs(false);assert.equal(u.strike,false);g.setEggs(true);assert.equal(u.strike,true);
 }
});

test('two-star skills are weaker and three-star skills keep their complete delivery shapes',()=>{
 for(const stars of [2,3]){
  {const g=scene(),u=put(g,'glm',stars);target(g);u.freezeBasics=4;g.attack(u);assert.equal(g.zones[0].x1-g.zones[0].x0,stars===3?200:100);assert.equal(g.zones[0].slowFactor,stars===3?.45:.7);}
  {const g=scene(),u=put(g,'chatgpt',stars);target(g);if(stars===2)u.beamBasics=3;g.attack(u);assert.equal(u.beam.damage,stars===3?4:3);assert.equal(u.beam.fire,stars===3?1.45:1.1);}
  {const g=scene(),u=put(g,'claude',stars);[400,500,600].forEach(x=>target(g,2,x));g.attack(u);assert.equal(g.sweeps[0].maxHits,stars===3?Infinity:2);assert.equal(g.sweeps[0].strip,stars===3);assert.equal(g.sweeps[0].damage,stars===3?45:27);}
  {const g=scene(),u=put(g,'minimax',stars);target(g);g.attack(u);const p=g.projectiles[0];assert.equal(p.rewind,true);assert.equal(p.dir,1);assert.equal(p.stun,stars===3?.4:.2);assert.equal(p.damage,stars===3?95:57);}
  {const g=scene(),u=put(g,'grok',stars),e=target(g);g.attack(u);g.applyImpact(g.projectiles[0],e);assert.equal(e.burn.remaining,stars===3?3:1.5);assert.equal(g.projectiles[0].knock,stars===3?12:6);}
  {const g=scene(),u=put(g,'gemini',stars);target(g);target(g,1);g.attack(u);assert.equal(g.projectiles.length,2);assert.equal(g.projectiles[0].damage,stars===3?20:12);}
 }
});

test('two-star and three-star support values and DeepSeek Harness bonuses match their tier',()=>{
 for(const stars of [2,3])for(const model of ['kimi','qwen']){
  const g=scene(),u=put(g,model,stars);battle(g);u.hp=50;u.produceTimer=.01;g.update(.02);
  if(model==='deepseek')assert.equal(g.coins[0].value,DEEPSEEK_INCOME[stars]);
  if(model==='kimi'){assert.equal(g.coins[0].value,stars===3?15:7);assert.equal(u.hp,stars===3?90:74);}
  if(model==='qwen')assert.equal(u.hp,stars===3?80:68);
 }
});

test('Kimi never attacks at any rank',()=>{
 for(const stars of [1,2,3]){const g=scene(),u=put(g,'kimi',stars);battle(g);target(g);tick(g,3);assert.equal(g.attack(u),false);assert.equal(g.projectiles.length,0);}
});

test('Kimi Code costs 300 and revives one neighboring LLM with a 60-second cooldown',()=>{
 const g=scene(),k=put(g,'kimi',3,2,2),a=put(g,'qwen',2,1,1),b=put(g,'deepseek',1,2,3),far=put(g,'glm',1,4,4);
 const before=g.tokens;assert.equal(g.equipHarness(k).ok,true);assert.equal(before-g.tokens,300);
 battle(g);target(g);a.hp=0;b.hp=0;far.hp=0;g.update(.01);
 assert.equal(a.hp,a.maxHp);assert.ok(g.units.includes(a));assert.ok(!g.units.includes(b));assert.ok(!g.units.includes(far));
 assert.equal(g.harnessFor(k).timer,60);assert.ok(!g.departures.some(d=>d.id===a.id));
 g.pause();g.update(1);assert.equal(g.harnessFor(k).timer,60);g.resume();
 tick(g,60.01);a.hp=0;g.update(.01);assert.equal(a.hp,a.maxHp);
 g.remove(k.row,k.col);a.hp=0;g.update(.01);assert.ok(!g.units.includes(a));
});

test('Harness is exclusive to three-star owners and is removed on both removal and defeat',()=>{
 for(const m of MODELS){
  const g=scene(),u=put(g,m.id,2);assert.equal(g.harnesses.length,0);assert.equal(g.harnessFor(u),null);g.equipHarness(u);assert.equal(g.harnesses.length,0);
  for(let n=0;n<4;n++)g.plant(m.id,2,0);assert.equal(g.harnesses.length,0);assert.equal(g.equipHarness(u).ok,true);assert.equal(g.harnesses.length,1);assert.equal(g.harnessFor(u).unitId,u.id);
  g.remove(2,0);assert.equal(g.harnesses.length,0);assert.equal(g.harnessFor(u),null);
  const replacement=put(g,m.id);assert.equal(g.harnessFor(replacement),null);assert.equal(replacement.copies,1);g.remove(2,0);
  const defeated=put(g,m.id,3);g.equipHarness(defeated);battle(g);defeated.hp=0;g.update(.01);assert.equal(g.harnesses.length,0);assert.equal(g.harnessFor(defeated),null);assert.ok(g.departures.some(d=>d.id===defeated.id));
 }
});

test('Codex resets quota on equip without freezing enemies or world time',()=>{
 const g=scene(),u=put(g,'chatgpt',3);battle(g);const e=target(g);e.speed=14;
 g.cooldowns.chatgpt=5;u.attackTimer=2;u.beam={charge:.4,fire:.2,tick:.12,damage:4};
 g.equipHarness(u);assert.equal(g.cooldowns.chatgpt,0);assert.equal(u.attackTimer,0);
 assert.equal(u.beam.charge,0);assert.equal(u.beam.fire,1.45);assert.equal(g.timeStop,0);
 tick(g,.1);assert.ok(e.x<500);assert.equal(e.stun,0);assert.ok(g.time>0);
 g.pause();const timer=g.harnessFor(u).timer;tick(g,1);assert.equal(g.harnessFor(u).timer,timer);
});

test('Codex resets quota every ten seconds and only for equipped owners',()=>{
 const g=scene(),u=put(g,'chatgpt',3),other=put(g,'chatgpt',3,1,0);g.equipHarness(u);battle(g);
 tick(g,9.98);g.cooldowns.chatgpt=5;u.attackTimer=2;other.attackTimer=2;
 tick(g,.04);assert.equal(g.cooldowns.chatgpt,0);assert.ok(u.attackTimer<=.15);assert.ok(other.attackTimer>1);
 assert.ok(g.harnessFor(u).timer>9.9);assert.equal(g.timeStop,0);
});

test('DeepSeek cannot attack at any rank, while upgraded Token production and Harness stay active',()=>{
 for(const stars of [1,2,3]){
  const g=scene(),u=put(g,'deepseek',stars),e=target(g);battle(g);g.drainEvents();
  assert.equal(g.attack(u),false);assert.equal(g.basicAttack(u,[e]),false);assert.equal(g.fire(u,e,{damage:999}),false);
  u.attackTimer=0;u.basicTimer=0;u.produceTimer=.01;tick(g,.6);
  assert.equal(g.projectiles.length,0);assert.equal(e.hp,e.maxHp);assert.equal(g.drainEvents().filter(e=>e.type==='shoot').length,0);
  const production=g.coins.filter(c=>!c.falling);assert.equal(production[0].value,DEEPSEEK_INCOME[stars]);
 }
});

test('DeepSeek produces exactly 25, 50 and 100 Tokens at seven-second intervals, including one star',()=>{
 for(const stars of [1,2,3]){const g=scene(),u=put(g,'deepseek',stars);battle(g);u.produceTimer=7;tick(g,6.9);assert.equal(g.coins.filter(c=>!c.falling).length,0);tick(g,.2);assert.deepEqual(g.coins.filter(c=>!c.falling).map(c=>c.value),[DEEPSEEK_INCOME[stars]]);tick(g,7);assert.deepEqual(g.coins.filter(c=>!c.falling).map(c=>c.value),[DEEPSEEK_INCOME[stars],DEEPSEEK_INCOME[stars]]);}
});

test('all models use concise numbered star descriptions without terminal punctuation in all languages',()=>{
 for(const lang of ['zh','en','ja'])for(const m of MODELS)for(const stars of [1,2,3]){
  const text=skillDescription(m,stars,lang);assert.ok(text.startsWith(`⭐${stars} · `));assert.ok(!/[。.!！?？]$/u.test(text));assert.ok(!/仅普通攻击|弱化技能|完整技能/.test(text));
 }
 const m=MODELS.find(m=>m.id==='deepseek');
 assert.equal(skillDescription(m,1,'zh'),'⭐1 · 每 7 秒产出 25 Token');
 assert.equal(skillDescription(m,2,'zh'),'⭐2 · 每 7 秒产出 50 Token');
 assert.equal(skillDescription(m,3,'zh'),'⭐3 · 鲸影跃出潮汐，水花化为金色 Token。每 7 秒产出 100 Token。先给大肥鱼一份工作，再给她一碗白饭');
 for(const lang of ['zh','en','ja'])assert.ok(harnessDescription('deepseek',3,lang).includes('25')&&harnessDescription('deepseek',3,lang).includes('50'));
});

test('hover stack text reports successful added copies only at every merge step',()=>{
 const g=scene();for(let copies=1;copies<=7;copies++){const {unit}=g.plant('deepseek',2,0);assert.equal(stackDescription(unit,'zh'),`已叠加 ${copies-1} 次`);assert.ok(stackDescription(unit,'en').includes(`${copies-1} times`));assert.ok(stackDescription(unit,'ja').includes(`回数 ${copies-1}`));}
 const u=g.units[0],before=stackDescription(u,'zh');assert.equal(g.plant('deepseek',2,0).ok,false);assert.equal(stackDescription(u,'zh'),before);
});


test('two-star ChatGPT releases one beam per three successful basic attacks',()=>{
 const g=scene(),u=put(g,'chatgpt',2),e=target(g);
 assert.equal(g.attack(u),false);assert.ok(!u.beam);
 for(let cycle=0;cycle<2;cycle++){
  for(let i=1;i<=3;i++){assert.equal(g.basicAttack(u,[e]),true);assert.equal(!!u.beam,i===3);}
  assert.equal(u.beamBasics,0);assert.equal(g.projectiles.length,(cycle+1)*3);
  assert.equal(g.attack(u),false);u.beam=null;
 }
 assert.equal(g.basicAttack(u,[]),false);assert.equal(u.beamBasics,0);
});


test('Qwen melee covers its tile and the front half tile only, without projectiles',()=>{
 for(const stars of [1,2,3])for(const [offset,hit] of [[-50,true],[-50.01,false],[-30,true],[0,true],[99.99,true],[100,true],[100.01,false]]){
  const g=scene(),u=put(g,'qwen',stars),e=target(g,2,u.x+offset),other=target(g,1,u.x);
  const hp=e.hp;assert.equal(g.attack(u),stars>1&&hit);
  assert.equal(e.hp<hp,stars>1&&hit);assert.equal(other.hp,9999);assert.equal(g.projectiles.length,0);
 }
});

test('Qwen automatic combat uses melee while one-star Qwen stays passive',()=>{
 for(const stars of [1,2,3]){
  const g=scene(),u=put(g,'qwen',stars),e=target(g,2,u.x+60);battle(g);tick(g,1);
  assert.equal(e.hp<9999,stars>1);assert.equal(g.projectiles.length,0);
  const hp=e.hp;e.x=u.x+101;tick(g,3);assert.equal(e.hp,hp);
 }
});


test('Harness purchases enforce rank, funds, ownership, duplicates and record the paid refund',()=>{
 const g=scene(),u=put(g,'deepseek',2);assert.equal(g.equipHarness(u).reason,'requiresThreeStars');
 for(let i=0;i<4;i++)g.plant('deepseek',2,0);assert.equal(g.harnessFor(u),undefined);
 const cost=harnessCost(MODELS.find(m=>m.id==='deepseek'));g.tokens=cost-1;
 const snapshot=JSON.stringify([g.tokens,u,g.harnesses]);assert.equal(g.equipHarness(u).reason,'lackTokens');assert.equal(JSON.stringify([g.tokens,u,g.harnesses]),snapshot);
 g.tokens=cost;const invested=u.invested;assert.equal(g.equipHarness(u).ok,true);assert.equal(g.tokens,0);assert.equal(u.invested,invested+cost);
 assert.equal(g.equipHarness(u).reason,'alreadyEquipped');g.remove(2,0);assert.equal(g.tokens,Math.floor((invested+cost)/2));assert.equal(g.equipHarness(u).reason,'empty');
});

test('president mode equips without charging or creating paid investment',()=>{
 const g=scene(),u=put(g,'deepseek',3),paid=u.invested;g.tokens=0;g.setPresidentMode(true);
 assert.equal(g.equipHarness(u).ok,true);assert.equal(g.tokens,0);assert.equal(u.invested,paid);
});

test('DeepSeek Harness boosts production to 125, 125, 175 on a three-cycle dividend',()=>{
 const g=scene(),u=put(g,'deepseek',3);g.equipHarness(u);battle(g);
 for(const expected of [125,125,175,125]){u.produceTimer=.01;tick(g,.02);assert.equal(g.coins.at(-1).value,expected);}
 assert.equal(g.harnessFor(u).cycles,4);assert.equal(g.projectiles.length,0);
});
