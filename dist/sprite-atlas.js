import {ANIMATION_STATES,SHEET_COLUMNS,SHEET_ROWS,animationFrame,sheetFrameRect} from './animation.js';

export function makeSpriteAtlas(image,layout=null){
 if(layout?.frames&&layout.width===image.naturalWidth&&layout.height===image.naturalHeight){
  const horizontalExtent=Math.max(...layout.frames.flat().map(frame=>Math.max(frame.anchorX,frame.w-frame.anchorX)))*2;
  return {image,frames:layout.frames,referenceHeight:layout.referenceHeight,horizontalExtent,columns:6,rows:5};
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
export function drawAtlasSprite(ctx,atlas,animation,x,baseline,size,{opacity=1,reduced=false}={}){
 if(!atlas)return false;
 const frame=animationFrame(animation,reduced),cell=sheetFrameRect(atlas.image.naturalWidth,atlas.image.naturalHeight,frame),crop=atlas.crop;
 if(atlas.frames){
  const source=atlas.frames[frame.row][frame.column],scale=size/atlas.referenceHeight;
  ctx.save();ctx.globalAlpha*=opacity;
  ctx.drawImage(atlas.image,source.x,source.y,source.w,source.h,x-source.anchorX*scale,baseline-source.h*scale,source.w*scale,source.h*scale);
  ctx.restore();return true;
 }
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
