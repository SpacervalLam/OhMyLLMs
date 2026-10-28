import {ANIMATION_STATES,SHEET_COLUMNS,SHEET_ROWS,animationFrame,sheetFrameRect} from './animation.js';

export function makeSpriteAtlas(image,layout=null){
 if(layout?.frames&&layout.width===image.naturalWidth&&layout.height===image.naturalHeight){
  const horizontalExtent=Math.max(...layout.frames.flat().map(frame=>Math.max(frame.anchorX,frame.w-frame.anchorX)))*2;
  return {image,frames:layout.frames,referenceHeight:layout.referenceHeight,horizontalExtent,columns:layout.columns,rows:layout.rows,walkFrames:!!layout.walkFrames,walkFps:layout.walkFps||8};
 }
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 // One common crop for the entire sheet. Per-frame tight crops would erase
 // steps and recoils by re-centering every pose, and make faces jump in size.
 let minX=Infinity,minY=Infinity,maxX=-1,maxY=-1;
 for(let row=0;row<SHEET_ROWS;row++)for(let column=0;column<SHEET_COLUMNS;column++){
  const cell=sheetFrameRect(canvas.width,canvas.height,{row,column});
  for(let y=0;y<cell.h;y++)for(let x=0;x<cell.w;x++){
   if(pixels[((cell.y+y)*canvas.width+cell.x+x)*4+3]>50){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  }
 }
 if(maxX<0)throw new Error('Empty animation atlas');
 const crop={x:Math.max(0,minX-1),y:Math.max(0,minY-1),w:maxX-minX+3,h:maxY-minY+3};
 return {image,crop,referenceHeight:crop.h,horizontalExtent:crop.w,columns:SHEET_COLUMNS,rows:SHEET_ROWS};
}
// Simulated gait on top of the static walking picture. Two footfalls per
// cycle: the body rises and settles, sways sideways and leans into each step.
const WALK_BOB_PX=2.8,WALK_SWAY_PX=1.2,WALK_TILT=0.05;
function walkPoseDraw(ctx,pose,x,baseline,size,opacity,reduced,time){
 const scale=size/pose.referenceHeight;
 ctx.save();ctx.globalAlpha*=opacity;
 // The gait transform moves the origin onto the feet, so while it is active
 // the pose offsets must stay relative to that origin; mixing in x/baseline
 // again would double the offset and fling the sprite off-canvas.
 const dx=reduced?x-pose.anchorX*scale:-pose.anchorX*scale;
 const dy=reduced?baseline-pose.h*scale:-pose.h*scale;
 if(!reduced){
  const phase=time*ANIMATION_STATES.walk.fps*Math.PI*2;
  ctx.translate(x+Math.sin(phase*2)*WALK_SWAY_PX,baseline-Math.abs(Math.sin(phase))*WALK_BOB_PX);
  ctx.rotate(Math.sin(phase)*WALK_TILT);
 }
 // Bottom-anchored on the drawn feet so the pose stays planted on the baseline.
 ctx.drawImage(pose.image,pose.x,pose.y,pose.w,pose.h,dx,dy,pose.w*scale,pose.h*scale);
 ctx.restore();return true;
}
export function drawAtlasSprite(ctx,atlas,animation,x,baseline,size,{opacity=1,reduced=false}={}){
 if(!atlas)return false;
 if(animation?.state==='walk'&&!atlas.walkFrames){
  if(atlas.walkPose)return walkPoseDraw(ctx,atlas.walkPose,x,baseline,size,opacity,reduced,animation.time||0);
  // No accepted pose sheet: the idle opening picture carries the same simulation.
  if(!reduced){
   const phase=(animation.time||0)*ANIMATION_STATES.walk.fps*Math.PI*2;
   ctx.save();ctx.globalAlpha*=opacity;
   ctx.translate(x+Math.sin(phase*2)*WALK_SWAY_PX,baseline-Math.abs(Math.sin(phase))*WALK_BOB_PX);
   ctx.rotate(Math.sin(phase)*WALK_TILT);
   // Restore before returning: a leaked transform would offset every sprite
   // drawn after this one.
   const drawn=drawStillSprite(ctx,atlas,animation,0,0,size,reduced);
   ctx.restore();
   return drawn;
  }
 }
 return drawStillSprite(ctx,atlas,animation,x,baseline,size,reduced,opacity);
}
function drawStillSprite(ctx,atlas,animation,x,baseline,size,reduced,opacity=1){
 const frame=animation?.state==='walk'&&atlas.walkFrames?{row:1,column:reduced?0:Math.floor(Math.max(0,animation.time)*atlas.walkFps)%6}:animationFrame(animation,reduced);
 if(atlas.frames){
  const source=atlas.frames[frame.row][frame.column],scale=size/atlas.referenceHeight;
  ctx.save();ctx.globalAlpha*=opacity;
  ctx.drawImage(atlas.image,source.x,source.y,source.w,source.h,x-source.anchorX*scale,baseline-source.h*scale,source.w*scale,source.h*scale);
  ctx.restore();return true;
 }
 const cell=sheetFrameRect(atlas.image.naturalWidth,atlas.image.naturalHeight,frame),crop=atlas.crop;
 const w=Math.min(crop.w,cell.w-crop.x),h=Math.min(crop.h,cell.h-crop.y);
 const scale=Math.min(size/crop.h,size*1.15/crop.w),dw=w*scale,dh=h*scale;
 ctx.save();ctx.globalAlpha*=opacity;
 ctx.drawImage(atlas.image,cell.x+crop.x,cell.y+crop.y,w,h,x-dw/2,baseline-dh,dw,dh);
 ctx.restore();return true;
}
export function previewAnimation(state,time){
 const definition=ANIMATION_STATES[state]||ANIMATION_STATES.idle;
 // The gallery loops all six frames even for a one-shot gameplay action.
 return {state,time:time%(definition.frames/definition.fps)};
}
