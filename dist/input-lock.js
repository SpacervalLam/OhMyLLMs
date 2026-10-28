// Capture input before the battlefield, cards, dialogs or keyboard shortcuts.
export function bindInputLock(target,isLocked){
 const events=['pointerdown','pointerup','pointermove','pointercancel','click','dblclick','contextmenu','keydown','keyup','wheel','touchstart','touchmove','dragstart'];
 const block=event=>{if(!isLocked())return;if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();};
 for(const type of events)target.addEventListener(type,block,{capture:true,passive:false});
 return ()=>{for(const type of events)target.removeEventListener(type,block,true);};
}
