import {BOSS_ROTATION,BOSS_INTERVAL} from './super-boss.js';

export const ENEMY_CYCLE_WAVES=BOSS_ROTATION.length*BOSS_INTERVAL;
export const enemyCycleScale=wave=>1.05**Math.floor(Math.max(0,wave-1)/ENEMY_CYCLE_WAVES);
export const enemyPower=e=>(e.cycleScale??1)*(e.abilityScale??1);

export function scaleEnemyCycle(e,scale){
 const previous=e.cycleScale??1;if(scale<=previous||e.hp<=0||e.allied)return;
 const ratio=scale/previous,health=e.hp/e.maxHp;
 e.cycleBaseHp??=e.maxHp/previous;
 e.maxHp=Math.round(e.cycleBaseHp*scale);e.hp=e.maxHp*health;
 for(const stat of ['damage','speed','armor','shield'])e[stat]*=ratio;
 e.cycleScale=scale;
}
