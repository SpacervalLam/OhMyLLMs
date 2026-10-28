// All characters use actual drawn frames: 6 columns × 5 state rows.
// Animation time belongs to the simulation, so pause and battle speed stay exact.
export const SHEET_COLUMNS=6;
export const SHEET_ROWS=5;
export const ANIMATION_STATES=Object.freeze({
 idle:   Object.freeze({row:0,frames:6,fps:6,loop:true}),
 special:Object.freeze({row:1,frames:6,fps:8,loop:true}),
 // Walking uses one accepted mid-stride pose per CEO (renderer attaches
 // atlas.walkPose from assets/animations/walk/ceos-walk.webp), and
 // sprite-atlas.js simulates the two-step bob, sway and tilt on this clock.
 // fps is the simulated stride rate. Without the sheet the walk falls back to
 // the idle opening pose with the same simulation.
 walk:   Object.freeze({row:0,frames:1,fps:1.5,loop:true}),
 attack: Object.freeze({row:2,frames:6,fps:12,loop:false}),
 hurt:   Object.freeze({row:3,frames:6,fps:15,loop:false}),
 defeat: Object.freeze({row:4,frames:6,fps:10,loop:false})
});
export const ANIMATED_CHARACTERS=Object.freeze([
 'deepseek','chatgpt','claude','kimi','gemini','glm','grok','minimax','qwen',
 'sam','dario','elon','jensen','mark','liang',
 'runner','medic','bulwark','banner','ipo','overlord','doubao','mimo','pony','jack','pony_super','qq_raider','trump','military_claude','elon_super','starlink_drone','grok_projection'
]);
export function playAnimation(actor,state,{restart=true}={}){
 if(!ANIMATION_STATES[state])throw new RangeError(`Unknown animation state: ${state}`);
 if(!restart&&actor.animation?.state===state)return;
 actor.animation={state,time:0};
}
export function advanceAnimation(actor,dt,base='idle',rate=1){
 if(!actor.animation)actor.animation={state:base,time:0};
 let state=ANIMATION_STATES[actor.animation.state];
 if(state.loop&&actor.animation.state!==base){actor.animation={state:base,time:0};state=ANIMATION_STATES[base];}
 actor.animation.time+=Math.max(0,dt)*(state.loop?rate:1);
 if(!state.loop&&actor.animation.state!=='defeat'&&actor.animation.time>=state.frames/state.fps){
  const remainder=actor.animation.time-state.frames/state.fps;
  actor.animation={state:base,time:remainder};
 }
}
// Sustained actions must not read as a paused still. This keeps one drawing
// and its neighbours cycling at the state's own fps, so a held channel breathes
// instead of freezing; the elapsed clock is passed in, never accumulated here.
export function loopingFrame(state,from,count,elapsed=0){
 const definition=ANIMATION_STATES[state];
 if(!definition)throw new RangeError(`Unknown animation state: ${state}`);
 if(count<1||from<0||from+count>definition.frames)throw new RangeError(`Frame window out of range: ${state} [${from},${from+count})`);
 const step=Math.floor(Math.max(0,elapsed)*definition.fps+1e-8)%count;
 return {state,time:(from+step)/definition.fps};
}
export function animationFrame(animation={state:'idle',time:0},reduced=false){
 const state=ANIMATION_STATES[animation.state]||ANIMATION_STATES.idle;
 const raw=Math.floor(Math.max(0,animation.time)*state.fps+1e-8);
 const column=reduced?0:state.loop?raw%state.frames:Math.min(raw,state.frames-1);
 return {row:state.row,column,state:animation.state||'idle'};
}
export function sheetFrameRect(width,height,{row,column}){
 return {x:Math.round(width*column/SHEET_COLUMNS),y:Math.round(height*row/SHEET_ROWS),
  w:Math.round(width*(column+1)/SHEET_COLUMNS)-Math.round(width*column/SHEET_COLUMNS),
  h:Math.round(height*(row+1)/SHEET_ROWS)-Math.round(height*row/SHEET_ROWS)};
}
