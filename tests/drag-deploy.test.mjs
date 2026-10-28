import test from 'node:test';
import assert from 'node:assert/strict';
import {bindModelDrag,boardPoint,boardCell} from '../dist/drag-deploy.js';
import {FIELD} from '../dist/engine.js';
function dispatch(target,type,data={}){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:1,button:0,isPrimary:true,pointerType:'mouse',clientX:10,clientY:10,...data});target.dispatchEvent(e);return e;}
function scene(){
 const win=new EventTarget();let clock=0;win.performance={now:()=>clock};
 const doc=new EventTarget();doc.defaultView=win;
 const card=new EventTarget();card.ownerDocument=doc;card.parentElement={scrollWidth:100,clientWidth:100};let capture=null;
 card.setPointerCapture=id=>{capture=id;};card.hasPointerCapture=id=>capture===id;card.releasePointerCapture=()=>{capture=null;};
 const calls=[];let allowed=true;const cancel=bindModelDrag(card,{canStart:()=>allowed,onStart:e=>calls.push(['start',e.clientX,e.clientY]),onMove:e=>calls.push(['move',e.clientX,e.clientY]),onDrop:e=>calls.push(['drop',e.clientX,e.clientY]),onEnd:()=>calls.push(['end'])});
 return {win,doc,card,calls,cancel,set allowed(v){allowed=v;},advance:()=>{clock+=500;}};
}

test('canvas coordinates preserve all 45 cells across scale and cropped stage offsets',()=>{
 for(const scale of [.3,.5,1,1.75]){const rect={left:130,top:90-45*scale,width:1120*scale,height:650*scale};
  for(let row=0;row<5;row++)for(let col=0;col<9;col++){const p=boardPoint(rect.left+(FIELD.x+col*100+50)*scale,rect.top+(FIELD.y+row*96+48)*scale,rect);assert.deepEqual(boardCell(p),{row,col});}
 }
 for(const point of [{x:99,y:200},{x:1000,y:200},{x:200,y:103},{x:200,y:584}])assert.equal(boardCell(point),null);
 assert.equal(boardPoint(10,10,{width:0,height:0}),null);assert.equal(boardCell(null),null);
});

test('a normal click or small pointer movement never deploys a dragged copy',()=>{
 const s=scene();dispatch(s.card,'pointerdown');dispatch(s.doc,'pointermove',{clientX:13});dispatch(s.doc,'pointerup');assert.deepEqual(s.calls,[]);
});

test('crossing the drag threshold starts a preview and drops exactly once at release coordinates',()=>{
 const s=scene();dispatch(s.card,'pointerdown');dispatch(s.doc,'pointermove',{clientX:30,clientY:35});dispatch(s.doc,'pointermove',{clientX:250,clientY:150});dispatch(s.doc,'pointerup',{clientX:500,clientY:200});dispatch(s.doc,'pointerup',{clientX:500,clientY:200});dispatch(s.doc,'pointermove',{clientX:600});
 assert.deepEqual(s.calls,[['start',30,35],['move',30,35],['move',250,150],['drop',500,200],['end']]);assert.equal(s.card.hasPointerCapture(1),false);
});

test('Escape, pointer cancellation, lost capture, blur and explicit cancellation never drop',()=>{
 for(const action of ['escape','pointercancel','lostpointercapture','blur','explicit']){const s=scene();dispatch(s.card,'pointerdown');dispatch(s.doc,'pointermove',{clientX:30});
  if(action==='escape')dispatch(s.doc,'keydown',{key:'Escape'});else if(action==='explicit')s.cancel();else dispatch(action==='blur'?s.win:action==='lostpointercapture'?s.card:s.doc,action);
  dispatch(s.doc,'pointerup');assert.equal(s.calls.filter(c=>c[0]==='drop').length,0,action);assert.equal(s.calls.filter(c=>c[0]==='end').length,1,action);
 }
});

test('dragging never starts in a blocked state and cancels if the state becomes blocked',()=>{
 const s=scene();s.allowed=false;dispatch(s.card,'pointerdown');dispatch(s.doc,'pointermove',{clientX:40});assert.deepEqual(s.calls,[]);
 s.allowed=true;dispatch(s.card,'pointerdown');dispatch(s.doc,'pointermove',{clientX:40});s.allowed=false;dispatch(s.doc,'pointerup');assert.equal(s.calls.filter(c=>c[0]==='drop').length,0);assert.equal(s.calls.at(-1)[0],'end');
});

test('other pointer ids and non-primary or secondary mouse buttons cannot deploy',()=>{
 const s=scene();for(const data of [{button:2},{isPrimary:false}]){dispatch(s.card,'pointerdown',data);dispatch(s.doc,'pointermove',{clientX:50});dispatch(s.doc,'pointerup');}assert.deepEqual(s.calls,[]);
 dispatch(s.card,'pointerdown');dispatch(s.doc,'pointermove',{pointerId:2,clientX:60});dispatch(s.doc,'pointerup',{pointerId:2});dispatch(s.doc,'pointercancel',{pointerId:2});assert.deepEqual(s.calls,[]);dispatch(s.doc,'pointermove',{clientX:60});dispatch(s.doc,'pointerup');assert.equal(s.calls.filter(c=>c[0]==='drop').length,1);
});

test('a touch swipe scrolls a wide deck, while an upward touch drag can deploy',()=>{
 const s=scene();s.card.parentElement.scrollWidth=500;dispatch(s.card,'pointerdown',{pointerType:'touch'});dispatch(s.doc,'pointermove',{clientX:40,clientY:12});dispatch(s.doc,'pointerup');assert.deepEqual(s.calls,[]);
 dispatch(s.card,'pointerdown',{pointerType:'touch'});dispatch(s.doc,'pointermove',{clientX:12,clientY:-30});dispatch(s.doc,'pointerup',{clientX:300,clientY:200});assert.equal(s.calls.filter(c=>c[0]==='drop').length,1);
});

test('post-drag pointer clicks are suppressed but keyboard selection and later clicks remain available',()=>{
 const s=scene();dispatch(s.card,'pointerdown');dispatch(s.doc,'pointermove',{clientX:50});dispatch(s.doc,'pointerup');
 assert.equal(dispatch(s.card,'click',{detail:1}).defaultPrevented,true);assert.equal(dispatch(s.card,'click',{detail:0}).defaultPrevented,false);s.advance();assert.equal(dispatch(s.card,'click',{detail:1}).defaultPrevented,false);
});
