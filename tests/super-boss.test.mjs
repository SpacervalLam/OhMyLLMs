import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame,enemyTargetable,GROK_BURN,MELT} from '../dist/engine.js';
import {SUPER_KIT,bossForWave} from '../dist/super-boss.js';
import {CEO_MAP} from '../dist/data.js';
import {bindInputLock} from '../dist/input-lock.js';
import {drawSuperStatus,enemySize} from '../dist/enemy-vfx.js';

function tick(g,s){for(let n=0;n<Math.round(s*100);n++)g.update(.01);}
function put(g,model='chatgpt',row=2,col=0,stars=1){let u;for(let n=0;n<[0,1,3,7][stars];n++){g.cooldowns[model]=0;u=g.plant(model,row,col).unit;}u.attackTimer=u.basicTimer=u.produceTimer=999;return u;}
function foe(g,type='sam',row=2,x=600){const e=g.spawnEnemy(type,row);e.x=x;e.speed=0;e.abilityTimer=-999;e.attackTimer=999;e.hp=e.maxHp=10000;return e;}
function scene(models=['chatgpt']){
 const g=new GardenGame({starter:false,seed:42,eggs:false,lang:'en'});g.tokens=99999;
 const units=models.map((id,i)=>put(g,id,i%5,Math.floor(i/5)));
 g.start();g.nextWaveTimer=999;g.airdropTimer=999;
 const boss=foe(g,'pony_super',4,1000);boss.superKit={sp:999,monopoly:999,dividend:999};boss.shift=null;
 return {g,boss,units};
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('Super is a scored boss in the five-boss endless rotation and QQs are summon-only',()=>{
 assert.equal(CEO_MAP.pony_super.prototype,'Pony Ma');assert.equal(CEO_MAP.pony_super.boss,true);
 assert.equal(CEO_MAP.pony_super.skills.length,4);assert.equal(CEO_MAP.pony_super.points,4000);
 for(let wave=1;wave<=99;wave++)assert.equal(bossForWave(wave),wave%3===0?['ipo','overlord','pony_super','trump','elon_super'][(wave/3-1)%5]:null);
 assert.equal(CEO_MAP.qq_raider.summoned,true);assert.equal(enemySize({type:'qq_raider'}),62);
});

test('SP releases exactly five independent penguins and locks five distinct live LLMs',()=>{
 const {g,boss,units}=scene(Array(7).fill('chatgpt'));units[6].hp=0;g.castSP(boss);
 const birds=g.enemies.filter(e=>e.type==='qq_raider');assert.equal(birds.length,5);
 assert.equal(new Set(birds.map(e=>e.raid.targetId)).size,5);
 for(const e of birds){const u=units.find(u=>u.id===e.raid.targetId);assert.ok(u.hp>0);assert.equal(e.ownerId,boss.id);assert.equal(e.raid.remaining,3);assert.deepEqual([e.row,e.x,e.y],[u.row,u.x,u.y]);assert.equal(e.damage,0);assert.equal(e.speed,0);}
});

test('five penguins repeat scarce targets and wait safely when the lineup is empty',()=>{
 for(const count of [0,1,2]){
  const {g,boss}=scene(Array(count).fill('qwen'));g.castSP(boss);
  const birds=g.enemies.filter(e=>e.type==='qq_raider');assert.equal(birds.length,5);
  assert.equal(new Set(birds.map(e=>e.raid.targetId)).size,count||1);
  if(!count){assert.ok(birds.every(e=>e.raid.phase==='waiting'));const u=put(g,'qwen');tick(g,.01);assert.ok(birds.every(e=>e.raid.targetId===u.id));}
 }
});

test('QQs warn for three seconds, do not attack, then steal after eight vulnerable seconds',()=>{
 const {g,boss,units}=scene(Array(5).fill('qwen'));g.castSP(boss);
 const birds=g.enemies.filter(e=>e.type==='qq_raider');tick(g,2.99);assert.ok(birds.every(e=>!enemyTargetable(e)));
 tick(g,.01);assert.ok(birds.every(e=>enemyTargetable(e)));for(const e of birds)close(e.raid.remaining,8);
 tick(g,7.99);assert.ok(units.every(u=>g.units.includes(u)&&u.hp===u.maxHp));
 tick(g,.01);assert.equal(g.units.length,0);assert.equal(g.enemies.filter(e=>e.type==='qq_raider').length,0);
 assert.equal(g.departures.filter(e=>e.exit==='rope'&&e.carried).length,5);assert.equal(g.score,0);assert.equal(g.kills,0);
});

test('defeating one penguin saves its victim without saving other marked tiles',()=>{
 const {g,boss,units}=scene(Array(5).fill('qwen'));g.castSP(boss);tick(g,3);
 const bird=g.enemies.find(e=>e.type==='qq_raider'),saved=units.find(u=>u.id===bird.raid.targetId);
 g.damageEnemy(bird,999999);tick(g,8.01);
 assert.deepEqual(g.units,[saved]);assert.equal(g.score,100);assert.equal(g.kills,1);
});

test('Super starts its three casts at 6, 8 and 12 seconds, with independent repeat timers',()=>{
 const {g,boss}=scene(['qwen']);boss.superKit={sp:6,dividend:8,monopoly:12};
 tick(g,5.99);assert.equal(g.enemies.length,1);tick(g,.01);assert.equal(g.enemies.filter(e=>e.type==='qq_raider').length,5);
 tick(g,1.99);assert.equal(g.dividends.length,0);tick(g,.01);assert.equal(g.dividends.length,1);
 tick(g,3.99);assert.equal(g.controlsLocked,false);tick(g,.01);assert.equal(g.controlsLocked,true);close(g.monopolyRemaining,20);
 close(boss.superKit.monopoly,SUPER_KIT.monopoly);close(boss.superKit.dividend,14);close(boss.superKit.sp,18);
});

test('Super shifts after 300 damage, waits six seconds and stops after four lane changes',()=>{
 const {g,boss}=scene([]);boss.shift={taken:0,cd:0,count:0,threshold:300,cooldown:6,max:4};boss.row=2;
 for(let n=1;n<=4;n++){
  boss.invuln=0;g.damageEnemy(boss,300);const old=boss.row;g.update(.01);
  assert.equal(boss.shift.count,n);assert.equal(Math.abs(boss.row-old),1);assert.equal(boss.invuln,.4);
  tick(g,6.01);
 }
 boss.invuln=0;g.damageEnemy(boss,300);tick(g,6.1);assert.equal(boss.shift.count,4);
});

test('stun delays Super casts and lane shifting',()=>{
 const {g,boss}=scene();boss.stun=1;boss.superKit={sp:.01,monopoly:.01,dividend:.01};
 boss.shift={taken:300,cd:0,count:0,threshold:300,cooldown:6,max:4};tick(g,.5);
 assert.equal(boss.shift.count,0);assert.equal(g.enemies.length,1);assert.equal(g.dividends.length,0);assert.equal(g.controlsLocked,false);
 tick(g,.52);assert.equal(boss.shift.count,1);assert.equal(g.enemies.length,6);assert.equal(g.dividends.length,1);assert.equal(g.controlsLocked,true);
});

test('monopoly blocks all player mutations atomically while AI attacks and auto-collection continue',()=>{
 const {g,boss,units:[u]}=scene();const target=foe(g,'sam',u.row,400);u.attackTimer=0;
 g.coin(200,200,25);g.coins[0].age=7.9;g.castMonopoly(boss);
 const before={tokens:g.tokens,units:g.units.length,lang:g.lang,president:g.presidentMode,eggs:g.eggs,wave:g.wave};
 assert.equal(g.plant('kimi',0,2).reason,'monopoly');assert.equal(g.remove(u.row,u.col).reason,'monopoly');assert.equal(g.equipHarness(u).reason,'monopoly');
 assert.equal(g.collect(g.coins[0].id),false);assert.equal(g.pause(),false);assert.equal(g.resume(),false);assert.equal(g.nextWave(),false);
 assert.equal(g.setPresidentMode(true),false);assert.equal(g.setLanguage('zh'),false);assert.equal(g.setEggs(true),false);
 assert.deepEqual({tokens:g.tokens,units:g.units.length,lang:g.lang,president:g.presidentMode,eggs:g.eggs,wave:g.wave},before);
 tick(g,1);assert.equal(g.tokens,before.tokens+25);assert.ok(target.hp<target.maxHp);close(g.monopolyRemaining,19);assert.equal(g.phase,'playing');
});

test('monopoly lasts exactly twenty gameplay seconds and persists if its caster dies',()=>{
 const {g,boss}=scene([]);g.castMonopoly(boss);g.damageEnemy(boss,999999);
 tick(g,19.99);assert.equal(g.controlsLocked,true);tick(g,.01);assert.equal(g.controlsLocked,false);assert.equal(g.monopolyRemaining,0);
 assert.ok(g.plant('qwen',0,0).ok);assert.equal(g.pause(),true);assert.equal(g.resume(),true);
 assert.equal(g.drainEvents().filter(e=>e.type==='monopolyEnd').length,1);
});

test('system pause and time stop freeze the lock, while privileged focus resume avoids a softlock',()=>{
 const {g,boss}=scene();g.castMonopoly(boss);assert.ok(g.pause({system:true}));tick(g,1);close(g.monopolyRemaining,20);
 assert.equal(g.systemPaused,true);assert.equal(g.resume(),false);assert.ok(g.resume({system:true}));
 g.timeStop=1;tick(g,1);close(g.monopolyRemaining,20);tick(g,.5);close(g.monopolyRemaining,19.5);
 g.castMonopoly(boss);close(g.monopolyRemaining,20);
});

test('input lock captures mouse, pointer, keyboard, touch, scroll and synthetic clicks, then releases',()=>{
 let locked=true,blocked=0,prevented=0;const handlers=new Map(),removed=[];
 const target={addEventListener(type,fn,options){assert.equal(options.capture,true);assert.equal(options.passive,false);handlers.set(type,fn);},removeEventListener(type,fn,capture){assert.equal(fn,handlers.get(type));assert.equal(capture,true);removed.push(type);}};
 const unbind=bindInputLock(target,()=>locked);
 for(const event of ['click','pointerdown','pointerup','pointermove','contextmenu','keydown','keyup','wheel','touchstart','dragstart'])assert.ok(handlers.has(event));
 for(const fn of handlers.values())fn({cancelable:true,preventDefault(){prevented++;},stopImmediatePropagation(){blocked++;}});
 assert.equal(blocked,handlers.size);assert.equal(prevented,handlers.size);locked=false;
 for(const fn of handlers.values())fn({preventDefault(){assert.fail();},stopImmediatePropagation(){assert.fail();}});
 unbind();assert.equal(removed.length,handlers.size);
});

test('dividend marks exactly three distinct living LLM identities, or every available LLM',()=>{
 for(const count of [0,1,2,3,7]){
  const {g,boss}=scene(Array(count).fill('qwen'));assert.equal(g.castDividend(boss),count>0);
  if(count){assert.equal(g.dividends[0].marks.length,Math.min(count,3));assert.equal(new Set(g.dividends[0].marks.map(m=>m.id)).size,Math.min(count,3));assert.equal(g.dividends[0].remaining,5);}
 }
});

test('dividend counts actual shield, armor and HP damage, excluding overkill, invulnerability and unmarked sources',()=>{
 const {g,boss,units:[u]}=scene();g.castDividend(boss);const d=g.dividends[0];
 const e=foe(g);e.hp=20;e.shield=7;e.armor=13;g.damageEnemy(e,999,{sourceId:u.id});close(d.total,40);
 g.damageEnemy(e,999,{sourceId:u.id});close(d.total,40);
 const b=foe(g);b.invuln=1;g.damageEnemy(b,100,{sourceId:u.id});close(d.total,40);
 b.invuln=0;g.damageEnemy(b,100);g.damageEnemy(b,100,{sourceId:u.id+999});close(d.total,40);
 b.armor=50;g.damageEnemy(b,10,{direct:true,sourceId:u.id});close(d.total,50);assert.equal(b.armor,50);
});

test('five seconds later each living enemy receives the full total capped at max HP, including QQs',()=>{
 const {g,boss,units:[u]}=scene();g.castDividend(boss);
 const a=foe(g),b=foe(g,'sam',1),dead=foe(g,'sam',3);boss.hp-=200;a.hp-=100;b.hp-=20;dead.hp=0;
 const bird=g.spawnEnemy('qq_raider',0);bird.hp-=50;
 g.damageEnemy(a,80,{sourceId:u.id});tick(g,4.99);assert.equal(a.hp,a.maxHp-180);assert.equal(b.hp,b.maxHp-20);
 tick(g,.01);assert.equal(g.dividends.length,0);assert.equal(a.hp,a.maxHp-100);assert.equal(b.hp,b.maxHp);assert.equal(boss.hp,boss.maxHp-120);assert.equal(bird.hp,bird.maxHp);assert.equal(dead.hp,0);
 const paid=g.drainEvents().find(e=>e.type==='dividendPaid');assert.equal(paid.damage,80);assert.equal(paid.healed,230);
});

test('dividend follows original identities across removal and does not transfer to a replacement on the same tile',()=>{
 const {g,boss,units:[u]}=scene();g.castDividend(boss);const d=g.dividends[0],e=foe(g,'sam',u.row,400);
 g.fire(u,e,{damage:20});assert.equal(g.projectiles[0].sourceId,u.id);assert.ok(g.remove(u.row,u.col).ok);
 const next=put(g,'chatgpt',u.row,u.col);g.damageEnemy(e,30,{sourceId:next.id});assert.equal(d.total,0);
 tick(g,1);close(d.total,20);assert.notEqual(next.id,u.id);
});

test('pending dividends keep their five-second settlement if the caster is defeated; pause freezes settlement',()=>{
 const {g,boss,units:[u]}=scene();const e=foe(g);e.hp-=200;g.castDividend(boss);g.damageEnemy(e,25,{sourceId:u.id});
 g.damageEnemy(boss,999999);g.pause();tick(g,6);assert.equal(g.dividends.length,1);assert.equal(e.hp,e.maxHp-225);
 g.resume();tick(g,5);assert.equal(g.dividends.length,0);assert.equal(e.hp,e.maxHp-200);
});

test('damage at the five-second boundary counts, later damage cannot enter a closed window',()=>{
 const {g,boss,units:[u]}=scene();g.castDividend(boss);const e=foe(g);g.time=5;
 g.damageEnemy(e,10,{sourceId:u.id});close(g.dividends[0].total,10);g.time=5.01;
 g.damageEnemy(e,20,{sourceId:u.id});close(g.dividends[0].total,10);g.resolveDividends();assert.equal(g.dividends.length,0);
});

test('basic shots, piercing, bounce replays, splash, beams and contracts attribute their real damage to marked LLMs',()=>{
 for(const [model,stars,harness] of [['chatgpt',1],['mimo',3],['doubao',3,true],['minimax',3],['gemini',3],['chatgpt',3],['claude',3]]){
  const {g,boss}=scene([]),u=put(g,model,2,0,stars);if(harness)g.equipHarness(u);
  const a=foe(g,'sam',2,400),b=foe(g,'sam',2,455),c=foe(g,'sam',1,430);g.castDividend(boss);
  const initial=a.hp+b.hp+c.hp;assert.ok(g.attack(u),model);tick(g,2.5);
  const dealt=initial-a.hp-b.hp-c.hp;assert.ok(dealt>0,model);close(g.dividends[0].total,dealt);
 }
});

test('burn ticks and frost melt retain Grok attribution, including after the marked unit leaves',()=>{
 const {g,boss}=scene([]),u=put(g,'grok',2,0,3),e=foe(g,'sam',2,400);g.castDividend(boss);
 g.attack(u);tick(g,1);const before=g.dividends[0].total;assert.ok(before>0);assert.equal(e.burn.sourceId,u.id);
 g.remove(u.row,u.col);tick(g,.5);assert.ok(g.dividends[0].total>before);
 const remaining=e.burn.remaining,total=g.dividends[0].total;e.slow=1;g.meltFrozen();
 close(g.dividends[0].total-total,Math.ceil(remaining/.5-1e-9)*GROK_BURN.damage*MELT.scale);assert.equal(e.burn,null);
});

test('Qwen melee, reflection and Grok deathrattle also contribute to dividend damage',()=>{
 const {g,boss}=scene([]),u=put(g,'qwen',2,3,3);g.equipHarness(u);const e=foe(g,'sam',2,u.x+60);g.castDividend(boss);
 g.attack(u);const first=g.dividends[0].total;assert.ok(first>0);g.damageUnit(u,100);close(g.dividends[0].total,first+8);
 const other=scene([]),grok=put(other.g,'grok',2,0,3);other.g.equipHarness(grok);const victim=foe(other.g,'sam',2,400);victim.hp-=100;other.g.castDividend(other.boss);
 other.g.depart(grok,'unit');other.g.units=[];tick(other.g,.5);close(other.g.dividends[0].total,100);
});

test('dividend marks and counters restore canvas state and never draw invalid geometry',()=>{
 const {g,boss}=scene(Array(3).fill('qwen'));g.castDividend(boss);const stack=[],state={globalAlpha:.8};
 const ctx=new Proxy(state,{get(o,k){if(k in o)return o[k];if(k==='save')return ()=>stack.push({...o});if(k==='restore')return ()=>Object.assign(o,stack.pop());return (...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),String(k));};}});
 for(const t of [0,1,5])drawSuperStatus(ctx,g,t);assert.equal(stack.length,0);assert.equal(ctx.globalAlpha,.8);
});
