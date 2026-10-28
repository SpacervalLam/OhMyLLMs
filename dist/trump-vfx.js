import {TRUMP_KIT,onFieldTrump} from './trump-boss.js';
const TAU=Math.PI*2;
const box=(c,x,y,w,h,color)=>{c.beginPath();c.roundRect(x,y,w,h,5);c.fillStyle=color;c.fill();};
const ring=(c,x,y,r,color,width=2)=>{c.beginPath();c.arc(x,y,r,0,TAU);c.strokeStyle=color;c.lineWidth=width;c.stroke();};

export function drawTrumpOrders(c,g,t){
 c.save();
 for(const strike of g.airstrikes){
  const x=100+strike.col*100,y=104+strike.row*96,p=1-strike.remaining/TRUMP_KIT.strikeWarning;
  c.fillStyle=`rgba(179,68,57,${.08+.06*Math.sin(t*12)})`;c.fillRect(x+3,y+3,94,90);
  c.strokeStyle='#bc544a';c.lineWidth=2.5;c.setLineDash([7,4]);c.strokeRect(x+4,y+4,92,88);c.setLineDash([]);
  ring(c,strike.x,strike.y,24+Math.sin(t*8)*3,'#b84d45',2);
  c.beginPath();for(const [dx,dy] of [[-33,0],[33,0],[0,-33],[0,33]]){c.moveTo(strike.x+dx*.7,strike.y+dy*.7);c.lineTo(strike.x+dx,strike.y+dy);}c.stroke();
  box(c,strike.x-35,y+3,70,18,'#a94a42');c.fillStyle='#fff4dd';c.textAlign='center';c.font='bold 10px "Segoe UI", "Microsoft YaHei", sans-serif';c.fillText(`${g.lang==='zh'?'轰炸':g.lang==='ja'?'爆撃':'STRIKE'} ${Math.max(0,strike.remaining).toFixed(1)}s`,strike.x,y+16);
  if(p>.45){const q=(p-.45)/.55,my=strike.y-210*(1-q*q);c.save();c.translate(strike.x,my);c.rotate(-.18);c.fillStyle='#596875';c.beginPath();c.moveTo(0,13);c.lineTo(-7,0);c.lineTo(-7,-21);c.lineTo(7,-21);c.lineTo(7,0);c.closePath();c.fill();c.fillStyle='#e9c58b';c.fillRect(-7,-6,14,4);c.fillStyle='#d76546';c.beginPath();c.moveTo(-5,-23);c.lineTo(0,-42-Math.sin(t*21)*6);c.lineTo(5,-23);c.fill();c.restore();}
 }
 for(const writ of g.militaryWrits){
  const progress=Math.min(1,writ.age/writ.writ),alpha=writ.resolved?Math.max(0,(1.2-writ.age)/.55):.4+progress*.6;
  for(const mark of writ.marks){
   c.save();c.translate(mark.x,mark.y-22);c.globalAlpha=alpha;c.fillStyle='#fff1d6ee';c.fillRect(-19,-25,38,50);c.strokeStyle='#a35b49';c.lineWidth=1.5;c.strokeRect(-19,-25,38,50);
   c.fillStyle='#b88356';for(let n=0;n<4;n++)c.fillRect(-13,-15+n*8,22-n%2*6,2);
   c.translate(0,-((1-progress)**2)*40);c.strokeStyle='#a4453d';c.lineWidth=3;c.strokeRect(-12,-12,24,24);c.beginPath();c.moveTo(-7,0);c.lineTo(7,0);c.moveTo(0,-7);c.lineTo(0,7);c.stroke();c.restore();
  }
 }
 for(const e of g.enemies){
  if(!e.retreat||e.hp<=0)continue;
  c.save();c.translate(e.x,e.y-15);c.strokeStyle='#d8be73';c.fillStyle='#f8d98b22';c.lineWidth=2.5;
  c.beginPath();c.moveTo(0,-58);c.lineTo(43,-34);c.lineTo(37,25);c.lineTo(0,47);c.lineTo(-37,25);c.lineTo(-43,-34);c.closePath();c.fill();c.stroke();
  c.textAlign='center';c.font='bold 10px "Segoe UI", "Microsoft YaHei", sans-serif';
  box(c,-43,-78,86,19,'#927134');c.fillStyle='#fff4d6';c.fillText(`${g.lang==='zh'?'无敌撤离':g.lang==='ja'?'無敵撤退':'WITHDRAW'} ${e.retreat.remaining.toFixed(1)}s`,0,-64);c.restore();
 }
 if(onFieldTrump(g)){
  const label=g.lang==='zh'?'斩杀线 <25% · 社会福利 10% → 30%（每敌一次）':g.lang==='ja'?'処刑 <25% · 福祉 10% → 30%（各敵1回）':'EXECUTE <25% · WELFARE 10% → 30% (ONCE EACH)';
  const y=g.dividends.length?622:599;box(c,340,y,440,20,'#fff2e5ee');c.fillStyle='#a05a4e';c.textAlign='center';c.font='600 11px "Segoe UI", "Microsoft YaHei", sans-serif';c.fillText(label,560,y+14);
 }
 c.restore();
}

export function drawTrumpEffect(c,f,t){
 if(!['airstrikeBlast','execute','welfare','militaryDeploy','militaryStamp','retreatShield'].includes(f.type))return false;
 const p=Math.min(1,f.age/f.duration);c.save();c.globalAlpha=1-p;
 if(f.type==='airstrikeBlast'){
  for(let i=0;i<9;i++){const a=i*2.399,r=12+p*66;c.beginPath();c.arc(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r*.65,Math.max(1,(1-p)*(i%2?17:23)),0,TAU);c.fillStyle=i%3===0?'#765d5544':i%2?'#f4c278cc':'#d2754caa';c.fill();}
  ring(c,f.x,f.y,12+p*75,'#efd8a2',3*(1-p)+.5);
 }else if(f.type==='execute'){
  c.strokeStyle='#9d3f45';c.lineWidth=4*(1-p)+1;c.beginPath();c.moveTo(f.x-28,f.y-35+p*12);c.lineTo(f.x+28,f.y+21-p*12);c.moveTo(f.x+28,f.y-35+p*12);c.lineTo(f.x-28,f.y+21-p*12);c.stroke();ring(c,f.x,f.y,20+p*30,'#d08b7c');
 }else if(f.type==='welfare'){
  ring(c,f.x,f.y,15+p*40,'#77b993',2);c.fillStyle='#80bd9a';c.fillRect(f.x-3,f.y-25-p*12,6,22);c.fillRect(f.x-11,f.y-17-p*12,22,6);c.font='bold 12px "Segoe UI"';c.textAlign='center';c.fillText('30%',f.x,f.y-36-p*18);
 }else if(f.type==='militaryStamp'){
  c.strokeStyle='#b36d4e';c.lineWidth=3;c.strokeRect(f.x-19-p*9,f.y-19-p*9,38+p*18,38+p*18);
 }else{
  ring(c,f.x,f.y,18+p*44,f.color||'#c8c395',2);ring(c,f.x,f.y,10+p*34,'#eee2b5',1);
 }
 c.restore();return true;
}
