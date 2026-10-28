import {FIELD} from './engine.js';

export function boardPoint(clientX,clientY,rect){
 if(!(rect.width>0&&rect.height>0))return null;
 return {x:(clientX-rect.left)/rect.width*FIELD.width,y:(clientY-rect.top)/rect.height*FIELD.height};
}
export function boardCell(point){
 if(!point)return null;
 const col=Math.floor((point.x-FIELD.x)/FIELD.cw),row=Math.floor((point.y-FIELD.y)/FIELD.ch);
 return col>=0&&col<FIELD.cols&&row>=0&&row<FIELD.rows?{row,col}:null;
}

// Pointer capture keeps a card drag alive outside the deck and the canvas.
// Touch pan-x stays available for browsing the horizontally scrollable roster.
export function bindModelDrag(card,{canStart,onStart,onMove,onDrop,onEnd}){
 const doc=card.ownerDocument,win=doc.defaultView;let gesture=null,suppressUntil=0;
 const now=()=>win.performance.now();
 function finish(event,cancelled=false){
  const g=gesture;if(!g||event&&event.pointerId!==undefined&&event.pointerId!==g.id)return;
  gesture=null;doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',up);doc.removeEventListener('pointercancel',cancel);doc.removeEventListener('keydown',key);win.removeEventListener('blur',cancel);
  if(card.hasPointerCapture?.(g.id))card.releasePointerCapture(g.id);
  if(g.active){suppressUntil=now()+400;try{if(!cancelled&&canStart())onDrop(event);}finally{onEnd();}}
 }
 const cancel=e=>finish(e?.pointerId===undefined?null:e,true);
 const up=e=>finish(e);
 const key=e=>{if(e.key==='Escape')cancel();};
 function move(e){
  const g=gesture;if(!g||e.pointerId!==g.id)return;
  if(!canStart()){cancel();return;}
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.active){
   if(Math.hypot(dx,dy)<(g.touch?10:6))return;
   if(g.touch&&Math.abs(dx)>Math.abs(dy)&&card.parentElement.scrollWidth>card.parentElement.clientWidth){cancel();return;}
   g.active=true;onStart(e);
  }
  e.preventDefault();onMove(e);
 }
 card.addEventListener('pointerdown',e=>{
  if(gesture||e.button!==0||e.isPrimary===false||!canStart())return;
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,touch:e.pointerType==='touch',active:false};
  card.setPointerCapture(e.pointerId);
  doc.addEventListener('pointermove',move,{passive:false});doc.addEventListener('pointerup',up);doc.addEventListener('pointercancel',cancel);doc.addEventListener('keydown',key);win.addEventListener('blur',cancel);
 });
 card.addEventListener('lostpointercapture',cancel);
 card.addEventListener('dragstart',e=>e.preventDefault());
 card.addEventListener('click',e=>{if(e.detail!==0&&now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
 return cancel;
}
