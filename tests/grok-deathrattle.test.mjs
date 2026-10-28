import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenGame} from '../dist/engine.js';

function setup(equipped=true){
 const g=new GardenGame({starter:false,seed:42});g.tokens=99999;let u;
 for(let n=0;n<7;n++)u=g.plant('grok',2,2).unit;
 if(equipped)g.equipHarness(u);
 g.start();g.nextWaveTimer=999;u.attackTimer=u.basicTimer=999;
 return {g,u};
}
function enemy(g,row,x){const e=g.spawnEnemy('sam',row);e.x=x;e.hp=e.maxHp=10000;e.speed=0;return e;}
function tick(g,s){for(let n=0;n<Math.ceil(s*100);n++)g.update(.01);}

test('shoveling Grok deals missing-HP damage only ahead in its own and adjacent lanes',()=>{
 const {g,u}=setup();u.hp=u.maxHp-123;
 const a=enemy(g,1,500),b=enemy(g,2,600),c=enemy(g,3,700),behind=enemy(g,1,200);
 const top=enemy(g,0,500),bottom=enemy(g,4,700);top.hp=bottom.hp=8000;
 a.hp=9000;b.hp=8000;c.hp=7000;behind.hp=6000;
 g.remove(u.row,u.col);assert.equal(g.harnesses.length,0);
 assert.equal(g.projectiles.filter(p=>p.deathrattle).length,1);
 tick(g,1.4);
 assert.equal(a.hp,8000);assert.equal(b.hp,6000);assert.equal(c.hp,4000);
 assert.equal(behind.hp,6000);
 assert.equal(top.hp,8000);assert.equal(bottom.hp,8000);
 assert.equal(g.projectiles.length,0);
});

test('defeated Grok calculates missing HP at impact rather than at launch',()=>{
 const {g,u}=setup();const target=enemy(g,3,700);u.hp=-500;
 g.update(.01);assert.equal(g.projectiles.filter(p=>p.deathrattle).length,1);
 target.hp=7500;tick(g,1);assert.equal(target.hp,5000);
 assert.equal(g.units.includes(u),false);assert.equal(g.harnesses.length,0);
 assert.equal(g.departures.filter(d=>d.id===u.id).length,0);
});

test('full-health enemies take zero damage and full-health Grok still triggers deathrattle',()=>{
 const {g,u}=setup();const full=enemy(g,1,500),wounded=enemy(g,3,600);wounded.hp=9000;
 g.remove(u.row,u.col);tick(g,1);assert.equal(full.hp,10000);assert.equal(wounded.hp,8000);
 const other=setup(false);other.u.hp=0;other.g.update(.01);assert.equal(other.g.projectiles.length,0);
});

test('Kimi revival prevents departure and preserves the unused deathrattle',()=>{
 const {g,u}=setup();g.phase='ready';let kimi;
 for(let n=0;n<7;n++)kimi=g.plant('kimi',2,1).unit;
 g.equipHarness(kimi);g.phase='playing';u.hp=0;g.update(.01);
 assert.equal(u.hp,u.maxHp);assert.ok(g.harnessFor(u));assert.equal(g.projectiles.length,0);
});
