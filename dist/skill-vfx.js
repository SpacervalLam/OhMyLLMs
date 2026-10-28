// Model-specific Canvas choreography. All clocks come from the simulation;
// rendering never changes gameplay, samples random numbers or schedules timers.
import {drawPaintedProjectile} from './projectile-art.js';
import {FIELD} from './engine.js';
import {starsOf} from './ranks.js';
const TAU=Math.PI*2;
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>1-Math.pow(1-clamp(v),3);
function path(c,pts,fill,stroke,width=1){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function line(c,x,y,xx,yy,color,w=1){c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=w;c.stroke();}
function oval(c,x,y,rx,ry,color,stroke=null,w=1){c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);if(color){c.fillStyle=color;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}}
function ring(c,x,y,r,color,w=1,a=0,b=TAU){c.beginPath();c.arc(x,y,Math.max(.01,r),a,b);c.strokeStyle=color;c.lineWidth=w;c.stroke();}
function poly(c,x,y,r,n,color,fill=null,rot=0,w=1){path(c,Array.from({length:n},(_,i)=>[x+Math.cos(rot+i/n*TAU)*r,y+Math.sin(rot+i/n*TAU)*r]),fill,color,w);}
function star(c,x,y,r,color,rot=0){path(c,Array.from({length:8},(_,i)=>{const a=rot+i*TAU/8,s=i%2?r*.23:r;return [x+Math.cos(a)*s,y+Math.sin(a)*s];}),color);}
function glow(c,x,y,r,color,alpha=.6){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'#ffffff00');c.save();c.globalAlpha*=alpha;oval(c,x,y,r,r,g);c.restore();}
function motes(c,x,y,r,p,color,n=12,seed=0){for(let i=0;i<n;i++){const a=i*2.399+seed,rr=r*(.25+((i*7)%11)/15)*ease(p);star(c,x+Math.cos(a)*rr,y+Math.sin(a)*rr*.65-p*14,Math.max(.3,2.8*(1-p)),color,a);}}
function runeRing(c,x,y,r,t,color,n=12){ring(c,x,y,r,color,.8);for(let i=0;i<n;i++){const a=t+i/n*TAU,x0=x+Math.cos(a)*r,y0=y+Math.sin(a)*r;line(c,x0,y0,x+Math.cos(a)*(r+4),y+Math.sin(a)*(r+4),color,1.4);}}
function crescent(c,x,y,r,color){c.beginPath();c.arc(x,y,r,-Math.PI*.7,Math.PI*.7);c.bezierCurveTo(x-r*.15,y+r*.3,x-r*.15,y-r*.3,x+Math.cos(-Math.PI*.7)*r,y+Math.sin(-Math.PI*.7)*r);c.fillStyle=color;c.fill();}
function film(c,x,y,w,h,alpha=1){c.save();c.globalAlpha*=alpha;c.fillStyle='#182027';c.fillRect(x,y,w,h);c.fillStyle='#f9e6d5';for(let i=4;i<w-3;i+=10){c.fillRect(x+i,y+3,5,3);c.fillRect(x+i,y+h-6,5,3);}c.restore();}
function book(c,x,y,p=1){c.save();c.translate(x,y);c.scale(p,p);path(c,[[-25,-9],[-3,-4],[0,14],[-24,7]],'#f8eacb','#ad703a');path(c,[[0,-4],[23,-12],[25,6],[0,14]],'#fff5de','#ad703a');line(c,0,-4,0,14,'#c6a16b');for(let i=0;i<3;i++){line(c,-20,-4+i*4,-6,i*4,'#c9a475');line(c,5,-3+i*4,19,-8+i*4,'#c9a475');}c.restore();}

export function drawSkillGround(c,g,t,frostArt=null){
 c.save();c.beginPath();c.rect(100,104,900,480);c.clip();
 for(const z of g.zones){
  const a=clamp(z.until/.45)*ease((z.age-.4)/.22);if(a<=0||!z.landed)continue;
  const w=z.x1-z.x0,h=z.y1-z.y0;
  c.save();c.globalAlpha*=a*.52;
  if(frostArt)c.drawImage(frostArt,z.x-w*.64,z.y-h*.64,w*1.28,h*1.28);
  else oval(c,z.x,z.y,w/2,h/2,'#97c9df','#d9f3ff',1);
  c.restore();
 }
 for(const u of g.units){
  if(u.model!=='qwen'||u.strike||starsOf(u)===1)continue;
  // The quiet lattice marks the actual one-tile shelter, including diagonals.
  c.save();c.globalAlpha=.16;const x=u.x-144,y=u.y-139;
  c.strokeStyle='#729ed1';c.lineWidth=1;c.setLineDash([5,9]);c.strokeRect(x,y,288,278);c.setLineDash([]);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)star(c,x+i*96,y+j*92.7,2,'#4d7dab');
  c.restore();
 }
 c.restore();
}

export function drawSkillAura(c,u,t){
 if(starsOf(u)===1)return;
 c.save();const x=u.x,y=u.y-10;
 if(u.model==='qwen'&&!u.strike){
  const breath=.7+Math.sin(t*1.8)*.12;
  c.globalAlpha=breath;c.save();c.translate(x+28,y);c.scale(.48,1);
  const fill=c.createLinearGradient(-30,0,40,0);fill.addColorStop(0,'#92d3ed05');fill.addColorStop(1,'#c6edf158');
  oval(c,0,0,43,48,fill,'#9bc5e3',1.5);oval(c,0,0,48,53,null,'#ddc88d99',1);
  c.beginPath();c.ellipse(0,0,43,48,0,0,TAU);c.clip();
  for(let r=-2;r<=2;r++)for(let col=-2;col<=2;col++)poly(c,col*23+(r%2)*11.5,r*20,13,6,'#8fb7d37a',null,Math.PI/6,.7);
  c.restore();for(const side of [-1,1]){star(c,x+side*32,y+33,4,'#d4bc74',Math.PI/4);line(c,x+side*32,y+21,x+side*32,y+40,'#b8a471');}
  if(u.flash>0){glow(c,x+39,y,37,'#d9f7ff',.55);ring(c,x+38,y,13+(1-u.flash/.18)*20,'#f8f0c6',2);}
 }else if(u.model==='deepseek'){
  const p=1-clamp(u.produceTimer/7);oval(c,x,y+32,29,6,null,'#84c9e471');c.beginPath();c.ellipse(x,y+32,29,6,0,-Math.PI/2,-Math.PI/2+p*TAU);c.strokeStyle='#6baed2';c.lineWidth=2;c.stroke();
 }else if(u.model==='kimi'){
  c.globalAlpha=.5;for(let i=0;i<3;i++){const a=t*.35+i*TAU/3;star(c,x+Math.cos(a)*31,y-18+Math.sin(a)*12,2,'#f2edff',a);}
 }
 c.restore();
}

export function drawSkillProjectile(c,p,t,projectileArt=null){
 c.save();c.translate(p.x,p.y);
 if(p.hostile){
  // Capital's return fire uses readable physical props, not recoloured LLM orbs.
  if(p.kind==='parcel'){
   for(let i=1;i<=3;i++)oval(c,i*10,Math.sin(i*.9+p.age*7)*3,4,3,'#b9855a33');
   c.rotate(Math.sin((p.age||0)*8)*.4);
   c.fillStyle='#c98f55';c.fillRect(-9,-8,18,16);c.strokeStyle='#7c5736';c.lineWidth=1.2;c.strokeRect(-9,-8,18,16);
   c.fillStyle='#e8d5a7';c.fillRect(-2,-8,4,16);c.strokeStyle='#8d6238';c.beginPath();c.moveTo(-9,0);c.lineTo(9,0);c.stroke();
   star(c,7,-9,3,'#f0d9a2');
  }else if(p.kind==='bell'){
   glow(c,0,0,20,'#f0cf85',.5);
   for(let i=0;i<2;i++)ring(c,-i*9,0,10+i*5,'#e4bf74aa',1.2-i*.3,Math.PI*.15,Math.PI*.85);
   path(c,[[-6,6],[-4,-3],[-1,-6],[1,-6],[4,-3],[6,6]],'#e3bd6b','#8f6c33',1.2);
   oval(c,0,7,4,1.6,'#8f6c33');line(c,0,-10,0,-6,'#f5dfa7',1.4);
   star(c,0,0,2.2,'#fff4cf');
  }else if(p.kind==='ray'){
   line(c,-28,0,0,0,'#e06a6355',6);line(c,-24,0,2,0,'#f0a08a',2.4);line(c,-18,0,4,0,'#fff2d8',1);
   glow(c,2,0,15,'#e06a63',.5);star(c,2,0,4,'#ffe0c0');
  }else if(p.kind==='militaryClause'){
   c.rotate(.15);c.fillStyle='#e9d9bc';c.fillRect(-10,-7,20,14);c.strokeStyle='#9d674b';c.lineWidth=1.5;c.strokeRect(-10,-7,20,14);
   line(c,-5,-2,5,-2,'#9d674b');line(c,-5,2,2,2,'#b88962');
  }else if(p.kind==='prospectus'){
   c.rotate((p.age||0)*3.2);
   c.fillStyle='#f7ecd2';c.fillRect(-9,-12,18,24);c.strokeStyle='#b08a46';c.lineWidth=1;c.strokeRect(-9,-12,18,24);
   for(let i=0;i<4;i++)line(c,-5,-7+i*5,5,-7+i*5,'#b9a37d',.8);
   c.fillStyle='#c9a45e';c.fillRect(-9,-12,18,4);
  }
  c.restore();return;
 }
 if(p.deathrattle){
  // The deathrattle sweeps this lane and its immediate neighbors, clipped at board edges.
  line(c,0,FIELD.y+Math.max(0,p.row-1)*FIELD.ch-p.y,0,FIELD.y+Math.min(FIELD.rows,p.row+2)*FIELD.ch-p.y,'#e4b58f55',8);
  c.scale(4,4);
 }
 // MiniMax's return leg needs its own pass before the painted prop is drawn:
 // the clapperboard is mirrored so it faces the way the strip is travelling, and
 // the reel marks ride on top. Everything else keeps the shared painted path.
 if(p.model==='minimax'&&p.dir<0){
  c.save();c.scale(-1,1);c.globalAlpha*=.42;drawPaintedProjectile(c,p,projectileArt);c.restore();
  // On the way back the prop is only a ghost of the shot that already happened;
  // the reel is the real thing, lit cold so the two legs never read alike.
  glow(c,0,0,28,'#bfe3f0',.4);
  oval(c,0,0,17,17,'#1d2731','#d6f0fa',2);
  for(let i=0;i<6;i++){const a=-p.age*10+i*TAU/6;oval(c,Math.cos(a)*11,Math.sin(a)*11,2,2,'#dff4ff');}
  oval(c,0,0,4.5,4.5,'#a9cfdd');
  for(let i=0;i<2;i++)path(c,[[-24-i*9,-8],[-14-i*9,0],[-24-i*9,8]],i?'#bfe3f0':'#eaf9ff');
  c.restore();return;
 }
 if(drawPaintedProjectile(c,p,projectileArt)){c.restore();return;}
 if(p.basic){
  // Small colored marks identify basic attacks without borrowing skill VFX.
  line(c,-11,0,-4,0,p.color,1.5);
  const shape=p.model==='glm'?4:p.model==='chatgpt'?3:p.model==='kimi'?0:p.model==='gemini'?6:2;
  if(shape===0)oval(c,0,0,4,4,p.color);
  else if(shape===2)oval(c,0,0,6,3,p.color);
  else poly(c,0,0,5,shape,p.color,p.color,t);
  c.restore();return;
 }
 if(p.model==='gemini'){
  const cyan=p.id%2===0,col=cyan?'#83e7f6':'#d9a6f1';
  glow(c,0,0,22,col,.55);
  for(let i=0;i<3;i++){c.beginPath();c.moveTo(-53,-5+i*5);c.quadraticCurveTo(-25,Math.sin(t*9+i)*9,0,0);c.strokeStyle=i===1?'#fff9ed':col;c.lineWidth=i===1?1.2:2.3;c.stroke();}
  star(c,0,0,12,col,t*2);star(c,0,0,6,'#fffefa',-t);ring(c,0,0,15,col,.8,-t,-t+Math.PI*1.3);
 }else if(p.model==='grok'){
  // A forged axe head and soot trail, rather than another colored orb.
  for(let i=0;i<8;i++){const q=i/8;path(c,[[-8-i*6,-7*(1-q)],[-16-i*6,Math.sin(i*8+p.id)*8*(1-q)],[-8-i*6,8*(1-q)]],i%2?'#e6a14377':'#45333d88');}
  // Spin around the axe's center; the smoke stays aligned with its flight path.
  c.rotate(p.age*Math.PI*6);line(c,-13,13,10,-10,'#3a2731',5);line(c,-12,12,10,-10,'#ca9b57',1.2);
  path(c,[[0,-15],[11,-16],[22,-4],[10,8],[4,5],[9,-4]],'#322838','#e6b26f',1.4);path(c,[[11,-15],[21,-4],[11,6],[15,-4]],'#ffe3a3');
  star(c,0,0,4,'#ffdeaa');
 }else if(p.model==='minimax'){
  // Fallback when the painted clapperboard is unavailable: the same strip, drawn
  // by hand. The outbound leg is the only one that reaches here — the rewind is
  // handled above so it can ride on top of the painted prop.
  for(let i=4;i>0;i--)film(c,-i*12,-6+i%2,12,12,.12*(5-i));
  c.rotate(Math.sin(p.age*6)*.12);film(c,-15,-10,30,21);
  c.fillStyle='#e6b3be';c.fillRect(-11,-4,22,8);c.save();c.translate(-15,-10);c.rotate(-.25-Math.sin(p.age*15)*.1);c.fillStyle='#f4e7d4';c.fillRect(0,-6,30,6);for(let i=0;i<4;i++)path(c,[[i*8,-6],[i*8+4,-6],[i*8+8,0],[i*8+4,0]],'#33313a');c.restore();
 }else if(p.model==='doubao'){
  if(p.replay){
   // The same bubble, now inside a rendered clip: sprocket holes and a play mark.
   c.strokeStyle='#a8c7f1';c.lineWidth=1.4;c.strokeRect(-17,-12,34,24);
   c.fillStyle='#a8c7f1';for(let i=0;i<4;i++){c.fillRect(-14+i*8,-10,3,2);c.fillRect(-14+i*8,8,3,2);}
  }
  glow(c,0,0,20,'#a8c7f1',.4);c.beginPath();c.roundRect(-12,-9,24,18,7);c.fillStyle='#9b88d9';c.fill();c.strokeStyle='#e6f2ff';c.lineWidth=1.4;c.stroke();path(c,[[-5,8],[-8,15],[2,8]],'#9b88d9');
  for(let i=-1;i<=1;i++)oval(c,i*5,0,1.5,1.5,'#fff9ec');
  if(p.replay)path(c,[[-3,-5],[6,0],[-3,5]],'#fff9ec');
 }else if(p.model==='mimo'){
  for(let i=0;i<3;i++)path(c,[[-25-i*10,-6],[-13-i*10,0],[-25-i*10,6]],null,'#f2b97e88',1.2);
  path(c,[[18,0],[-6,-10],[-1,0],[-6,10]],'#ffe7bc','#d67c35',1.5);line(c,-20,0,10,0,'#fff6d8',2);
 }else{star(c,0,0,7,p.color,t);}
 c.restore();
}

export function drawSkillChannels(c,g,t){
 for(const z of g.zones){
  if(z.age>.4)continue;const p=clamp(z.age/.4),y=z.y-125+125*p*p;
  c.save();c.globalAlpha=clamp(p*4);
  // The warning follows the falling stone rather than a board tile.
  oval(c,z.x,z.y,(z.x1-z.x0)/2,(z.y1-z.y0)/2,null,'#dff4ff88',1);
  oval(c,z.x,z.y+13,26*(.3+p),9*(.3+p),null,'#cfeaf8',2);
  line(c,z.x,y-45,z.x,y,'#e8f8ffaa',2);line(c,z.x-5,y-20,z.x-5,y,'#7fa8c055');
  const fill=c.createRadialGradient(z.x-4,y-4,1,z.x,y,14);fill.addColorStop(0,'#ffffff');fill.addColorStop(.8,'#cfe3ef');fill.addColorStop(1,'#5f7d92');oval(c,z.x,y,14,10,fill,'#3f5a6b',1);
  // Rime clinging to the stone on the way down.
  for(let i=0;i<5;i++)star(c,z.x-9+i*5,y-8+((i*7)%12),2,'#ffffffdd',p*3);
  c.restore();
 }
 for(const s of g.sweeps){
  const delay=s.writ??.65,progress=clamp(s.age/delay),after=Math.max(0,s.age-delay);
  for(const mark of s.marks){
   c.save();c.translate(mark.x,mark.y-17);c.globalAlpha=s.age<delay?clamp(progress*4):clamp(1-after/.55);
   // Each target gets its own upright parchment, never a lane-length ribbon.
   c.save();c.rotate(-.12);const h=46*ease(progress);c.fillStyle='#fff0d6e6';c.strokeStyle='#b78a57';c.lineWidth=1.3;c.fillRect(-19,-h/2,38,h);c.strokeRect(-19,-h/2,38,h);
   if(progress>.35){for(let i=0;i<4;i++)line(c,-13,-14+i*8,8-i%2*6,-14+i*8,'#b4936d',1);}
   c.restore();
   const fall=(1-progress)**2*60;c.save();c.translate(5,-fall);c.rotate(-.15);
   c.strokeStyle=s.stars===3?'#a34d31':'#b77545';c.lineWidth=s.stars===3?3:2;
   c.strokeRect(-14,-14,28,28);if(s.stars===3)c.strokeRect(-18,-18,36,36);
   c.fillStyle='#a34d31';c.font='bold 24px Georgia';c.textAlign='center';c.fillText('§',0,8);c.restore();
   if(after>0)for(let i=0;i<6;i++){c.save();const angle=i*2.4;c.translate(Math.cos(angle)*after*70,Math.sin(angle)*after*50);c.rotate(angle+after*3);c.fillStyle=i%2?'#f7d99c':'#fff1d6';c.fillRect(-3,-5,6,10);c.restore();}
   c.restore();
  }
 }
 for(const u of g.units){
  if(!u.beam)continue;const b=u.beam,x=u.x+30,y=u.y-14,end=FIELD.width,full=starsOf(u)===3;c.save();
  const charge=clamp(1-b.charge/.45),a=b.charge>0?charge:clamp(b.fire/.24);c.globalAlpha=a;
  if(!full){
   glow(c,x,y,23,'#a4eedc',.5);
   c.save();c.translate(x,y);c.scale(.4,1);ring(c,0,0,15,'#a4eedc',2);c.restore();
   if(b.charge>0){line(c,x,y,end,y,'#a4eedc55',.8);ring(c,x,y,7+charge*9,'#d5fff4',1.5);}
   else{line(c,x,y,end,y,'#82dfc933',10);line(c,x,y,end,y,'#a4eedcbb',4);line(c,x,y,end,y,'#f0fff9',1.5);
    for(let i=0;i<7;i++){const xx=x+((t*230+i*83)%(end-x));line(c,xx,y-4,Math.min(end,xx+16),y-4,'#d5fff4aa',1);}
    for(const e of g.enemies.filter(e=>e.hp>0&&e.row===u.row&&e.x>u.x-20))ring(c,e.x,y,8,'#b5f5df',1.5);
   }
   c.restore();continue;
  }
  glow(c,x,y,40,'#c3b2f4',.6);
  // Three offset aperture rings establish the beam's depth and direction.
  for(let i=0;i<3;i++){c.save();c.translate(x+i*22,y);c.scale(.35,1);runeRing(c,0,0,20+i*5,t*(i%2?-1:1),'#aa83d0',10);poly(c,0,0,14+i*3,6,'#a57acb',null,t*.3,1.3);c.restore();}
  if(b.charge>0){line(c,x,y,end,y,'#e4d5ff66',.8);for(let i=0;i<8;i++){const an=i/8*TAU-t*2,r=(1-charge)*40+7;star(c,x+Math.cos(an)*r,y+Math.sin(an)*r,2,'#f4ecff');}}
  else{
   const width=10+Math.sin(t*23)*1.5,beam=c.createLinearGradient(x,0,end,0);beam.addColorStop(0,'#f0deff00');beam.addColorStop(.04,'#c4a3e4b0');beam.addColorStop(.65,'#ddc9f280');beam.addColorStop(1,'#b4e4ee00');
   c.fillStyle=beam;c.beginPath();c.moveTo(x,y-4);c.lineTo(end,y-width);c.lineTo(end,y+width);c.lineTo(x,y+4);c.fill();
   line(c,x,y,end,y,'#dfc7ff88',17);line(c,x,y,end,y,'#efe3ffbb',6);line(c,x,y,end,y,'#fffdf7',1.5);
   for(let k=0;k<2;k++){c.beginPath();for(let i=0;i<=32;i++){const xx=x+(end-x)*i/32,yy=y+Math.sin(i*.6-t*8+k*Math.PI)*6;i?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.strokeStyle=k?'#81e0edaa':'#c6a4ecaa';c.lineWidth=1.1;c.stroke();}
   for(const e of g.enemies.filter(e=>e.hp>0&&e.row===u.row&&e.x>u.x-20)){glow(c,e.x,y,23,'#e8ceff',.6);star(c,e.x,y,11,'#fff3dc',t*.3);}
  }c.restore();
 }
}

export function drawSkillEffect(c,f,t){
 if(f.type==='chatBounce'||f.type==='networkLink'){
  c.save();const p=clamp(f.age/f.duration);c.globalAlpha=1-p;c.strokeStyle=f.type==='chatBounce'?'#a08dde':'#69c6d5';c.lineWidth=2.5;
  c.beginPath();c.moveTo(f.x,f.y);c.quadraticCurveTo((f.x+f.tx)/2,Math.min(f.y,f.ty)-30,f.tx,f.ty);c.stroke();c.restore();return true;
 }
 if(f.type!=='skillCast'&&f.type!=='skillImpact'&&f.type!=='skillGuard'&&f.type!=='linkline'&&f.type!=='link'&&f.type!=='rewindHit'&&f.type!=='rewindTurn')return false;
 c.save();const p=clamp(f.age/f.duration),fade=Math.min(1,(1-p)*3),x=f.x,y=f.y;c.globalAlpha=fade;
 if(f.type==='link'){
  const mx=(x+f.tx)/2,my=Math.min(y,f.ty)-54;
  for(let i=0;i<2;i++){c.beginPath();c.moveTo(x,y);c.bezierCurveTo(mx-30,my+i*6,mx+30,my-i*6,f.tx,f.ty);c.strokeStyle=i?'#d4c7edaa':'#b7e5ddaa';c.lineWidth=i?1:2;c.stroke();}
  for(let i=0;i<3;i++){const q=clamp(p*1.5-i*.15),xx=(1-q)**2*x+2*(1-q)*q*mx+q*q*f.tx,yy=(1-q)**2*y+2*(1-q)*q*my+q*q*f.ty;star(c,xx,yy,4-i,'#fff9e6',Math.PI/4);}
  if(p>.4){const q=(p-.4)/.6;ring(c,f.tx,f.ty,9+q*25,'#d8eee7',1);c.fillStyle='#e7fff4';c.fillRect(f.tx-2,f.ty-8,4,16);c.fillRect(f.tx-8,f.ty-2,16,4);}
 }else if(f.type==='linkline'){
  line(c,f.ax,f.ay,f.bx,f.by,'#c9a1e955',9);line(c,f.ax,f.ay,f.bx,f.by,'#f5e7ff',1.5);
  const length=Math.hypot(f.bx-f.ax,f.by-f.ay),n=Math.min(14,Math.max(2,Math.round(length/35)));
  for(let i=0;i<=n;i++){const q=i/n;star(c,f.ax+(f.bx-f.ax)*q,f.ay+(f.by-f.ay)*q,3+(i%3),i%2?'#87e6ef':'#e5b9ec',t);}
 }else if(f.type==='skillGuard'){
  c.save();c.translate(x+28,y);c.scale(.55,1);poly(c,0,0,30+ease(p)*20,6,'#e7cd8a',null,Math.PI/6,2);poly(c,0,0,23+ease(p)*14,6,'#b4e5f4',null,Math.PI/6,1);c.restore();motes(c,x+30,y,40,p,'#cfeaf0',8);
 }else if(f.model==='doubao'||f.model==='mimo'){
  const color=f.model==='doubao'?'#9b9ce2':'#eb934c';ring(c,x,y,8+ease(p)*25,color,2);motes(c,x,y,38,p,color,8);
  if(f.model==='doubao'){c.beginPath();c.roundRect(x-11,y-8,22,16,5);c.strokeStyle=color;c.lineWidth=2;c.stroke();}
  else for(let i=0;i<3;i++)poly(c,x+ease(p)*i*12,y,5+i*2,4,color,null,Math.PI/4,1.5);
 }else if(f.model==='deepseek'){
  c.save();c.translate(x,y+21);c.scale(1,.35);for(let i=0;i<3;i++)ring(c,0,0,15+ease(clamp(p*1.4-i*.15))*48,['#7cc9e7','#d9f5ff','#6ba8ce'][i],2-i*.4);c.restore();
  // A small whale silhouette breaches above the water and turns into gold.
  c.save();c.translate(x+Math.sin(p*Math.PI)*18,y-15-Math.sin(p*Math.PI)*33);c.rotate(-.2+Math.sin(p*Math.PI)*.4);c.globalAlpha*=Math.sin(Math.PI*p);
  c.beginPath();c.moveTo(-22,1);c.bezierCurveTo(-20,-22,14,-26,23,-4);c.bezierCurveTo(25,5,12,15,-7,12);c.lineTo(-23,19);c.lineTo(-22,9);c.lineTo(-34,10);c.closePath();const sea=c.createLinearGradient(0,-20,0,17);sea.addColorStop(0,'#91dbed');sea.addColorStop(1,'#4c88b6');c.fillStyle=sea;c.fill();c.strokeStyle='#447eaa';c.lineWidth=.8;c.stroke();oval(c,3,3,12,6,'#dbf4f5');path(c,[[-2,4],[2,17],[9,6]],'#589cc3');line(c,11,3,20,0,'#43769a',.8);oval(c,14,-5,1.5,1.5,'#244f73');oval(c,14.4,-5.7,.5,.5,'#ffffff');line(c,-7,-17,-4,-18,'#d9f4fb',2);c.restore();
  for(let i=0;i<9;i++){const a=i*.9;oval(c,x+Math.sin(a)*42*ease(p),y-10-Math.sin(p*Math.PI)*35+Math.cos(a)*16,1.8,3,'#bce6f4');}motes(c,x,y,55,p,'#f4d98e',9);
 }else if(f.model==='kimi'){
  const r=24+ease(p)*22;glow(c,x,y,52,'#e5dcfa',.35);runeRing(c,x,y,r,t*.15,'#d5c9e599',16);crescent(c,x,y-20,r*.48,'#f7f3da');
  for(let i=0;i<4;i++){const a=i*TAU/4+p*.25,xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r*.55;c.save();c.translate(xx,yy);c.rotate(a*.1);path(c,[[-7,-9],[7,-9],[7,9],[-7,9]],'#f8f3e4dd','#c0b1d4');for(let j=0;j<3;j++)line(c,-4,-4+j*4,4,-4+j*4,'#b5a7cc',.6);c.restore();}motes(c,x,y,50,p,'#ddf7e8',8);
 }else if(f.model==='claude'){
  if(f.type==='skillCast'){book(c,x+16,y-4,.8+Math.sin(p*Math.PI)*.25);for(let i=0;i<5;i++){c.save();c.translate(x+20+ease(p)*i*14,y-8-Math.sin(p*Math.PI)*i*8);c.rotate(-.2+p*.4);c.globalAlpha*=1-p;path(c,[[-6,-10],[7,-10],[7,9],[-6,9]],'#fff0d3','#c9a577');line(c,-3,-5,4,-5,'#b59770');c.restore();}}
  else {c.save();c.translate(x,y);c.rotate(-.17);c.strokeStyle='#c27743';c.lineWidth=2;c.strokeRect(-18*ease(p),-18*ease(p),36*ease(p),36*ease(p));c.fillStyle='#a65535';c.font='bold 27px Georgia';c.textAlign='center';c.fillText('§',0,9);c.restore();motes(c,x,y,44,p,'#d9ab6a',9);}
 }else if(f.model==='gemini'){
  glow(c,x,y,36,'#c4caf6',.45);for(let i=0;i<2;i++){const a=p*2+i*Math.PI,xx=x+Math.cos(a)*25*ease(p),yy=y+Math.sin(a)*16*ease(p);star(c,xx,yy,12*(1-p*.5),i?'#eeb9ec':'#a4e5f2',a);ring(c,xx,yy,15+ease(p)*15,i?'#d8a0db77':'#7cd3e777',1);}motes(c,x,y,62,p,'#ecdcfa',12);
 }else if(f.model==='glm'){
  if(f.type==='skillCast'){
   // A seed crystal forms in the caster's hands; the stone itself belongs to the drop.
   c.save();c.translate(x,y-6);c.rotate(p*1.1);
   path(c,[[0,-13],[4,-4],[13,0],[4,4],[0,13],[-4,4],[-13,0],[-4,-4]],'#eaf9ffee','#a9d8ef',1);
   for(let i=0;i<4;i++){const an=i/4*TAU+p*.6;line(c,0,0,Math.cos(an)*(16+ease(p)*14),Math.sin(an)*(16+ease(p)*14),'#cbe9f9cc',1.2);}
   c.restore();motes(c,x,y,26,p,'#dff4ff',6);
  }
  else {
   // Impact: frost shards kicked out along the two tiles. No wash and no ring — the
   // tiles themselves already change colour, and anything on top reads as a flash.
   const rw=ease(p)*92,rh=ease(p)*40;
   for(let i=0;i<6;i++){const a=i/6*TAU,xx=x+Math.cos(a)*rw*.82,yy=y+10+Math.sin(a)*rh*.82;path(c,[[xx-4,yy+3],[xx,yy-7],[xx+4,yy+3]],i%2?'#f2fdff8c':'#bfe4f57a');}
   motes(c,x,y,40,p,'#e6f7ff',6);
  }
 }else if(f.model==='grok'){
  if(f.type==='skillCast'){c.save();c.translate(x+14,y);c.rotate(-.7+p*1.4);c.beginPath();c.arc(0,0,30,-1.2,1.1);c.strokeStyle='#cf985b';c.lineWidth=5*(1-p)+1;c.stroke();c.beginPath();c.arc(0,0,35,-1,.8);c.strokeStyle='#45303f88';c.lineWidth=8;c.stroke();c.restore();}
  else {const r=ease(p)*78;glow(c,x,y,65,'#eca76b',.6*(1-p));for(let i=0;i<9;i++){const a=i*2.399;path(c,[[x+Math.cos(a)*r*.2,y+Math.sin(a)*r*.15],[x+Math.cos(a+.11)*r,y+Math.sin(a+.11)*r*.7],[x+Math.cos(a-.1)*r*.7,y+Math.sin(a-.1)*r*.5]],i%2?'#eab276':'#3d2e3c');}line(c,x-r*.7,y+r*.4,x+r*.7,y-r*.4,'#fff0c9',3*(1-p));line(c,x-r*.5,y-r*.6,x+r*.5,y+r*.6,'#e8a565',2);}
 }else if(f.model==='minimax'){
  if(f.type==='skillCast'){film(c,x-23,y-16,46,31);c.fillStyle='#e5adbf';c.fillRect(x-17,y-7,34,13);star(c,x+29,y-18,7,'#fff0dc');}
  else if(f.type==='rewindHit'){
   // A strip passing over a CEO: no blast, no viewfinder — just the frame it was
   // caught in and the sprockets dragging it the way the reel is turning.
   const back=f.leg==='back',wide=22+ease(p)*30,dir=back?-1:1;
   c.strokeStyle=back?'#bfe3f0':'#f0d6b8';c.lineWidth=1.4;c.strokeRect(x-wide,y-13,wide*2,26);
   c.fillStyle=back?'#a9dcec14':'#f8e9d514';c.fillRect(x-wide,y-13,wide*2,26);
   for(let i=-2;i<=2;i++){
    const hx=x+i*wide*.4+dir*ease(p)*8;
    c.fillStyle=back?'#dff6ff88':'#fbe8cf88';c.fillRect(hx-3,y-17,6,3);c.fillRect(hx-3,y+14,6,3);
   }
   for(let i=0;i<(back?2:1);i++)path(c,[[x-6-i*10,y-7],[x+4-i*10,y],[x-6-i*10,y+7]],back?'#e8fbff':'#fff3de');
   star(c,x,y,4,'#fff6e2',t);
  }else if(f.type==='rewindTurn'){
   // At the right edge the strip meets the spool and reverses.
   ring(c,x,y,16+ease(p)*26,'#e8c9d4cc',1.8,-p*7,-p*7+Math.PI*1.5);
   for(let i=0;i<2;i++)path(c,[[x-2-i*10,y-9],[x+9-i*10,y],[x-2-i*10,y+9]],i?'#f0cddb':'#fff2e2');
   for(let i=0;i<3;i++)film(c,x-16+i*14,y-6+Math.sin(p*6+i)*5,12,12,.55*(1-p));
  }
 }else if(f.model==='qwen'&&f.melee){
  c.save();c.translate(x,y);c.rotate(-.6+p*1.2);c.strokeStyle=f.stars===3?'#ffe3a0':'#b0d9ed';c.lineWidth=f.stars===3?5:3;
  c.beginPath();c.arc(0,0,12+ease(p)*18,-1.1,1.1);c.stroke();
  line(c,-7,-7,7,7,'#fff6db',2);line(c,-7,7,7,-7,'#fff6db',2);c.restore();
 }else if(f.model==='qwen'){
  c.save();c.translate(x,y+20);c.scale(1,.5);runeRing(c,0,0,20+ease(p)*50,-t*.1,'#d3b878',12);poly(c,0,0,20+ease(p)*45,6,'#b1dceb',null,Math.PI/6,1.2);c.restore();motes(c,x,y,55,p,'#b0d9ed',12);
 }else{c.restore();return false;}
 c.restore();return true;
}

export function drawCinematicFreeze(c,e,t){
 if(!(e.stun>0))return;c.save();const x=e.x,y=e.y-10;
 // Director's freeze uses a viewfinder and frame perforations, never ice.
 c.strokeStyle='#f0d7c4';c.lineWidth=1.6;
 for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const xx=x+sx*29,yy=y+sy*38;line(c,xx,yy,xx-sx*9,yy,'#f0d7c4',1.6);line(c,xx,yy,xx,yy-sy*9,'#f0d7c4',1.6);}
 c.fillStyle='#f5d5d9';c.fillRect(x-5,y-5,3,12);c.fillRect(x+2,y-5,3,12);c.restore();
}

// Only living three-star owners display equipment on their tile.
export function drawHarnesses(c,g,t){
 for(const h of g.harnesses||[]){
  const x=100+h.col*100,y=104+h.row*96,active=h.stars===3&&g.units.some(u=>u.id===h.unitId&&u.hp>0&&starsOf(u)===3);
  if(!active)continue;
  c.save();c.globalAlpha=active?.65:.25;
  c.fillStyle=h.color+'20';c.fillRect(x+3,y+3,94,90);
  c.strokeStyle=h.color;c.lineWidth=h.stars===3?2:1;
  for(const [xx,yy,dx,dy]of [[x+5,y+5,1,1],[x+95,y+5,-1,1],[x+5,y+91,1,-1],[x+95,y+91,-1,-1]]){c.beginPath();c.moveTo(xx+dx*12,yy);c.lineTo(xx,yy);c.lineTo(xx,yy+dy*12);c.stroke();}
  c.globalAlpha=active?.9:.4;c.fillStyle='#243b43cc';c.beginPath();c.roundRect(x+7,y+85,86,10,3);c.fill();c.font='600 8px monospace';c.textAlign='center';c.fillStyle=h.color;c.fillText(h.name,x+50,y+93);
  if(active&&h.model==='deepseek'){c.font='10px monospace';c.textAlign='left';c.fillText('>_',x+8,y+17);if(Math.floor(t*2)%2)c.fillRect(x+22,y+16,5,1);}
  c.restore();
 }
}
// Rank is read from the ground: plain, silver, then a gold double rune base.
// Draw before the sprite so the back of each ellipse stays behind the feet.
export function drawRankBase(c,u,t=0){
 const stars=starsOf(u),copies=u.copies??(stars===3?7:stars===2?3:1),need=stars===1?2:4,progress=Math.max(0,copies-(stars===1?1:3));
 const x=u.x,y=u.y+24;c.save();
 if(stars===1){oval(c,x,y,24,6,'#59794c19','#7c986a88',1);}
 else if(stars===2){
  oval(c,x,y,31,9,'#a4d5ea24','#6696b5',1.8);
  oval(c,x,y,25,6,null,'#d9edf0c9',1);
  for(const side of [-1,1])path(c,[[x+side*34,y],[x+side*30,y-3],[x+side*26,y],[x+side*30,y+3]],'#c5e1ed','#7299ac',.8);
 }else{
  const breath=.8+Math.sin(t*1.8)*.12;c.globalAlpha=breath;
  oval(c,x,y,36,11,'#e9c87529','#ab843e',2);
  oval(c,x,y,29,7,null,'#ffe3a2',1.6);
  for(let i=0;i<8;i++){const a=i/8*TAU;line(c,x+Math.cos(a)*30,y+Math.sin(a)*8,x+Math.cos(a)*36,y+Math.sin(a)*11,'#ffe2a1',1.6);}
  for(const side of [-1,1])path(c,[[x+side*40,y],[x+side*35,y-4],[x+side*30,y],[x+side*35,y+4]],'#e7c575','#a07c3a',1);
 }
 if(stars<3){for(let i=0;i<need;i++)oval(c,x+(i-(need-1)/2)*7,y+7,1.7,1.7,i<progress?'#f9df8a':'#57704b66',i<progress?'#9b8245':null,.6);}
 c.restore();
}
export function drawUpgrade(c,f){
 if(!['rankUp','merge','codexStop'].includes(f.type))return false;
 const p=clamp(f.age/f.duration);c.save();c.globalAlpha=1-p;
 if(f.type==='codexStop'){
  const r=30+ease(p)*140;ring(c,f.x,f.y,r,'#a4eedc',2);
  for(let i=0;i<12;i++){const a=i*TAU/12;line(c,f.x+Math.cos(a)*(r-7),f.y+Math.sin(a)*(r-7),f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,'#a4eedc',i%3===0?3:1);}
  line(c,f.x,f.y,f.x,f.y-22,'#d2fff1',2);line(c,f.x,f.y,f.x+18,f.y,'#d2fff1',2);
  c.font='bold 11px monospace';c.textAlign='center';c.fillStyle='#e4fff3';c.fillText('CODEX · TIME STOP',f.x,f.y+45);
 }else{
  const r=10+ease(p)*50;oval(c,f.x,f.y+24,r,r*.3,null,f.color,2);
  motes(c,f.x,f.y+20,48,p,f.color,f.type==='rankUp'?18:7);
  if(f.type==='rankUp'){
   c.save();c.translate(f.x,f.y+24);c.scale(1,.3);
   runeRing(c,0,0,20+ease(p)*38,p*.3,'#ffe2a1',Number(f.text)===3?16:8);
   if(Number(f.text)===3)ring(c,0,0,13+ease(p)*35,'#ddb75b',1.8);
   c.restore();
  }
 }
 c.restore();return true;
}
export function drawTimeStop(c,g){
 if(!(g.timeStop>0))return;
 c.save();c.strokeStyle='#a4eedc';c.lineWidth=3;c.strokeRect(103,107,894,474);
 // Tint the lawn slightly; never use Canvas filters or a full-screen flash.
 c.fillStyle='#486e7818';c.fillRect(100,104,900,480);
 for(const e of g.enemies){c.strokeStyle='#b7ffebaa';c.lineWidth=1;c.strokeRect(e.x-28,e.y-43,56,69);}
 c.restore();
}
