import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame,GROK_CONTROL} from '../dist/engine.js';
import {CEOS} from '../dist/data.js';
const tick=(g,n)=>{for(let i=0;i<Math.round(n*100);i++)g.update(.01);};
function setup(){const g=new GardenGame({starter:false,lang:'en'});g.start();g.nextWaveTimer=999;const a=g.spawnEnemy('sam',2),b=g.spawnEnemy('sam',2);a.x=400;b.x=450;for(const e of [a,b]){e.speed=0;e.hp=e.maxHp=500;e.abilityTimer=-999;}return {g,a,b};}
const shell={model:'grok',damage:52,splash:90,knock:26};

test('knockback is a bounded continuous displacement, with no teleport on impact',()=>{
 const {g,a}=setup();g.knockback(a,26);assert.equal(a.x,400);
 let previous=a.x;for(let i=0;i<32;i++){g.update(.01);assert.ok(a.x>=previous);assert.ok(a.x-previous<3);previous=a.x;}
 assert.ok(Math.abs(a.x-426)<1e-6);assert.equal(a.knockback,null);
 a.x=1070;a.knockRecovery=0;g.knockback(a,26);tick(g,.4);assert.ok(a.x<=1075);
});

test('only the directly hit target burns for six small health ticks across three seconds',()=>{
 const {g,a,b}=setup();a.armor=100;a.shield=100;g.applyImpact(shell,a);
 assert.equal(a.burn.remaining,3);assert.ok(!b.burn);const collateral=b.hp;
 tick(g,.49);assert.equal(a.hp,500);tick(g,.02);assert.equal(a.hp,498);
 tick(g,2.5);assert.equal(a.hp,488);assert.equal(a.burn,null);assert.equal(b.hp,collateral);
 assert.equal(a.armor,100);assert.equal(a.shield,100);
});

test('repeat hits refresh burn without stacking ticks, and pause freezes both status clocks',()=>{
 const {g,a}=setup();g.applyImpact(shell,a);tick(g,1);assert.equal(a.hp,496);
 g.applyImpact(shell,a);assert.equal(a.burn.remaining,3);g.pause();const state=JSON.stringify({x:a.x,burn:a.burn,push:a.knockback});tick(g,2);
 assert.equal(JSON.stringify({x:a.x,burn:a.burn,push:a.knockback}),state);
 g.resume();tick(g,.5);assert.equal(a.hp,494);
});

test('burn deaths use normal rewards and departure exactly once',()=>{
 const {g,a}=setup();a.hp=2;g.applyImpact({...shell,splash:0,knock:0},a);tick(g,.6);
 assert.equal(g.kills,1);assert.ok(!g.enemies.includes(a));assert.equal(g.drainEvents().filter(e=>e.type==='kill').length,1);
 tick(g,3);assert.equal(g.kills,1);
});

test('recovery is shared by attackers and cannot restart an active push',()=>{
 const {g,a}=setup();g.knockback(a,GROK_CONTROL.direct);tick(g,.1);const active={...a.knockback};
 assert.equal(g.knockback(a,GROK_CONTROL.direct),false);assert.deepEqual(a.knockback,active);
 tick(g,4.41);assert.equal(g.knockback(a,GROK_CONTROL.direct),true);
});

test('every marching CEO advances under permanent 55% slow and arbitrarily frequent Grok push attempts',()=>{
 for(const {id} of CEOS.filter(c=>c.speed>0)){
  const g=new GardenGame({starter:false,lang:'en'});g.start();g.nextWaveTimer=999;
  const e=g.spawnEnemy(id,2);e.x=800;e.hp=e.maxHp=1e9;e.abilityTimer=-999;
  for(let i=0;i<3000;i++){e.slow=3;if(i%10===0)g.knockback(e,GROK_CONTROL.direct);g.update(.01);}
  assert.ok(e.x<780,`${id} failed to advance under slow and rapid pushes: ${e.x}`);
 }
});

test('three real Groks cannot pin the slowest CEO even inside GLM slow',()=>{
 const g=new GardenGame({starter:false,lang:'en'});g.tokens=9999;
 for(let col=0;col<3;col++)g.plant('grok',2,col);
 g.start();g.nextWaveTimer=999;const e=g.spawnEnemy('jensen',2);e.x=850;e.hp=e.maxHp=1e9;e.abilityTimer=-999;
 for(let i=0;i<3000;i++){e.slow=3;g.update(.01);}
 assert.ok(e.x<820,`three Groks pinned Jensen: ${e.x}`);
});
