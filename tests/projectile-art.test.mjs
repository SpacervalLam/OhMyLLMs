import test from 'node:test';
import assert from 'node:assert/strict';
import {drawPaintedProjectile,PROJECTILE_CELLS} from '../dist/projectile-art.js';
test('painted basic and skill sprites select isolated atlas cells and balance canvas state',()=>{
 for(const model of Object.keys(PROJECTILE_CELLS))for(const basic of [true,false]){
  const calls=[];let depth=0;const c={globalAlpha:1,save(){depth++;},restore(){depth--;},rotate(){},drawImage(...args){calls.push(args);}};
  const img={naturalWidth:1536,naturalHeight:1536};
  assert.equal(drawPaintedProjectile(c,{model,basic,age:.4},img),true);
  const index=!basic&&model==='grok'?7:!basic&&model==='minimax'?8:PROJECTILE_CELLS[model];
  assert.deepEqual(calls[1].slice(1,5),[index%3*512,Math.floor(index/3)*512,512,512]);assert.equal(depth,0);
 }
});
test('missing artwork retains the procedural fallback and non-projectile roles have no sprite',()=>{
 assert.equal(drawPaintedProjectile({}, {model:'grok'},null),false);
 for(const model of ['deepseek','qwen'])assert.equal(drawPaintedProjectile({}, {model},{naturalWidth:1536,naturalHeight:1536}),false);
});
