// One transparent 3×3 painted atlas; logical cells stay independent of PNG size.
export const PROJECTILE_CELLS=Object.freeze({kimi:0,chatgpt:1,claude:2,gemini:3,glm:4,grok:5,minimax:6});
export function drawPaintedProjectile(c,p,image){
 const base=PROJECTILE_CELLS[p.model];
 if(!image||base===undefined)return false;
 const index=!p.basic&&p.model==='grok'?7:!p.basic&&p.model==='minimax'?8:base;
 const sw=image.naturalWidth/3,sh=image.naturalHeight/3;
 if(!(sw>0&&sh>0))return false;
 const size=p.basic?44:p.model==='grok'?70:62;
 c.save();
 // Rotate physical props around their center; magical missiles face their flight.
 if(p.model==='grok')c.rotate((p.age||0)*(p.basic?5:10));
 else c.rotate(Math.sin((p.age||0)*9)*.08);
 // A faint second impression gives the painted art a soft motion trail.
 c.save();c.globalAlpha*=.18;c.drawImage(image,index%3*sw,Math.floor(index/3)*sh,sw,sh,-size/2-9,-size/2,size,size);c.restore();
 c.drawImage(image,index%3*sw,Math.floor(index/3)*sh,sw,sh,-size/2,-size/2,size,size);
 c.restore();return true;
}
