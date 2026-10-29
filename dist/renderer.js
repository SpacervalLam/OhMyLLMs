import {characterAtlas} from './defense-art.js';
import {starsOf,stackDescription} from './ranks.js';
import {FIELD} from './engine.js';
import {MODELS,CEOS,MODEL_MAP,CEO_MAP,COPY} from './data.js';
import {ANIMATED_CHARACTERS} from './animation.js';
import {makeSpriteAtlas,drawAtlasSprite} from './sprite-atlas.js';
import {enemySize,drawEnemyKit,drawBossBars,drawPonyRaid,drawPonyRope,ponyDropOffset,drawSuperStatus} from './enemy-vfx.js';
import {drawTrumpOrders,drawTrumpEffect} from './trump-vfx.js';
import {drawElonGround,drawElonOrders,drawElonEffect,drawElonProjectile} from './elon-vfx.js';
import {drawSkillGround,drawSkillAura,drawSkillProjectile,drawSkillChannels,drawSkillEffect,drawCinematicFreeze,drawHarnesses,drawRankBase,drawUpgrade,drawTimeStop} from './skill-vfx.js';

const TAU=Math.PI*2;
function rounded(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function label(ctx,text,x,y,size=12,color='#7c8e6a',align='left'){ctx.fillStyle=color;ctx.font=`600 ${size}px "Segoe UI", "Microsoft YaHei", sans-serif`;ctx.textAlign=align;ctx.fillText(text,x,y);}
function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=fill;ctx.fill();}
function line(ctx,x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.lineWidth=1;}
function starShape(ctx,x,y,r,rot=0){ctx.beginPath();for(let i=0;i<8;i++){const a=rot+i/8*TAU,rr=i%2?r*.36:r;const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}
export function loadImage(url){return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=url;});}
export async function loadArtwork(){
 const [baseManifest,enemyManifest]=await Promise.all(['manifest.json','enemies-v1.json'].map(file=>fetch(`assets/animations/${file}`).then(r=>r.ok?r.json():null).catch(()=>null)));
 const manifest={characters:{...baseManifest?.characters,...enemyManifest?.characters}};
 const [models,ceos,entries]=await Promise.all([loadImage('assets/models.webp'),loadImage('assets/ceos.webp'),
  Promise.all(ANIMATED_CHARACTERS.map(async id=>{const image=await loadImage(`assets/animations/${id}.webp`);return [id,image?makeSpriteAtlas(image,manifest?.characters[id]):null];}))]);
 const animations=Object.fromEntries(entries);
 // One accepted mid-stride walking pose per CEO in a shared sheet. Each pose is
 // scaled by the sheet reference height so it matches the idle sprite size, and
 // sprite-atlas.js adds the simulated gait on top. Missing sheet is fine: the
 // walk then falls back to the idle opening pose with the same simulation.
 const walkImage=ceos,walkLayout=await fetch('assets/animations/walk/ceos-walk.json').then(r=>r.ok?r.json():null).catch(()=>null);
 if(walkImage&&walkLayout?.characters&&walkLayout.referenceHeight>0)for(const [id,pose] of Object.entries(walkLayout.characters)){
  if(animations[id]&&pose.w>0&&pose.h>0){
   animations[id].walkPose={image:walkImage,x:pose.x,y:pose.y,w:pose.w,h:pose.h,anchorX:pose.anchorX??pose.w/2,referenceHeight:walkLayout.referenceHeight};
  }
 }
 const [projectileArt,frostArt]=await Promise.all([loadImage('assets/projectiles/projectiles-v1.webp'),loadImage('assets/effects/glm-frost-field-v1.webp')]);
 const defenseLayout=await fetch('assets/armor/characters-v1.json').then(r=>r.ok?r.json():null).catch(()=>null);
 const defenseEntries=await Promise.all(['dario','jensen'].map(async id=>{
  const image=await loadImage(`assets/armor/${id}-defended-v1.webp`);
  if(!image)return [id,null];
  const atlas=makeSpriteAtlas(image,defenseLayout?.characters?.[`${id}-defended-v1`]);
  const step=atlas.frames?.[1]?.[2];
  if(step)atlas.walkPose={image,...step,referenceHeight:atlas.referenceHeight};
  return [id,atlas];
 }));
 const defenseAnimations=Object.fromEntries(defenseEntries);
 return {models,ceos,animations,projectileArt,frostArt,defenseAnimations,missingAnimations:ANIMATED_CHARACTERS.filter(id=>!animations[id])};
}
export class GardenRenderer{
 constructor(canvas,art){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.art=art;this.hover=null;this.selection=null;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.rects={};this.cropAtlas('models',3,3);this.cropAtlas('ceos',3,2);
  this.maskCanvas=document.createElement('canvas');this.maskCanvas.width=128;this.maskCanvas.height=128;
  this.background=document.createElement('canvas');this.background.width=FIELD.width;this.background.height=FIELD.height;
  this.resize();
 }
 resize(dpr=globalThis.devicePixelRatio||1){
  const bounds=this.canvas.getBoundingClientRect();
  const width=Math.max(1,Math.round(bounds.width*dpr)),height=Math.max(1,Math.round(bounds.height*dpr));
  if(this.canvas.width===width&&this.canvas.height===height&&this.background.width===width&&this.background.height===height)return;
  this.canvas.width=width;this.canvas.height=height;
  this.ctx.setTransform(width/FIELD.width,0,0,height/FIELD.height,0,0);
  this.background.width=width;this.background.height=height;
  this.makeBackground();
 }
 cropAtlas(kind,cols,rows){
  const img=this.art[kind];if(!img)return;const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;
  this.rects[kind]=[];
  const xs=kind==='models'?[0,447,841,1244].map(x=>Math.round(x*img.naturalWidth/1244)):Array.from({length:cols+1},(_,i)=>Math.round(c.width*i/cols));
  const ys=kind==='models'?[0,435,875,1265].map(y=>Math.round(y*img.naturalHeight/1265)):Array.from({length:rows+1},(_,i)=>Math.round(c.height*i/rows));
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   let minX=xs[col+1],minY=ys[row+1],maxX=xs[col],maxY=ys[row];
   for(let y=ys[row];y<ys[row+1];y++)for(let x=xs[col];x<xs[col+1];x++)if(pixels[(y*c.width+x)*4+3]>70){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
   this.rects[kind].push({x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1});
  }
 }
 makeBackground(){
  const ctx=this.background.getContext('2d');ctx.setTransform(this.background.width/FIELD.width,0,0,this.background.height/FIELD.height,0,0);ctx.fillStyle='#e9eddb';ctx.fillRect(0,0,1120,650);
  // Warm paths and a quiet, hand-drawn garden border.
  ctx.fillStyle='#e0e5d0';ctx.fillRect(0,70,1120,548);
  rounded(ctx,12,91,84,507,14,'#d5ddc6');
  rounded(ctx,100,98,901,490,13,'#8fab73');
  ctx.save();ctx.beginPath();ctx.roundRect(100,104,900,480,10);ctx.clip();
  for(let row=0;row<5;row++)for(let col=0;col<9;col++){
   const x=100+col*100,y=104+row*96;
   ctx.fillStyle=(col+row)%2===0?'#bad49e':'#b0cd92';ctx.fillRect(x,y,100,96);
   line(ctx,x,y+95,x+100,y+95,'#91b57b33');
   for(let i=0;i<4;i++){
    const px=x+13+(col*31+row*17+i*27)%77,py=y+12+(row*19+col*9+i*23)%70;
    line(ctx,px-3,py+2,px,py-2,'#89b16c60',1.5);line(ctx,px,py-2,px+3,py+2,'#89b16c60',1.5);
   }
   if((col*3+row*7)%11===0){const px=x+73,py=y+29;ellipse(ctx,px,py,3.5,3.5,'#edf0be');ellipse(ctx,px+4,py+2,2,2,'#f7f1d7');}
  }
  ctx.restore();
  // CEO entrance: a sandy footpath with pebbles and a pale wooden fence.
  rounded(ctx,1006,94,103,500,12,'#e9dfc4');
  for(let y=125;y<580;y+=43){ellipse(ctx,1040+(y%3)*11,y,5,3,'#d7cfb3');ellipse(ctx,1082,y+20,3,2,'#d7cfb3');}
  for(let x=1020;x<1100;x+=17){rounded(ctx,x,45,10,38,3,'#cad2b7','#b8c4a2');}line(ctx,1017,58,1103,58,'#b8c4a2',3);line(ctx,1017,73,1103,73,'#b8c4a2',3);
  // Border plants, stones, and a tiny watering can.
  for(const [x,y,s] of [[117,74,1],[150,72,.7],[930,74,.8],[980,77,.7],[126,608,.65],[963,610,.75]])this.bush(ctx,x,y,s);
  ellipse(ctx,882,608,10,5,'#cdd5bc');ellipse(ctx,906,609,6,4,'#c5cfb2');
  ctx.save();ctx.translate(223,615);ctx.rotate(-.17);rounded(ctx,-14,-10,26,18,4,'#b7c5a1');ctx.strokeStyle='#a8b994';ctx.lineWidth=3;ctx.beginPath();ctx.arc(15,-4,8,-1.6,1.6);ctx.stroke();ctx.beginPath();ctx.moveTo(-13,-4);ctx.lineTo(-29,-13);ctx.lineTo(-32,-9);ctx.lineTo(-14,3);ctx.fillStyle='#a9bb94';ctx.fill();ctx.restore();
  // Subtle planting markings on the path, without relying on imagery.
  for(let row=0;row<5;row++){label(ctx,String(row+1).padStart(2,'0'),24,FIELD.y+row*96+52,10,'#a5b093');}
  ctx.setLineDash([3,6]);line(ctx,1055,111,1055,575,'#cec4a450');ctx.setLineDash([]);
 }
 bush(ctx,x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ellipse(ctx,0,3,20,6,'#bfccb0');for(const [dx,dy,angle]of[[-12,-4,-.7],[-3,-10,-.25],[7,-7,.4],[15,-2,.8]]){ctx.save();ctx.translate(dx,dy);ctx.rotate(angle);ellipse(ctx,0,-4,5,11,'#9fb88a');line(ctx,0,-11,0,4,'#8ea879');ctx.restore();}ctx.restore();}
 sprite(kind,index,x,y,size,bob=0,opacity=1,actor=null){
  const id=kind==='models'?MODELS[index].id:CEOS[index].id;
  const atlas=characterAtlas(this.art,id,actor);
  // 两张面板本身就是朝左画的，先翻正再叠加朝向：翻转是两次取反，不是一次。
  const drawnLeft=kind==='models'&&['doubao','mimo'].includes(id)||kind==='ceos'&&id==='military_claude';
  const turned=kind==='models'&&(actor?.facing??1)<0;
  const mirrored=drawnLeft!==turned;
  if(mirrored){this.ctx.save();this.ctx.translate(x*2,0);this.ctx.scale(-1,1);}
  const drawn=drawAtlasSprite(this.ctx,atlas,actor?.animation||{state:'idle',time:this.animationTime||0},x,y,size,{opacity,reduced:this.reduced});
  if(drawn){if(mirrored)this.ctx.restore();return;}
  // The static fallback sits inside the same transform, so a turned unit still
  // reads as turned when its animation sheet is missing.
  const img=this.art[kind],rect=this.rects[kind]?.[index],ctx=this.ctx;if(!img||!rect){if(mirrored)this.ctx.restore();ellipse(ctx,x,y,20,25,kind==='models'?'#8ba3ac':'#bd957d');return;}
  const scale=Math.min(size/rect.h,size*1.05/rect.w),w=rect.w*scale,h=rect.h*scale;
  ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(img,rect.x,rect.y,rect.w,rect.h,x-w/2,y-h+bob,w,h);ctx.restore();
  if(mirrored)this.ctx.restore();
 }
 bar(x,y,hp,max,color='#6d965a',extra=0){
  const ctx=this.ctx,w=46;rounded(ctx,x-w/2,y,w,4,2,'#45613126');rounded(ctx,x-w/2,y,w*Math.max(0,hp/max),4,2,color);
  if(extra>0)rounded(ctx,x-w/2,y-5,Math.min(w,extra/max*w),3,2,'#a2a6bf');
 }
  // Status tints reuse the exact animated silhouette as an alpha mask, including
  // gaps between limbs. No rectangle is painted over the character or the lawn.
  maskTint(actor,index,size,paint){
   const main=this.ctx,c=this.maskCanvas.getContext('2d');c.clearRect(0,0,128,128);
   c.save();c.translate(64-actor.x,100-(actor.y+26));
   try{this.ctx=c;this.sprite('ceos',index,actor.x,actor.y+26,size,0,1,actor);}finally{this.ctx=main;c.restore();}
   c.save();c.globalCompositeOperation='source-atop';paint(c);c.restore();
   return this.maskCanvas;
  }
  burning(actor,index,size,t){
   if(!actor.burn||actor.hp<=0)return;
   const main=this.ctx;
   const c=this.maskTint(actor,index,size,ctx=>{
    const heat=ctx.createLinearGradient(0,24,0,107);heat.addColorStop(0,'#a52d0800');heat.addColorStop(.4,'#e85c1640');heat.addColorStop(1,'#ffc44bcc');ctx.fillStyle=heat;ctx.fillRect(0,0,128,128);
    for(let i=0;i<9;i++){
     const x=32+i*8,y=102,tip=43+Math.sin(t*7+i*2.4+actor.id)*16;
     ctx.beginPath();ctx.moveTo(x-9,y);ctx.bezierCurveTo(x-12,y-25,x+13,tip+15,x,tip);ctx.bezierCurveTo(x+25,tip+27,x+10,y-15,x+10,y);ctx.closePath();ctx.fillStyle=i%2?'#ffb631a6':'#ec5d257d';ctx.fill();
    }
   });
   main.save();main.globalAlpha=.58*Math.min(1,actor.burn.remaining/.3);main.drawImage(c,actor.x-64,actor.y-74);
   for(let i=0;i<6;i++){const p=(t*.7+i*.163+actor.id*.07)%1,x=actor.x+Math.sin(i*2.4+actor.id)*24+Math.sin(t*3+i)*4,y=actor.y+18-p*63;main.globalAlpha=(1-p)*.7;ellipse(main,x,y,1.2,2.1,i%2?'#ffc34c':'#ef783c');}
   main.restore();
  }
  // GLM's slow shows on the CEO as a thin blue status coat. It stays away from pure
  // white and from an opaque veil: the blue tiles underneath say where the patch is,
  // this only says which CEO is standing in it.
  frozen(actor,index,size,t){
   if(!(actor.slow>0)||actor.hp<=0)return;
   const main=this.ctx;
   const c=this.maskTint(actor,index,size,ctx=>{
    const chill=ctx.createLinearGradient(0,20,0,107);
    chill.addColorStop(0,'#6ba6ccc8');chill.addColorStop(.55,'#4785b4d2');chill.addColorStop(1,'#30709fd8');
    ctx.fillStyle=chill;ctx.fillRect(0,0,128,128);
    // Cold gathers at the feet instead of a white band across the body.
    const rise=ctx.createLinearGradient(0,76,0,107);
    rise.addColorStop(0,'#bfe6ff00');rise.addColorStop(1,'#bfe6ff96');
    ctx.fillStyle=rise;ctx.fillRect(0,76,128,31);
   });
   const life=Math.min(1,actor.slow/1.2);
   // One save/restore pair for the veil and the motes: leaking the alpha here used
   // to wash out every sprite drawn after the first slowed CEO.
   main.save();
   main.globalAlpha=.6*life;main.drawImage(c,actor.x-64,actor.y-74);
   for(let i=0;i<3;i++){const p=(t*.45+i*.33+actor.id*.11)%1,x=actor.x+Math.sin(i*2.3+actor.id)*20,y=actor.y+14-p*34;main.globalAlpha=(1-p)*.5;ellipse(main,x,y,1.5,1.5,'#dff4ff');}
   main.restore();
  }
 draw(game,now){
  this.resize();
  const ctx=this.ctx;ctx.clearRect(0,0,1120,650);ctx.drawImage(this.background,0,0,FIELD.width,FIELD.height);
  const t=this.reduced?0:game.tickTime;this.animationTime=t;
  // No running text on the board: state lives in the top note, names in the roster.
  // Rescue carts are graphics cards, because compute saves the day.
  for(let row=0;row<5;row++){
   const y=FIELD.y+row*96+48;
   if(game.mowers[row])this.mower(62,y,false);else{ctx.save();ctx.globalAlpha=.2;this.mower(62,y,false);ctx.restore();}
  }
  drawSkillGround(ctx,game,t,this.art.frostArt);
  drawElonGround(ctx,game,t);
  drawHarnesses(ctx,game,t);
  if(this.hover&&['playing','ready'].includes(game.phase)){
   const {row,col}=this.hover,x=100+col*100,y=104+row*96;const occupant=game.units.find(u=>u.row===row&&u.col===col),occupied=!!occupant,merge=occupant&&occupant.model===this.selection&&starsOf(occupant)<3;
   rounded(ctx,x+3,y+3,94,90,10,this.selection==='shovel'?'#deac7550':merge?'#edcf7655':occupied?'#e5b39535':'#fffde638',this.selection==='shovel'?'#bf9265':merge?'#f5d879':occupied?'#bd9b72':'#eff5d1');
   if(this.dragTarget)rounded(ctx,x+3,y+3,94,90,10,this.dragTarget.valid?'#bfd89340':'#d48e7855',this.dragTarget.valid?'#f6e5a1':'#b87359');
   if(this.selection&&this.selection!=='shovel'&&!occupied)this.sprite('models',MODEL_MAP[this.selection].index,x+50,y+78,76,0,.4);
   if(!this.selection&&!occupied){line(ctx,x+44,y+48,x+56,y+48,'#f6f8e5a0',2);line(ctx,x+50,y+42,x+50,y+54,'#f6f8e5a0',2);}
  }
  const sprites=[...game.units.map(u=>({kind:'unit',value:u})),...game.enemies.map(e=>({kind:'enemy',value:e})),...(game.allies||[]).map(e=>({kind:'ally',value:e})),...game.departures.map(d=>({kind:'departure',value:d}))].sort((a,b)=>a.value.row-b.value.row||a.value.x-b.value.x);
  for(const {kind,value:v} of sprites){
   if(kind==='departure'){
    if(v.exit==='withdraw'){
     const p=Math.min(1,v.departureAge/.85);this.sprite('ceos',CEO_MAP[v.type].index,v.x+p*110,v.y+26,enemySize(v),0,1-p,{...v,animation:{state:'idle',time:0}});continue;
    }
    if(v.exit==='rope'){
     const lift=Math.pow(Math.min(1,v.departureAge/.85),2)*(v.y+130),opacity=Math.max(0,Math.min(1,(.85-v.departureAge)/.2));
     drawPonyRope(ctx,v,lift);
     if(v.carried)this.sprite('models',MODEL_MAP[v.carried.model].index,v.x-18,v.y+38-lift,66,0,opacity,{...v.carried,animation:{state:'idle',time:0}});
     this.sprite('ceos',CEO_MAP[v.type].index,v.x+12,v.y+13-lift,85,0,opacity,{...v,animation:{state:'idle',time:0}});continue;
    }
    const fading=Math.min(1,(.85-v.departureAge)/.25);
    const unit=v.kind==='unit',index=unit?MODEL_MAP[v.model].index:CEO_MAP[v.type].index;
    if(v.allied){ctx.save();ctx.translate(v.x*2,0);ctx.scale(-1,1);}
    this.sprite(unit?'models':'ceos',index,v.x,v.y+26,unit?85:enemySize(v),0,Math.max(0,fading),v);
    if(v.allied)ctx.restore();continue;
   }
   if(v.raid?.phase==='warning')continue;
   ellipse(ctx,v.x,v.y+27,kind==='enemy'?25:26,7,'#4d79452d');
   if(kind==='unit')drawRankBase(ctx,v,t);
   if(kind==='unit'){
    const m=MODEL_MAP[v.model];

    if(v.strike){this.sprite('models',m.index,v.x,v.y+24,85,0,.62,v);ctx.font='600 10px "Segoe UI", "Microsoft YaHei", sans-serif';const badgeWidth=Math.max(96,ctx.measureText(COPY[game.lang].strike).width+16);rounded(ctx,v.x-badgeWidth/2,v.y-64,badgeWidth,21,5,'#fff2d8','#d6b27a');label(ctx,COPY[game.lang].strike,v.x,v.y-49,10,'#aa7a42','center');}
    // No brightness flash on cast or hit. Canvas ctx.filter is the one path that
    // can brighten the whole frame on some GPUs, and the drawn attack/hurt pose
    // already says what happened; the tint was never worth a full-screen flash.
    else this.sprite('models',m.index,v.x,v.y+26,88,0,1,v);
    // 默认朝向是全体共有的，所以只给回头的那一位留记号：脚下一块朝左的喙标。
    if((v.facing??1)<0)this.facingMark(ctx,v,m.color);
    // Bell stun: a small gold bell and orbiting notes mark a silenced model.
    if(v.stun>0){ctx.save();ctx.globalAlpha=.9;ctx.strokeStyle='#e2c073';ctx.lineWidth=1.2;
     ctx.beginPath();ctx.arc(v.x,v.y-54,12,0,TAU);ctx.stroke();
     ctx.fillStyle='#e9c875';ctx.beginPath();ctx.moveTo(v.x-5,v.y-60);ctx.quadraticCurveTo(v.x-4,v.y-66,v.x,v.y-67);ctx.quadraticCurveTo(v.x+4,v.y-66,v.x+5,v.y-60);ctx.closePath();ctx.fill();
     line(ctx,v.x,v.y-70,v.x,v.y-67,'#f5dfa7',1.6);
     for(let i=0;i<3;i++){const a=t*4+i*TAU/3;starShape(ctx,v.x+Math.cos(a)*15,v.y-54+Math.sin(a)*4,2.6,t);ctx.fillStyle='#e9c875';ctx.fill();}
     ctx.restore();}
    if(v.hp<v.maxHp)this.bar(v.x,v.y+32,v.hp,v.maxHp);
    drawSkillAura(ctx,v,t);
   }else{
    const c=CEO_MAP[v.type];
    const drop=ponyDropOffset(v);drawPonyRope(ctx,v,drop);
    if(v.allied){ctx.save();ctx.translate(v.x*2,0);ctx.scale(-1,1);}
    this.sprite('ceos',c.index,v.x,v.y+26-drop,enemySize(v),0,v.raid?.phase==='landed'?.85:1,v);
    if(v.allied){ctx.restore();ellipse(ctx,v.x,v.y+27,28,8,'#79cbb350');label(ctx,game.lang==='zh'?'友方':game.lang==='ja'?'味方':'ALLY',v.x,v.y-64,10,'#477c67','center');}
    if(drop<=0){this.frozen(v,c.index,enemySize(v),t);this.burning(v,c.index,enemySize(v),t);}
    drawEnemyKit(ctx,v,t);
    // No ring under a slowed CEO: the body mask and the cold tiles already say it,
    // and a ring at the feet collided with the print of the shield and shadow.
    if(v.boost>0){ctx.beginPath();ctx.moveTo(v.x+27,v.y);ctx.lineTo(v.x+56+Math.sin(t*25)*8,v.y+8);ctx.lineTo(v.x+29,v.y+16);ctx.fillStyle='#efa45b';ctx.fill();}

    drawCinematicFreeze(ctx,v,t);
    this.bar(v.x,v.y+32,v.hp,v.maxHp,v.allied?'#79b99d':'#ba8669',v.armor+v.shield);
   }
  }
  drawSkillChannels(ctx,game,t);
  for(const e of game.enemies)drawPonyRaid(ctx,e,t,game.lang);
  drawSuperStatus(ctx,game,t);
  drawTrumpOrders(ctx,game,t);
  drawElonOrders(ctx,game,t);
  for(const p of game.projectiles)if(!(p.delay>0)&&!drawElonProjectile(ctx,p,t))drawSkillProjectile(ctx,p,t,this.art.projectileArt);
  for(const c of game.coins){
   const y=c.y+Math.sin(t*3+c.id)*2;ellipse(ctx,c.x,y+14,12,4,'#8f8a4520');
   ctx.save();ctx.shadowColor='#ead27880';ctx.shadowBlur=12;ellipse(ctx,c.x,y,15,15,'#e3bc59');ctx.shadowBlur=0;ellipse(ctx,c.x,y-1,11,11,'#f4d481');ctx.restore();
   if(c.age>6){label(ctx,String(c.value),c.x,y-22,10,'#a88e45','center');}
  }
  drawTimeStop(ctx,game);
  for(const f of game.effects)this.effect(f,t);
  drawBossBars(ctx,game);
  const hovered=this.hover&&game.units.find(u=>u.row===this.hover.row&&u.col===this.hover.col&&u.hp>0);
  if(hovered&&!this.dragTarget){
   const text=stackDescription(hovered,game.lang);ctx.save();ctx.font='600 11px "Segoe UI", "Microsoft YaHei", sans-serif';
   const w=ctx.measureText(text).width+20,x=Math.max(102+w/2,Math.min(998-w/2,hovered.x)),y=hovered.y-70;
   rounded(ctx,x-w/2,y,w,23,7,'#fffdf3f2','#b2bd9d');label(ctx,text,x,y+15,11,'#596a4d','center');ctx.restore();
  }
 }
 // A turned model gets two small chevrons on the lawn at its feet, pointing the
 // way it now covers. Only the exception is marked, so a default board stays clean.
 facingMark(ctx,v,color){
  const y=v.y+42;
  ctx.save();ctx.globalAlpha=.95;
  for(const [offset,alpha] of [[0,.95],[-11,.45]]){
   ctx.beginPath();ctx.moveTo(v.x-30+offset,y);ctx.lineTo(v.x-20+offset,y-5);ctx.lineTo(v.x-20+offset,y+5);ctx.closePath();
   ctx.fillStyle=color;ctx.globalAlpha=alpha;ctx.fill();
  }
  ctx.restore();
 }
 mower(x,y,moving){
  const ctx=this.ctx;ctx.save();
  ellipse(ctx,x,y+23,30,6,'#42513230');
  // A hovering graphics card: exposed heatsink, PCIe edge,
  // I/O bracket and two large axial fans distinguish it from a lawnmower.
  rounded(ctx,x-28,y+12,57,5,2,'#76818a','#454f58');
  rounded(ctx,x-30,y-17,60,28,4,'#252d33','#151c22');
  rounded(ctx,x-27,y-14,54,5,1,'#62717b');
  for(let i=-24;i<=24;i+=4)line(ctx,x+i,y-13,x+i,y-9,'#a1afb7',1);
  rounded(ctx,x-30,y-8,60,21,3,'#333d44','#172027');
  line(ctx,x-26,y-5,x-17,y-5,'#94cf4a',2);line(ctx,x+18,y+10,x+26,y+10,'#94cf4a',2);
  for(const xx of [-14,14]){
   const fx=x+xx,fy=y+2;ellipse(ctx,fx,fy,11,11,'#11191f');
   ctx.save();ctx.translate(fx,fy);ctx.rotate(moving?(this.animationTime||0)*20:xx*.03);
   for(let i=0;i<7;i++){
    ctx.rotate(TAU/7);ctx.beginPath();ctx.moveTo(2,-2);ctx.quadraticCurveTo(10,-8,9,-1);ctx.quadraticCurveTo(8,4,3,3);ctx.closePath();ctx.fillStyle=i%2?'#73848d':'#566873';ctx.fill();
   }
   ctx.restore();ellipse(ctx,fx,fy,3.2,3.2,'#99ce52');ellipse(ctx,fx-.7,fy-.7,1,1,'#d9f1ac');
  }
  rounded(ctx,x-15,y+13,30,4,0,'#c5a449');
  for(let i=-12;i<=12;i+=3)line(ctx,x+i,y+13,x+i,y+17,'#655832',.8);
  rounded(ctx,x-33,y-18,4,33,1,'#9ba7ad','#68767f');
  line(ctx,x-36,y-18,x-29,y-18,'#d0d7da',2);
  rounded(ctx,x+23,y-20,6,4,1,'#141d22');
  for(let i=0;i<3;i++)line(ctx,x+24+i*2,y-20,x+24+i*2,y-17,'#a3b647',.6);
  ctx.restore();
 }
 effect(f,t){
  const ctx=this.ctx;if(drawElonEffect(ctx,f)||drawTrumpEffect(ctx,f,t)||drawUpgrade(ctx,f)||drawSkillEffect(ctx,f,t))return;const p=f.age/f.duration;ctx.save();ctx.globalAlpha=1-p;
  if(f.type==='mower'){this.mower(60+p*((f.endX??1140)-60),f.y,true);ctx.restore();return;}
  if(f.type==='superCast'){
   ctx.strokeStyle=f.color;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(f.x,f.y,22+p*90,12+p*50,0,0,TAU);ctx.stroke();
   for(let i=0;i<5;i++){const angle=i/5*TAU+t,reach=20+p*65;starShape(ctx,f.x+Math.cos(angle)*reach,f.y+Math.sin(angle)*reach*.6,4,t);ctx.fillStyle=f.color;ctx.fill();}
   if(f.text){ctx.fillStyle=f.color;ctx.font='bold 22px "Segoe UI"';ctx.textAlign='center';ctx.fillText(f.text,f.x,f.y-45-p*22);}
   ctx.restore();return;
  }
  if(f.type==='bellWave'){
   // A listing bell's shockwave: three flat rings across the board, plus the bell itself.
   ctx.save();ctx.translate(f.x,f.y);ctx.scale(1,.45);
   for(let i=0;i<3;i++){
    const radius=22+p*188-i*16;
    // Inner rings start later; Canvas rejects a negative radius and stops the frame loop.
    if(radius<=0)continue;
    ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.strokeStyle=f.color;ctx.globalAlpha=(1-p)*(.55-i*.13);ctx.lineWidth=3-i;ctx.stroke();
   }
   ctx.restore();
   ctx.globalAlpha=Math.sin(Math.PI*Math.min(1,p*2));
   ctx.fillStyle='#e3bd6b';ctx.strokeStyle='#8f6c33';ctx.lineWidth=1.2;
   ctx.beginPath();ctx.moveTo(f.x-10,f.y-6);ctx.quadraticCurveTo(f.x-8,f.y-24,f.x,f.y-26);ctx.quadraticCurveTo(f.x+8,f.y-24,f.x+10,f.y-6);ctx.closePath();ctx.fill();ctx.stroke();
   ellipse(ctx,f.x,f.y-4,11,2.5,'#8f6c33');line(ctx,f.x,f.y-31,f.x,f.y-26,'#f5dfa7',2);
  }
  else if(f.type==='laneShift'){
   ctx.strokeStyle=f.color;ctx.lineWidth=2;
   for(let i=0;i<2;i++){ctx.beginPath();ctx.ellipse(f.x,f.y+i*6,18+p*40,7+p*14,0,0,TAU);ctx.globalAlpha=(1-p)*.9;ctx.stroke();}
   ctx.globalAlpha=1-p;ctx.fillStyle=f.color;
   for(const dir of [-1,1]){ctx.beginPath();ctx.moveTo(f.x+dir*(14+p*26),f.y-6);ctx.lineTo(f.x+dir*(26+p*26),f.y);ctx.lineTo(f.x+dir*(14+p*26),f.y+6);ctx.closePath();ctx.fill();}
  }
  else if(f.type==='prospectusMark'){
   // A telegraphed prospectus landing: dashed ring, then the paper falls inside it.
   const r=38-p*8;
   ctx.setLineDash([6,5]);ctx.strokeStyle=f.color;ctx.lineWidth=2;ctx.globalAlpha=.85;
   ctx.beginPath();ctx.ellipse(f.x,f.y,r*1.3,r*.55,0,0,TAU);ctx.stroke();ctx.setLineDash([]);
   ctx.globalAlpha=.25;ellipse(ctx,f.x,f.y,r*1.3,r*.55,f.color+'33');
   ctx.globalAlpha=1-p;ctx.fillStyle='#f7ecd2';ctx.strokeStyle='#b08a46';ctx.lineWidth=1;
   const py=f.y-58+Math.sin(p*Math.PI)*10;ctx.fillRect(f.x-7,py-10,14,20);ctx.strokeRect(f.x-7,py-10,14,20);
   for(let i=0;i<3;i++)line(ctx,f.x-4,py-6+i*5,f.x+4,py-6+i*5,'#b9a37d',.8);
  }
  else if(f.type==='stun'){
   ctx.strokeStyle=f.color;ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(f.x,f.y,16+p*12,5+p*4,0,0,TAU);ctx.stroke();
   for(let i=0;i<3;i++){const a=t*5+i*TAU/3;starShape(ctx,f.x+Math.cos(a)*16,f.y-14+Math.sin(a)*5,3,t);ctx.fillStyle=f.color;ctx.fill();}
  }
  else if(f.type==='renderClip'){
   // Seedance frames the outgoing attack as a short clip: viewfinder, REC dot, render bar.
   const x=f.x,y=f.y;
   ctx.strokeStyle=f.color;ctx.lineWidth=1.6;ctx.strokeRect(x-18,y-14,36,26);
   ctx.fillStyle=f.color;
   for(let i=0;i<4;i++){ctx.fillRect(x-15+i*9,y-11,4,2);ctx.fillRect(x-15+i*9,y+9,4,2);}
   ctx.beginPath();ctx.moveTo(x-3,y-5);ctx.lineTo(x+7,y);ctx.lineTo(x-3,y+5);ctx.closePath();ctx.fill();
   ctx.fillStyle='#d06b5f';ctx.beginPath();ctx.arc(x+13,y-10,2.2,0,TAU);ctx.fill();
   ctx.fillStyle='#d9efe4';ctx.fillRect(x-18,y+15,36,2);
   ctx.fillStyle=f.color;ctx.fillRect(x-18,y+15,36*Math.min(1,p),2);
  }
  else if(f.type==='multiEdit'){
   // TRAE answers with code brackets and the extra bounce count.
   const x=f.x,y=f.y;
   ctx.strokeStyle=f.color;ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(x-22,y-12);ctx.lineTo(x-28,y);ctx.lineTo(x-22,y+12);ctx.stroke();
   ctx.beginPath();ctx.moveTo(x+22,y-12);ctx.lineTo(x+28,y);ctx.lineTo(x+22,y+12);ctx.stroke();
   label(ctx,'×5',x,y-18,11,f.color,'center');
  }
  else if(f.type==='token'||f.type==='heal'||f.type==='quotaReset'||f.type==='score'){label(ctx,f.text,f.x,f.y-15-p*40,f.type==='score'?13:16,f.color,'center');}
  else if(f.type==='blast'){ctx.beginPath();ctx.arc(f.x,f.y,15+p*62,0,TAU);ctx.fillStyle=f.color+'45';ctx.fill();ctx.strokeStyle=f.color;ctx.lineWidth=3*(1-p);ctx.stroke();for(let i=0;i<8;i++){const a=i/8*TAU;ellipse(ctx,f.x+Math.cos(a)*p*65,f.y+Math.sin(a)*p*65,4,4,f.color);}}
  else if(f.type==='plant'){ctx.beginPath();ctx.ellipse(f.x,f.y+22,8+p*35,3+p*12,0,0,TAU);ctx.strokeStyle=f.color;ctx.lineWidth=2;ctx.stroke();for(let i=0;i<5;i++){const a=i/5*TAU;ellipse(ctx,f.x+Math.cos(a)*25*p,f.y-15-Math.sin(a)*25*p,3,3,'#f4efca');}}
  else if(f.type==='poof'){for(let i=0;i<6;i++){const a=i/6*TAU;ellipse(ctx,f.x+Math.cos(a)*25*p,f.y+Math.sin(a)*25*p,8*(1-p),8*(1-p),f.color+'aa');}}
  else if(f.type==='shield'){ctx.beginPath();ctx.ellipse(f.x,f.y-10,15+p*40,18+p*45,0,0,TAU);ctx.strokeStyle=f.color;ctx.lineWidth=2;ctx.stroke();}
  else if(f.type==='link'){
   // Kimi's memory threads: a curve to one ally, a light bead riding it, an arrival ripple.
   const mx=(f.x+f.tx)/2,my=Math.min(f.y,f.ty)-44;
   ctx.strokeStyle=f.color;ctx.lineWidth=1.4;
   ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.quadraticCurveTo(mx,my,f.tx,f.ty);ctx.stroke();
   const tt=Math.min(1,p*1.5);
   const qx=(1-tt)*(1-tt)*f.x+2*(1-tt)*tt*mx+tt*tt*f.tx;
   const qy=(1-tt)*(1-tt)*f.y+2*(1-tt)*tt*my+tt*tt*f.ty;
   ellipse(ctx,qx,qy,3,3,'#f0fff5');
   if(p>.6){ctx.globalAlpha=(1-p)/.4*.85;ctx.beginPath();ctx.ellipse(f.tx,f.ty,8+(p-.6)*44,8+(p-.6)*44,0,0,TAU);ctx.strokeStyle=f.color;ctx.lineWidth=1.5;ctx.stroke();}
  }
  else if(f.type==='melt'){
   // Frost meets fire: steam puffs and a short cold ring, no large flat wash.
   ctx.beginPath();ctx.ellipse(f.x,f.y+p*10,10+p*26,7+p*18,0,0,TAU);ctx.strokeStyle='#cdeeff';ctx.lineWidth=2*(1-p);ctx.stroke();
   for(let i=0;i<7;i++){const a=i/7*TAU,rad=6+p*24;ellipse(ctx,f.x+Math.cos(a)*rad,f.y-4-Math.sin(a)*rad*.7-p*16,6*(1-p)+1.5,6*(1-p)+1.5,i%2?'#dcf4ffcc':'#f0b98f99');}
   for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(f.x-12+i*9,f.y+4);ctx.bezierCurveTo(f.x-16+i*9,f.y-10,f.x-6+i*9,f.y-18-p*12,f.x-9+i*9,f.y-26-p*14);ctx.strokeStyle='#ffe0bc88';ctx.lineWidth=1.4;ctx.stroke();}
  }
  else if(f.type==='knock'){
   const dx=p*30;
   line(ctx,f.x-6+dx,f.y,f.x+13+dx,f.y,'#ffd2ab',3);
   ctx.beginPath();ctx.moveTo(f.x+9+dx,f.y-5);ctx.lineTo(f.x+18+dx,f.y);ctx.lineTo(f.x+9+dx,f.y+5);ctx.closePath();ctx.fillStyle='#ffd2ab';ctx.fill();
   for(let i=0;i<3;i++)line(ctx,f.x-16+i*6+dx*.5,f.y-8+i*8,f.x-8+i*6+dx*.5,f.y-8+i*8,'#ffd2ab8a',1.5);
  }
  else if(f.type==='flip'){
   // 一次方向事件：两道喙形弧线朝新的朝向扫出去。
   const s=f.text==='◀'?-1:1;
   for(let i=0;i<2;i++){
    const d=11+p*30+i*11;
    ctx.beginPath();ctx.moveTo(f.x+s*(d-9),f.y-9);ctx.lineTo(f.x+s*d,f.y);ctx.lineTo(f.x+s*(d-9),f.y+9);
    ctx.strokeStyle=f.color;ctx.lineWidth=2.4;ctx.stroke();
   }
   ctx.restore();return;
  }
  else if(f.type==='linkline'){
   line(ctx,f.ax,f.ay,f.bx,f.by,'#d9c8f8',2.8*(1-p)+.8);
   ctx.fillStyle='#f4ecff';ctx.shadowColor='#d9c8f8';ctx.shadowBlur=10;starShape(ctx,f.x,f.y,5+6*p,t*3);ctx.fill();ctx.shadowBlur=0;
  }
  else{for(let i=0;i<4;i++){const a=i/4*TAU+t;line(ctx,f.x+Math.cos(a)*5,f.y+Math.sin(a)*5,f.x+Math.cos(a)*(5+p*22),f.y+Math.sin(a)*(5+p*22),f.color,2);}}
  ctx.restore();
 }
}
