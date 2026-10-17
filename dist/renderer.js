import {FIELD} from './engine.js';
import {MODELS,CEOS,MODEL_MAP,CEO_MAP,COPY} from './data.js';
import {ANIMATED_CHARACTERS} from './animation.js';
import {makeSpriteAtlas,drawAtlasSprite} from './sprite-atlas.js';

const TAU=Math.PI*2;
function rounded(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function label(ctx,text,x,y,size=12,color='#7c8e6a',align='left'){ctx.fillStyle=color;ctx.font=`600 ${size}px "Segoe UI", "Microsoft YaHei", sans-serif`;ctx.textAlign=align;ctx.fillText(text,x,y);}
function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=fill;ctx.fill();}
function line(ctx,x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.lineWidth=1;}
export function loadImage(url){return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=url;});}
export async function loadArtwork(){
 const manifest=await fetch('assets/animations/manifest.json').then(r=>r.ok?r.json():null).catch(()=>null);
 const [models,ceos,entries]=await Promise.all([loadImage('assets/models.png'),loadImage('assets/ceos.png'),
  Promise.all(ANIMATED_CHARACTERS.map(async id=>{const image=await loadImage(`assets/animations/${id}.png`);return [id,image?makeSpriteAtlas(image,manifest?.characters[id]):null];}))]);
 const animations=Object.fromEntries(entries);
 return {models,ceos,animations,missingAnimations:ANIMATED_CHARACTERS.filter(id=>!animations[id])};
}
export class GardenRenderer{
 constructor(canvas,art){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.art=art;this.hover=null;this.selection=null;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr=Math.min(devicePixelRatio||1,2);canvas.width=FIELD.width*dpr;canvas.height=FIELD.height*dpr;this.ctx.scale(dpr,dpr);
  this.rects={};this.cropAtlas('models',3,3);this.cropAtlas('ceos',3,2);
  this.background=document.createElement('canvas');this.background.width=FIELD.width;this.background.height=FIELD.height;
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
  const ctx=this.background.getContext('2d');ctx.fillStyle='#e9eddb';ctx.fillRect(0,0,1120,650);
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
  if(drawAtlasSprite(this.ctx,this.art.animations?.[id],actor?.animation||{state:'idle',time:this.animationTime||0},x,y,size,{opacity,reduced:this.reduced}))return;
  const img=this.art[kind],rect=this.rects[kind]?.[index],ctx=this.ctx;if(!img||!rect){ellipse(ctx,x,y,20,25,kind==='models'?'#8ba3ac':'#bd957d');return;}
  const scale=Math.min(size/rect.h,size*1.05/rect.w),w=rect.w*scale,h=rect.h*scale;
  ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(img,rect.x,rect.y,rect.w,rect.h,x-w/2,y-h+bob,w,h);ctx.restore();
 }
 bar(x,y,hp,max,color='#6d965a',extra=0){
  const ctx=this.ctx,w=46;rounded(ctx,x-w/2,y,w,4,2,'#45613126');rounded(ctx,x-w/2,y,w*Math.max(0,hp/max),4,2,color);
  if(extra>0)rounded(ctx,x-w/2,y-5,Math.min(w,extra/max*w),3,2,'#a2a6bf');
 }
 draw(game,now){
  const ctx=this.ctx;ctx.clearRect(0,0,1120,650);ctx.drawImage(this.background,0,0);
  const t=this.reduced?0:game.tickTime;this.animationTime=t;
  label(ctx,COPY[game.lang].threat,1058,607,10,'#aa9b7c','center');
  // Rescue carts are graphics cards, because compute saves the day.
  for(let row=0;row<5;row++){
   const y=FIELD.y+row*96+48;
   if(game.mowers[row])this.mower(62,y,false);else{ctx.save();ctx.globalAlpha=.2;this.mower(62,y,false);ctx.restore();}
  }
  if(this.hover&&['playing','ready'].includes(game.phase)){
   const {row,col}=this.hover,x=100+col*100,y=104+row*96;const occupied=game.units.some(u=>u.row===row&&u.col===col);
   rounded(ctx,x+3,y+3,94,90,10,this.selection==='shovel'?'#deac7550':occupied?'#e5b39535':'#fffde638',this.selection==='shovel'?'#bf9265':occupied?'#bd9b72':'#eff5d1');
   if(this.selection&&this.selection!=='shovel'&&!occupied)this.sprite('models',MODEL_MAP[this.selection].index,x+50,y+78,76,0,.4);
   else if(!this.selection&&!occupied){line(ctx,x+44,y+48,x+56,y+48,'#f6f8e5a0',2);line(ctx,x+50,y+42,x+50,y+54,'#f6f8e5a0',2);}
  }
  const sprites=[...game.units.map(u=>({kind:'unit',value:u})),...game.enemies.map(e=>({kind:'enemy',value:e})),...game.departures.map(d=>({kind:'departure',value:d}))].sort((a,b)=>a.value.row-b.value.row||a.value.x-b.value.x);
  for(const {kind,value:v} of sprites){
   if(kind==='departure'){
    const fading=Math.min(1,(.85-v.departureAge)/.25);
    const unit=v.kind==='unit',index=unit?MODEL_MAP[v.model].index:CEO_MAP[v.type].index;
    this.sprite(unit?'models':'ceos',index,v.x,v.y+26,v.mini?62:85,0,Math.max(0,fading),v);continue;
   }
   ellipse(ctx,v.x,v.y+27,kind==='enemy'?25:26,7,'#4d79452d');
   if(kind==='unit'){
    const m=MODEL_MAP[v.model];
    if(v.model==='qwen'&&!v.strike){ctx.beginPath();ctx.ellipse(v.x,v.y-8,36,40,0,-Math.PI*.65,Math.PI*.65);ctx.strokeStyle='#b8d5f080';ctx.lineWidth=3;ctx.stroke();ctx.lineWidth=1;}
    if(v.strike){ctx.save();ctx.filter='grayscale(.7)';this.sprite('models',m.index,v.x,v.y+24,85,0,.75,v);ctx.restore();rounded(ctx,v.x-30,v.y-64,60,21,5,'#fff2d8','#d6b27a');label(ctx,'403',v.x,v.y-49,12,'#aa7a42','center');}
    else {ctx.save();if(v.flash>0)ctx.filter='brightness(1.12)';this.sprite('models',m.index,v.x,v.y+26,88,0,1,v);ctx.restore();}
    if(v.hp<v.maxHp)this.bar(v.x,v.y+32,v.hp,v.maxHp);
    // Production progress around the whale's Token icon.
    if(v.model==='deepseek'&&game.phase==='playing'){ctx.beginPath();ctx.arc(v.x+27,v.y-43,7,-Math.PI/2,-Math.PI/2+TAU*(1-v.produceTimer/7));ctx.strokeStyle='#eedb8a';ctx.lineWidth=2;ctx.stroke();ctx.lineWidth=1;}
   }else{
    const c=CEO_MAP[v.type];ctx.save();if(v.flash>0)ctx.filter='brightness(1.3)';this.sprite('ceos',c.index,v.x,v.y+26,v.mini?62:88,0,1,v);ctx.restore();
    if(v.slow>0){ctx.strokeStyle='#a9c6f0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(v.x,v.y+25,29,8,0,0,TAU);ctx.stroke();ctx.lineWidth=1;}
    if(v.boost>0){ctx.beginPath();ctx.moveTo(v.x+27,v.y);ctx.lineTo(v.x+56+Math.sin(t*25)*8,v.y+8);ctx.lineTo(v.x+29,v.y+16);ctx.fillStyle='#efa45b';ctx.fill();}
    if(v.shield>0){ctx.beginPath();ctx.ellipse(v.x,v.y-10,34,42,0,0,TAU);ctx.strokeStyle='#d8b68a99';ctx.lineWidth=3;ctx.stroke();ctx.lineWidth=1;}
    this.bar(v.x,v.y+32,v.hp,v.maxHp,'#ba8669',v.armor+v.shield);
   }
  }
  for(const p of game.projectiles){
   if(p.delay>0)continue;
   ctx.save();ctx.shadowColor=p.color;ctx.shadowBlur=10;
   const size=p.model==='minimax'?11:p.model==='grok'?9:p.model==='claude'?8:6;
   ellipse(ctx,p.x,p.y,size,size*.75,p.color);ellipse(ctx,p.x-3,p.y,Math.max(2,size/2),size/2,'#fff8e5');
   ctx.shadowBlur=0;line(ctx,p.x-20,p.y,p.x-8,p.y,p.color+'88',3);ctx.restore();
  }
  for(const c of game.coins){
   const y=c.y+Math.sin(t*3+c.id)*2;ellipse(ctx,c.x,y+14,12,4,'#8f8a4520');
   ctx.save();ctx.shadowColor='#ead27880';ctx.shadowBlur=12;ellipse(ctx,c.x,y,15,15,'#e3bc59');ctx.shadowBlur=0;ellipse(ctx,c.x,y-1,11,11,'#f4d481');label(ctx,'T',c.x,y+4,13,'#ac8535','center');ctx.restore();
   if(c.age>6){label(ctx,String(c.value),c.x,y-22,10,'#a88e45','center');}
  }
  for(const f of game.effects)this.effect(f,t);
  if(game.phase==='ready'){
   const x=750,y=239;ctx.save();ctx.setLineDash([5,5]);ctx.strokeStyle='#e5eccb';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(705,204,90,90,10);ctx.stroke();ctx.setLineDash([]);ctx.restore();
   label(ctx,'+',750,258,25,'#edf4d8','center');
   // A compact, non-blocking placard invites the player to use real tiles.
   rounded(ctx,421,45,280,40,20,'#f6f6e8b8','#d3ddbf');label(ctx,COPY[game.lang].gardenHint,561,70,11,'#839569','center');
  }
 }
 mower(x,y,moving){
  const ctx=this.ctx;ellipse(ctx,x,y+20,23,6,'#6d80572b');rounded(ctx,x-21,y-4,40,23,5,'#7d9464','#65814f');rounded(ctx,x-17,y,31,14,3,'#a9bd8c');
  for(const xx of [-8,7]){ellipse(ctx,x+xx,y+7,6,6,'#6a8152');ellipse(ctx,x+xx,y+7,2,2,'#a5bc85');}
  rounded(ctx,x-16,y+17,7,7,2,'#596b49');rounded(ctx,x+8,y+17,7,7,2,'#596b49');
  line(ctx,x+17,y+2,x+25,y-10,'#6b8251',3);line(ctx,x+24,y-10,x+32,y-10,'#6b8251',3);
 }
 effect(f,t){
  const ctx=this.ctx,p=f.age/f.duration;ctx.save();ctx.globalAlpha=1-p;
  if(f.type==='mower'){this.mower(60+p*1080,f.y,true);ctx.restore();return;}
  if(f.type==='token'||f.type==='heal'){label(ctx,f.text,f.x,f.y-15-p*40,16,f.color,'center');}
  else if(f.type==='blast'){ctx.beginPath();ctx.arc(f.x,f.y,15+p*62,0,TAU);ctx.fillStyle=f.color+'45';ctx.fill();ctx.strokeStyle=f.color;ctx.lineWidth=3*(1-p);ctx.stroke();for(let i=0;i<8;i++){const a=i/8*TAU;ellipse(ctx,f.x+Math.cos(a)*p*65,f.y+Math.sin(a)*p*65,4,4,f.color);}}
  else if(f.type==='plant'){ctx.beginPath();ctx.ellipse(f.x,f.y+22,8+p*35,3+p*12,0,0,TAU);ctx.strokeStyle=f.color;ctx.lineWidth=2;ctx.stroke();for(let i=0;i<5;i++){const a=i/5*TAU;ellipse(ctx,f.x+Math.cos(a)*25*p,f.y-15-Math.sin(a)*25*p,3,3,'#f4efca');}}
  else if(f.type==='poof'){for(let i=0;i<6;i++){const a=i/6*TAU;ellipse(ctx,f.x+Math.cos(a)*25*p,f.y+Math.sin(a)*25*p,8*(1-p),8*(1-p),f.color+'aa');}}
  else if(f.type==='shield'){ctx.beginPath();ctx.ellipse(f.x,f.y-10,15+p*40,18+p*45,0,0,TAU);ctx.strokeStyle=f.color;ctx.lineWidth=2;ctx.stroke();}
  else{for(let i=0;i<4;i++){const a=i/4*TAU+t;line(ctx,f.x+Math.cos(a)*5,f.y+Math.sin(a)*5,f.x+Math.cos(a)*(5+p*22),f.y+Math.sin(a)*(5+p*22),f.color,2);}}
  ctx.restore();
 }
}
