import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenRenderer} from '../dist/renderer.js';
import {FIELD} from '../dist/engine.js';

test('canvas and cached scenery match physical display pixels across resize and DPI changes',()=>{
 let bounds={width:1734,height:1005},rebuilds=0,transform;
 const renderer=Object.create(GardenRenderer.prototype);
 renderer.canvas={width:1120,height:650,getBoundingClientRect:()=>bounds};
 renderer.background={width:1120,height:650};
 renderer.ctx={setTransform:(...values)=>{transform=values;}};
 renderer.makeBackground=()=>rebuilds++;
 renderer.resize(1.005);
 assert.equal(renderer.canvas.width,1743);
 assert.equal(renderer.canvas.height,1010);
 assert.equal(renderer.background.width,1743);
 assert.equal(renderer.background.height,1010);
 assert.deepEqual(transform,[1743/FIELD.width,0,0,1010/FIELD.height,0,0]);
 renderer.resize(1.005);
 assert.equal(rebuilds,1,'unchanged frames reuse the cached background');
 bounds={width:800,height:650};
 renderer.resize(2);
 assert.equal(renderer.canvas.width,1600);
 assert.equal(renderer.background.height,1300);
 renderer.resize(1);
 assert.equal(renderer.canvas.width,800);
 assert.equal(rebuilds,3);
});
