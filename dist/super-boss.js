export const SUPER_KIT=Object.freeze({sp:24,monopoly:45,dividend:18,lock:20,window:5,penguins:5,marks:3});
export const BOSS_ROTATION=Object.freeze(['ipo','overlord','pony_super','trump','elon_super']);
export const BOSS_INTERVAL=3;

export function pickDistinct(pool,count,random){
 const choices=[...pool],result=[];
 while(choices.length&&result.length<count)result.push(choices.splice(Math.floor(random()*choices.length),1)[0]);
 return result;
}

export function bossForWave(wave){
 return wave>0&&wave%BOSS_INTERVAL===0?BOSS_ROTATION[(wave/BOSS_INTERVAL-1)%BOSS_ROTATION.length]:null;
}
