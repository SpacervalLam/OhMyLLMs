import {fullSkill} from './helpers/full-skill.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame,GLM_FREEZE,GROK_BURN,MELT} from '../dist/engine.js';
const tick=(g,n)=>{for(let i=0;i<Math.round(n*100);i++)g.update(.01);};
function setup(){
 const g=new GardenGame({starter:false,lang:'en'});g.tokens=999;g.start();g.nextWaveTimer=999;
 const e=g.spawnEnemy('sam',2);e.x=400;e.speed=0;e.hp=e.maxHp=500;e.abilityTimer=-999;
 return {g,e};
}
const burn=g=>g.applyImpact({model:'grok',damage:0,splash:0,knock:0},g.enemies[0]);

test('a full burn vents as melt for twice the remaining burn when frost is present',()=>{
 const {g,e}=setup();burn(g);
 assert.ok(e.burn);assert.equal(e.slow||0,0);
 g.update(.01);assert.ok(e.burn,'burn alone must not melt');
 e.slow=GLM_FREEZE.slow;g.update(.01);
 assert.equal(e.burn,null);assert.equal(e.slow,0);
 const ticks=Math.ceil(GROK_BURN.duration/GROK_BURN.every);
 assert.equal(e.hp,e.maxHp-ticks*GROK_BURN.damage*MELT.scale);
 assert.ok(g.effects.some(f=>f.type==='melt'));
 assert.equal(g.drainEvents().filter(x=>x.type==='melt').length,1);
});

test('the melt pays out only the burn that was left, so a spent burn is worth less',()=>{
 const {g,e}=setup();burn(g);
 tick(g,2.5);assert.equal(e.hp,e.maxHp-5*GROK_BURN.damage);   // five ticks already landed
 assert.ok(Math.abs(e.burn.remaining-GROK_BURN.every)<1e-6,'exactly one tick is left on the clock');
 e.slow=GLM_FREEZE.slow;g.update(.01);
 assert.equal(e.hp,e.maxHp-5*GROK_BURN.damage-1*GROK_BURN.damage*MELT.scale);
});

test('frost alone never melts and keeps its slow until it decays',()=>{
 const {g,e}=setup();e.slow=GLM_FREEZE.slow;g.update(.01);
 assert.ok(e.slow>0,'a lone slow only decays, it is never cancelled');
 assert.equal(e.hp,e.maxHp);
 assert.ok(!g.effects.some(f=>f.type==='melt'));
});

test('a melt kill is paid like any other kill and leaves exactly one departure',()=>{
 const {g,e}=setup();burn(g);e.hp=10;
 const tokens=g.tokens;e.slow=GLM_FREEZE.slow;g.update(.01);
 assert.equal(g.kills,1);assert.ok(!g.enemies.includes(e));
 assert.equal(g.departures.length,1);assert.ok(g.tokens>tokens);
 assert.equal(g.drainEvents().filter(x=>x.type==='kill').length,1);
 tick(g,3);assert.equal(g.kills,1);
});

test('frost follows the target during the fall, then remains at its non-snapped impact center',()=>{
 const {g,e}=setup();e.x=437;
 const u=fullSkill(g.plant('glm',2,0).unit);u.attackTimer=999;u.freezeBasics=4;
 g.attack(u);const z=g.zones[0];assert.equal(z.x,437);assert.equal(z.x1-z.x0,200);
 e.x=423;tick(g,.2);assert.equal(z.x,423);assert.equal(z.landed,false);
 e.x=411;tick(g,.21);assert.equal(z.x,411);assert.equal(z.landed,true);
 e.x=390;tick(g,.1);assert.equal(z.x,411);
 assert.equal(z.y,e.y);assert.equal(z.x0,311);
});

test('high-star GLM casts once per four successful basics and never from its skill timer alone',()=>{
 for(const stars of [2,3]){
  const {g,e}=setup();const u=g.plant('glm',2,0).unit;u.stars=stars;g.timeStop=0;
  assert.equal(g.attack(u),false);g.update(.01);assert.equal(g.zones.length,0);
  u.freezeBasics=0;g.projectiles=[];
  for(let i=1;i<=8;i++){g.basicAttack(u,[e]);assert.equal(g.zones.length,Math.floor(i/4));}
  assert.equal(g.projectiles.length,8);assert.equal(u.freezeBasics,0);
  assert.equal(g.basicAttack(u,[]),false);assert.equal(u.freezeBasics,0);
 }
});

test('elliptical frost excludes its bounding-box corners and does not deal damage',()=>{
 const {g,e}=setup();const u=fullSkill(g.plant('glm',2,0).unit);u.basicTimer=999;u.attackTimer=999;u.freezeBasics=4;
 g.attack(u);const corner=g.spawnEnemy('sam',2);corner.x=e.x+95;corner.y=e.y+40;corner.speed=0;corner.abilityTimer=-999;
 tick(g,.42);assert.ok(e.slow>0);assert.equal(corner.slow,0);assert.equal(e.hp,500);
});
