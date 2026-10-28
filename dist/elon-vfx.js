import {ELON_KIT,elonDamageScale,basicIntervalScale} from './elon-boss.js';
import {ELON_SKILLS} from './elon-data.js';

const TAU=Math.PI*2;
const words=(g,zh,en,ja)=>g.lang==='zh'?zh:g.lang==='ja'?ja:en;
function line(c,x,y,tx,ty,color,width=1){c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function ring(c,x,y,r,color,width=1.5){c.beginPath();c.arc(x,y,r,0,TAU);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function badge(c,x,y,text,color='#254858',width=112){
 x=Math.max(100+width/2,Math.min(1108-width/2,x));y=Math.max(109,y);
 c.beginPath();c.roundRect(x-width/2,y,width,19,5);c.fillStyle=color;c.fill();c.fillStyle='#f1faf5';c.textAlign='center';c.font='600 10px "Segoe UI", "Microsoft YaHei", sans-serif';c.fillText(text,x,y+13,width-8);
}
function arrow(c,x,y,tx,ty,color){
 line(c,x,y,tx,ty,color,1.8);const a=Math.atan2(ty-y,tx-x);line(c,tx,ty,tx-Math.cos(a-.5)*9,ty-Math.sin(a-.5)*9,color,1.8);line(c,tx,ty,tx-Math.cos(a+.5)*9,ty-Math.sin(a+.5)*9,color,1.8);
}
function post(c,x,y,scale=1){
 c.save();c.translate(x,y);c.scale(scale,scale);c.fillStyle='#1e2834';c.beginPath();c.roundRect(-19,-13,38,26,4);c.fill();
 line(c,-12,-7,-3,6,'#e6f5fc',2);line(c,-3,-7,-12,6,'#e6f5fc',2);
 line(c,2,-5,13,-5,'#b4cadb',1.5);line(c,2,0,13,0,'#b4cadb',1.5);line(c,-10,9,10,9,'#74cba9',1);c.restore();
}

export function drawElonGround(c,g,t){
 c.save();
 for(const trail of g.elonTrails??[]){
  c.globalAlpha=Math.min(1,(trail.ends-g.time)/.5)*.7;
  c.fillStyle='#e6934938';c.fillRect(trail.x0-12,104+trail.row*96+32,trail.x1-trail.x0+24,48);
  for(let x=trail.x0;x<trail.x1+1;x+=14){const y=152+trail.row*96;c.beginPath();c.moveTo(x-5,y+15);c.quadraticCurveTo(x-8,y-3,x,y-8-Math.sin(t*12+x)*6);c.quadraticCurveTo(x+4,y+4,x+6,y+15);c.fillStyle='#efaa5e';c.fill();}
 }
 c.globalAlpha=1;
 for(const e of g.enemies.filter(e=>e.hp>0&&e.elonKit)){
  const k=e.elonKit,tr=k.trend;
  if(tr&&tr.ends>g.time){
   const y=104+tr.row*96;c.fillStyle='#b774a014';c.fillRect(102,y+2,896,92);c.strokeStyle='#ab6791';c.lineWidth=1.5;c.setLineDash([9,5]);c.strokeRect(103,y+3,894,90);c.setLineDash([]);
   badge(c,148,y+4,`${words(g,'热搜','HOT','話題')} +${30+tr.heat*5}%`,'#8f577c',90);
   c.fillStyle='#8f577c';c.font='600 10px "Segoe UI"';c.textAlign='center';c.fillText(`${(tr.ends-g.time).toFixed(1)}s`,148,y+36);
  }
  if(k.action?.kind==='shift'){
   const a=k.action,y=152+a.row*96;c.fillStyle='#5aa9c824';c.fillRect(Math.max(100,e.x-45),y-44,90,88);
   c.setLineDash([5,4]);arrow(c,e.x,e.y, e.x,y,'#418caf');c.setLineDash([]);ring(c,e.x,y,25,'#418caf');
  }
  if(['charge','rush'].includes(k.action?.kind)){
   const left=e.x-(k.action.kind==='rush'?k.action.distance:ELON_KIT.distance);
   c.fillStyle='#ef9c5128';c.fillRect(left-20,e.y-30,e.x-left+30,60);c.setLineDash([6,4]);arrow(c,e.x-20,e.y,left,e.y,'#c1773f');c.setLineDash([]);
  }
 }
 c.restore();
}

export function drawElonOrders(c,g,t){
 c.save();
 for(const e of g.enemies.filter(e=>e.hp>0&&e.elonKit)){
  const k=e.elonKit,action=k.action;
  for(const a of g.enemies.filter(a=>a.hp>0&&a.ownerId===e.id&&a.type==='starlink_drone')){
   if(k.recoverUntil>g.time)continue;
   c.globalAlpha=.45;c.setLineDash([3,7]);line(c,a.x,a.y-20,e.x,e.y-42,'#60cce0',1.5);c.setLineDash([]);c.globalAlpha=1;
  }
  let title='';let color='#294956';
  if(action){
   const key={shift:'autopilot',charge:'launch',rush:'launch',think:'think'}[action.kind];
   const name=ELON_SKILLS.find(s=>s[0]===key)?.[1];title=name?.[g.lang]||name?.en||'';
   title+=` ${action.kind==='rush'?'▶':`${Math.max(0,action.remaining).toFixed(1)}s`}`;
   if(action.kind==='think'){
    color='#695184';for(let n=0;n<3;n++){const x=e.x-18+n*18;ring(c,x,e.y-106,5,'#9873bf');if(n<action.nodes){c.beginPath();c.arc(x,e.y-106,3.5,0,TAU);c.fillStyle='#b48be1';c.fill();}}
    const q=Math.min(1,action.taken/(ELON_KIT.thinkThreshold*(e.cycleScale??1)));c.fillStyle='#806298';c.fillRect(e.x-36,e.y-72,72*q,3);
   }
  }else if(k.recoverUntil>g.time){title=`${k.recoveryKind==='think'?words(g,'推理中断','STAGGERED','推論中断'):words(g,'一级回收','RECOVERING','第1段回収')} ${(k.recoverUntil-g.time).toFixed(1)}s`;color='#9c6e3b';}
  else if(k.note){title=`${words(g,'完全无敌？','INVINCIBLE?','完全無敵？')} ${k.note.models.length}/3`;color='#446279';}
  else if(k.vulnerableUntil>g.time){title=`${words(g,'注释纠错 · 易伤','CORRECTED · +25%','訂正・弱点')} ${(k.vulnerableUntil-g.time).toFixed(1)}s`;color='#5c826c';}
  else {const dr=Math.round((1-elonDamageScale(g,e))*100);if(dr>0)title=`${words(g,'星链减伤','STARLINK GUARD','衛星軽減')} ${dr}%`;}
  if(title)badge(c,e.x+115,e.y-94,title,color,148);
  if(action&&k.note)badge(c,e.x+115,e.y-72,`${words(g,'注释','NOTES','注記')} ${k.note.models.length}/3`,'#446279',90);
 }
 for(const l of g.elonLimits??[]){
  const u=g.units.find(u=>u.id===l.unitId&&u.hp>0);if(!u||basicIntervalScale(g,u)===1)continue;
  badge(c,u.x,u.y-76,`${words(g,'普攻限流','THROTTLED','通常攻撃制限')} ${(l.ends-g.time).toFixed(1)}s`,'#687682',110);
 }
 for(const o of g.elonOrders??[]){
  if(o.kind==='search'){
   const x=100+o.col*100,y=104+o.row*96;c.fillStyle='#61b8d315';c.fillRect(x+3,y+3,94,90);c.setLineDash([7,4]);c.strokeStyle='#348da9';c.lineWidth=2;c.strokeRect(x+4,y+4,92,88);c.setLineDash([]);
   const r=22+Math.sin(t*6)*3;ring(c,o.x,o.y-10,r,'#318ba7');line(c,o.x-r-7,o.y-10,o.x+r+7,o.y-10,'#66b6cd');line(c,o.x,o.y-r-17,o.x,o.y+r-3,'#66b6cd');
   badge(c,o.x,y+4,`${words(g,'实时搜索','LIVE SEARCH','検索')} ${o.remaining.toFixed(1)}s`,'#367c94',112);
  }else if(o.kind==='repost'){
   for(let i=0;i<o.marks.length;i++){
    const p=o.marks[i];if(i>0){c.setLineDash([4,5]);arrow(c,o.marks[i-1].x,o.marks[i-1].y-28,p.x,p.y-28,'#536e85');c.setLineDash([]);}
    ring(c,p.x,p.y-20,23,'#53778c',1);if(i<o.hop)continue;post(c,p.x,p.y-23,.65);
   }
   const p=o.marks[Math.min(o.hop,o.marks.length-1)];badge(c,p.x,p.y-78,`${words(g,'转发','REPOST','リポスト')} ${o.hop+1}/${o.marks.length} · ${o.remaining.toFixed(1)}s`,'#283746',132);
  }else if(o.kind==='thoughtBolt'){
   const p=Math.max(0,Math.min(1,(g.time-o.created)/.7)),x=o.fromX+(o.x-o.fromX)*p,y=o.fromY+(o.y-18-o.fromY)*p-35*Math.sin(p*Math.PI);
   ring(c,x,y,9,'#b893e4',2);line(c,x-5,y-5,x+5,y+5,'#e1d0f6',2);line(c,x+5,y-5,x-5,y+5,'#e1d0f6',2);
  }
 }
 c.restore();
}

export function drawElonProjectile(c,p,t){
 if(!['elonPulse','grokProjection'].includes(p.kind))return false;
 c.save();c.translate(p.x,p.y);
 if(p.kind==='elonPulse'){
  line(c,10,0,28,0,'#53b6d577',4);c.beginPath();c.moveTo(-13,0);c.lineTo(1,-8);c.lineTo(11,0);c.lineTo(1,8);c.closePath();c.fillStyle='#234253';c.fill();c.strokeStyle='#a3edfa';c.lineWidth=1.6;c.stroke();
  line(c,-1,-4,5,4,'#b8f3ff',1.3);line(c,5,-4,-1,4,'#b8f3ff',1.3);
 }else{
  c.rotate(t*9+p.id);line(c,-14,0,13,0,'#d6c1f1',3);c.beginPath();c.moveTo(1,-12);c.quadraticCurveTo(20,-15,16,5);c.lineTo(6,10);c.lineTo(1,-12);c.fillStyle='#9682bd';c.fill();c.strokeStyle='#e3d4f7';c.lineWidth=1.3;c.stroke();
 }
 c.restore();return true;
}

export function drawElonEffect(c,f){
 if(!['elonRay','elonThoughtHit','elonRepostHit','elonLanding','elonInterrupted','elonCorrection','elonViral'].includes(f.type))return false;
 const p=Math.max(0,Math.min(1,f.age/f.duration));c.save();c.globalAlpha*=1-p;
 if(f.type==='elonRay'){
  line(c,f.x,104,f.x,f.y+34,'#62c3df55',15*(1-p)+1);line(c,f.x,104,f.x,f.y+34,'#d5f9ff',3);ring(c,f.x,f.y,12+p*36,'#71c8e0',2);
 }else if(f.type==='elonLanding'){
  c.beginPath();c.ellipse(f.x,f.y,20+p*45,7+p*12,0,0,TAU);c.strokeStyle='#d3995b';c.lineWidth=2;c.stroke();
  for(let n=0;n<6;n++){const a=n*2.4;line(c,f.x+Math.cos(a)*12,f.y+Math.sin(a)*4,f.x+Math.cos(a)*p*50,f.y+Math.sin(a)*p*22,'#c8a174',2);}
 }else if(f.type==='elonRepostHit'){post(c,f.x,f.y-p*22,1+p*.4);}
 else if(f.type==='elonThoughtHit'){ring(c,f.x,f.y,8+p*30,'#ae8cce',2);}
 else {badge(c,f.x,f.y-p*20,f.text,f.type==='elonCorrection'?'#507b65':f.type==='elonInterrupted'?'#82629a':'#946893',200);}
 c.restore();return true;
}
