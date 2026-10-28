import {CEO_MAP,ENEMY_COPY} from './data.js';
import {FIELD,PONY_RAID} from './engine.js';

export const enemySize=e=>e.mini?62:CEO_MAP[e.type].spriteSize??(e.boss?104:88);
export const ponyDropOffset=e=>e.raid?.phase==='landed'?Math.pow(Math.max(0,1-e.raid.elapsed/PONY_RAID.descent),2)*(e.y+110):0;

function plate(ctx,x,y,w,h,color){
 ctx.beginPath();ctx.roundRect(x,y,w,h,5);ctx.fillStyle=color;ctx.fill();
}

export function drawPonyRope(ctx,e,offset=0){
 if(e.raid?.phase!=='landed')return;
 ctx.save();ctx.strokeStyle='#456b75';ctx.lineWidth=2.5;
 const bottom=Math.max(46,e.y-40-offset);
 ctx.beginPath();ctx.moveTo(e.x+9,46);ctx.lineTo(e.x+9,bottom);ctx.stroke();
 ctx.strokeStyle='#d6edf1';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(e.x+10,46);ctx.lineTo(e.x+10,bottom);ctx.stroke();
 ctx.restore();
}

export function drawPonyRaid(ctx,e,t,lang){
 const raid=e.raid;if(!raid||!['warning','landed'].includes(raid.phase)||e.hp<=0)return;
 const x=FIELD.x+raid.col*FIELD.cw,y=FIELD.y+raid.row*FIELD.ch;
 const danger=raid.phase==='landed'&&raid.remaining<=3,color=danger?'#b54b4e':raid.phase==='warning'?'#ce9951':'#568b98';
 ctx.save();ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.setLineDash(raid.phase==='warning'?[6,5]:[]);
 ctx.globalAlpha=.7+Math.sin(t*5)*.15;ctx.strokeRect(x+4,y+4,FIELD.cw-8,FIELD.ch-8);ctx.setLineDash([]);ctx.globalAlpha=1;
 const bx=Math.min(FIELD.x+FIELD.cols*FIELD.cw-76,x+FIELD.cw/2+14),by=y+3;
 plate(ctx,bx,by,72,20,color);ctx.fillStyle='#fffaf0';ctx.textAlign='center';ctx.font='600 10px "Segoe UI", "Microsoft YaHei", sans-serif';
 ctx.fillText(`${raid.phase==='warning'?ENEMY_COPY[lang].raidDrop:ENEMY_COPY[lang].raidSteal} ${Math.max(0,raid.remaining).toFixed(1)}s`,bx+36,by+14);
 ctx.restore();
}

// Boss phase decoration only; per-unit glyph badges were removed so the painted
// character sheets stay legible.
export function drawEnemyKit(ctx,e,t){
 const c=CEO_MAP[e.type];if(!c.variant)return;
 ctx.save();
 if(e.boss){
  ctx.strokeStyle=c.color;ctx.lineWidth=2;ctx.globalAlpha=.65;
  ctx.beginPath();ctx.ellipse(e.x,e.y+27,38,10,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
  if(e.enraged){ctx.fillStyle='#e17f58';for(let i=0;i<4;i++){const p=(t*.7+i*.25)%1;ctx.globalAlpha=(1-p)*.7;ctx.beginPath();ctx.arc(e.x+Math.sin(i*2.4)*31,e.y+18-p*60,1.5,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
 }
 ctx.restore();
}

export function drawBossBars(ctx,game){
 const bosses=game.enemies.filter(e=>e.boss&&e.hp>0);if(!bosses.length)return;
 const text=ENEMY_COPY[game.lang],width=Math.min(510,850/bosses.length),gap=12;
 ctx.save();
 bosses.forEach((e,i)=>{
  const c=CEO_MAP[e.type],x=FIELD_CENTER-(bosses.length*width+(bosses.length-1)*gap)/2+i*(width+gap),y=47;
  plate(ctx,x,y,width,49,'#fff9edf0');
  ctx.font='bold 13px "Segoe UI", "Microsoft YaHei", sans-serif';ctx.textAlign='left';ctx.fillStyle=c.color;
  ctx.fillText(`BOSS · ${c.name}`,x+12,y+15);
  const phase=e.retreat?`${game.lang==='zh'?'无敌撤离':game.lang==='ja'?'撤退':'WITHDRAW'} ${e.retreat.remaining.toFixed(1)}s`:e.trumpKit?(game.lang==='zh'?'指挥中':game.lang==='ja'?'指揮中':'COMMAND'):e.superKit?'SUPER':e.enraged?text.phaseTwo:text.phaseOne;
  ctx.font='600 10px "Segoe UI", "Microsoft YaHei", sans-serif';ctx.textAlign='right';ctx.fillText(phase,x+width-12,y+15);
  plate(ctx,x+12,y+22,width-24,7,'#e3d7c9');
  const life=(width-24)*Math.max(0,Math.min(1,e.hp/e.maxHp));
  if(life>0)plate(ctx,x+12,y+22,life,7,e.enraged?'#c55357':c.color);
  ctx.font='600 10px "Segoe UI", sans-serif';ctx.fillStyle='#6d6558';ctx.textAlign='left';
  ctx.fillText(`${Math.ceil(e.hp)} / ${e.maxHp} HP${e.armor+e.shield>0?`  +${Math.ceil(e.armor+e.shield)} ${game.lang==='zh'?'护甲 / 护盾':game.lang==='ja'?'装甲 / シールド':'ARMOR / SHIELD'}`:''}`,x+12,y+42);
  ctx.textAlign='right';ctx.fillText(`${game.lang==='zh'?'路线':game.lang==='ja'?'レーン':'LANE'} ${e.row+1}`,x+width-12,y+42);
 });
 ctx.restore();
}
const FIELD_CENTER=560;

export function drawSuperStatus(ctx,game,t){
 const label=game.lang==='zh'?'入股分红':game.lang==='ja'?'出資配当':'DIVIDEND';
 ctx.save();
 for(const dividend of game.dividends){
  const boss=game.enemies.find(e=>e.id===dividend.ownerId&&e.hp>0);
  for(const mark of dividend.marks){
   const unit=game.units.find(u=>u.id===mark.id&&u.hp>0);if(!unit)continue;
   const {x,y}=unit;
   ctx.strokeStyle='#bb843c';ctx.lineWidth=2;ctx.globalAlpha=.65+Math.sin(t*4)*.15;
   ctx.beginPath();ctx.ellipse(x,y+25,38,10,0,0,Math.PI*2);ctx.stroke();
   if(boss){ctx.setLineDash([4,8]);ctx.lineWidth=1;ctx.globalAlpha=.32;ctx.beginPath();ctx.moveTo(x,y-42);ctx.quadraticCurveTo((x+boss.x)/2,y-85,boss.x,boss.y-40);ctx.stroke();ctx.setLineDash([]);}
   ctx.globalAlpha=1;plate(ctx,x-33,y-62,66,19,'#9a6e2b');ctx.fillStyle='#fff5d5';ctx.textAlign='center';ctx.font='bold 10px "Segoe UI", "Microsoft YaHei", sans-serif';ctx.fillText(`${label} ${Math.max(0,dividend.ends-game.time).toFixed(1)}s`,x,y-49);
  }
  const index=game.dividends.indexOf(dividend),y=598+index*22;
  plate(ctx,367,y,386,21,'#fff5dfed');ctx.font='600 12px "Segoe UI", "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.fillStyle='#956c2d';
  ctx.fillText(`${label} · ${Math.max(0,dividend.ends-game.time).toFixed(1)}s · ${Math.round(dividend.total)} HP`,560,y+15);
 }
 ctx.restore();
}
