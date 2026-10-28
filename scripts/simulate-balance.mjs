import {GardenGame} from '../dist/engine.js';

function planFor(strategy){
 const plan=[];
 if(strategy!=='no-economy')plan.push(['deepseek',2,0],['deepseek',2,0]);
 for(const row of [0,1,3,4])plan.push(['chatgpt',row,2]);
 if(['legacy','fortified','economist'].includes(strategy)){
  for(const row of (strategy==='economist'?[0,1,3,4]:[0,1]))for(let n=0;n<3;n++)plan.push(['deepseek',row,0]);
 }else if(strategy==='combined'){
  for(const row of [0,4])for(let n=0;n<3;n++)plan.push(['deepseek',row,0]);
 }
 for(const row of [0,1,3,4])plan.push(['qwen',row,5]);
 for(const row of [2,0,1,3,4])for(let n=0;n<2;n++)plan.push(['chatgpt',row,2]);
 if(strategy==='fortified')for(const row of [2,0,1,3,4])for(let n=0;n<2;n++)plan.push(['qwen',row,5]);
 if(strategy==='combined'){
  for(const row of [2,0,4])for(let n=0;n<4;n++)plan.push(['deepseek',row,0]);
  for(const row of [2,0,1,3,4])for(let n=0;n<2;n++)plan.push(['qwen',row,5]);
  for(const row of [1,3])for(let n=0;n<3;n++)plan.push(['glm',row,3]);
 }
 for(const row of [2,0,1,3,4])for(let n=0;n<4;n++)plan.push(['chatgpt',row,2]);
 if(strategy==='combined')for(const row of [2,0,1,3,4])for(let n=0;n<4;n++)plan.push(['qwen',row,5]);
 return plan;
}
function simulate(strategy,seed,difficulty){
 const g=new GardenGame({seed,difficulty,lang:'zh'}),plan=planFor(strategy),waves=[];
 let step=0,collected=0;g.start();
 for(let frame=0;frame<18000&&g.phase==='playing';frame++){
  if(strategy!=='idle'&&step<plan.length&&g.plant(...plan[step]).ok)step++;
  for(const c of [...g.coins]){collected+=c.value;g.collect(c.id);}
  g.update(1/30);
  for(const e of g.drainEvents())if(e.type==='wave')waves.push({wave:e.wave,time:Math.round(g.time),tokens:Math.round(g.tokens),collected,units:g.units.length});
 }
 return {strategy,seed,difficulty,result:g.phase,wave:g.wave,seconds:Math.round(g.time),kills:g.kills,rescues:g.mowers.filter(Boolean).length,step,total:plan.length,tokens:Math.round(g.tokens),waves};
}
const results=[];
for(const difficulty of ['easy','normal','hard'])for(const strategy of ['idle','no-economy','legacy','combined','fortified','economist'])for(const seed of [7,42,2026])results.push(simulate(strategy,seed,difficulty));
console.log(JSON.stringify(results,null,2));
