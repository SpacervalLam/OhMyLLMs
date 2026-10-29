export const harnessCost=m=>m.id==='kimi'?300:m.cost*2;
export const DEEPSEEK_HARNESS=Object.freeze({bonus:25,every:3,dividend:50});
// Star progression is counted in paid one-star copies on the same tile.
export const DEEPSEEK_INCOME=Object.freeze([0,25,50,100]);
export const STAR_COPIES=Object.freeze([0,1,3,7]);
export const starsOf=u=>u.stars??1;
export const skillScale=u=>starsOf(u)===3?1:starsOf(u)===2?.6:0;
export const BASIC_ATTACKS=Object.freeze({
 deepseek:{damage:0,period:1.8,speed:290,shape:0},
 kimi:{damage:0,period:1.7,speed:330,shape:1},
 chatgpt:{damage:24,period:1.4,speed:390,shape:2},
 qwen:{damage:14,period:2.2,speed:270,shape:3},
 glm:{damage:16,period:1.9,speed:310,shape:4},
 gemini:{damage:22,period:1.4,speed:410,shape:5},
 grok:{damage:30,period:2.1,speed:340,shape:6},
 claude:{damage:35,period:2,speed:360,shape:7},
 minimax:{damage:50,period:2.8,speed:300,shape:8},
 doubao:{damage:16,period:1.1,speed:420,shape:9},
 mimo:{damage:24,period:1.5,speed:460,shape:10}
});
export const HARNESSES=Object.freeze({
 deepseek:{name:'DeepSeek Harness',glyph:'>_',color:'#79c3e4'},
 chatgpt:{name:'Codex',glyph:'⌘',color:'#a4eedc'},
 kimi:{name:'Kimi Code',glyph:'☾',color:'#c4b6f1'},
 qwen:{name:'Qoder',glyph:'◇',color:'#9dbbe9'},
 glm:{name:'Zcode',glyph:'▦',color:'#b9c9e4'},
 gemini:{name:'Gemini CLI',glyph:'✧',color:'#d5b7f2'},
 grok:{name:'Grok Build',glyph:'⌁',color:'#e4b58f'},
 claude:{name:'Claude Code',glyph:'§',color:'#efbf91'},
 minimax:{name:'MiniMax Agent',glyph:'▶',color:'#efb5c9'},
 doubao:{variant:'seedance',name:'Seedance',glyph:'▷',color:'#57d7b0'},
 mimo:{name:'MiMo Inference Kit',glyph:'»',color:'#efab70'}
});
// Doubao's three-star slot is a choice between a coding harness and a video one.
// HARNESSES keeps the default (Seedance) for callers that do not pass a variant.
export const HARNESS_OPTIONS=Object.freeze({
 doubao:Object.freeze([
  Object.freeze({variant:'trae',name:'TRAE',glyph:'◈',color:'#32F08C'}),
  Object.freeze({variant:'seedance',name:'Seedance',glyph:'▷',color:'#57d7b0'})
 ])
});
export const harnessOptions=model=>HARNESS_OPTIONS[model.id]??[HARNESSES[model.id]];
export const RANK_COPY={
 zh:{maxStars:'已经是三星棋子。',merge:'同名合成',upgrade:'升星',basic:'一星 · 仅普通攻击',weak:'二星 · 弱化技能',full:'三星 · 完整技能',hint:'点击同名棋子即可叠加：1 + 2 → ★★，再 + 4 → ★★★',stackHint:'点击叠加 · {cost} Token',spend:'−{cost} Token',progress:'下阶进度',harness:'Harness',empty:'选择模型，在同名棋子上叠加升星。',refund:'铲除返还该棋子全部投入费用的 50%；Harness 随棋子退场移除。'},
 en:{maxStars:'This unit is already three stars.',merge:'Merged',upgrade:'Rank up',basic:'1★ · Basic attack only',weak:'2★ · Lesser skill',full:'3★ · Full skill',hint:'Click a unit to stack the same model: 1 + 2 → ★★, then + 4 → ★★★',stackHint:'Click to stack · {cost} Tokens',spend:'−{cost} Tokens',progress:'Next rank',harness:'Harness',empty:'Select a model and stack copies on its tile to rank up.',refund:'Removing refunds 50% of all copies invested; its Harness is removed.'},
 ja:{maxStars:'すでに三つ星です。',merge:'同名合成',upgrade:'星アップ',basic:'1★ · 通常攻撃のみ',weak:'2★ · 弱化スキル',full:'3★ · 完全スキル',hint:'同じモデルの駒をクリックで重ねる：1 + 2 → ★★、さらに + 4 → ★★★',stackHint:'クリックで重ねる · {cost}トークン',spend:'−{cost}トークン',progress:'次の星',harness:'Harness',empty:'同名モデルを同じマスに重ねて星を上げます。',refund:'撤去は投入した全コストの50%を返却。退場時にHarnessも消えます。'}
};
export const rankText=(lang)=>RANK_COPY[lang]||RANK_COPY.en;

export const WEAK_SKILLS={
 doubao:['对话气泡最多弹跳命中 2 个不同敌人，初始伤害 21.6，每跳衰减 20%','Chat bubbles hit up to 2 distinct enemies for 21.6 initial damage, losing 20% per bounce','会話バブルが異なる敵を最大2体攻撃。初撃21.6ダメージ、跳ねるたび20%減衰'],
 mimo:['推演箭沿本路贯穿最多 2 个不同敌人，每个造成 33 点伤害','Inference arrows pierce up to 2 distinct enemies in this lane for 33 damage each','推論の矢が同レーンの異なる敵を最大2体貫通し、各33ダメージ'],
 deepseek:['每 7 秒产出 50 Token','Produces 50 Tokens every 7s','7秒ごとに50トークン生産'],
 kimi:['每 8 秒为周围一格内的 LLM 恢复 24 HP，并产出 7 Token','Every 8s, restores 24 HP to LLMs within one tile and produces 7 Tokens','8秒ごとに周囲1マスのLLMを24HP回復し、7トークン生産'],
 chatgpt:['每 3 次普通攻击释放激光，贯穿本路前方敌人，持续 1.1 秒；每 0.12 秒造成 3 点伤害','Every 3 basic attacks, fires a 1.1s beam through enemies ahead in this lane, dealing 3 damage every 0.12s','通常攻撃3回ごとに正面の同レーンへ1.1秒のビームを放ち、0.12秒ごとに3ダメージ'],
 qwen:['每 6 秒恢复自身 18 HP；相邻 LLM 受到的伤害减少 15%；每次受到 Jensen 攻击，削减其 18 点 GPU 护甲','Every 6s, restores 18 HP to self; adjacent LLMs take 15% less damage; each hit from Jensen removes 18 GPU armor','6秒ごとに自身を18HP回復。隣接LLMの被ダメージ15%減。Jensenの攻撃を受けるたびにGPU装甲を18削る'],
 glm:['每 4 次普通攻击生成小型冻结领域，持续 1.5 秒，范围内敌人减速 30%','Every 4 basic attacks, creates a small frost field for 1.5s that slows enemies within it by 30%','通常攻撃4回ごとに小型の凍結領域を1.5秒展開し、範囲内の敵を30%減速'],
 gemini:['双星优先攻击不同路线的敌人，各造成 12 点伤害；星链对穿过的敌人造成 12 点伤害','Twin stars favor separate lanes, dealing 12 damage each; their link deals 12 damage to enemies it crosses','双星が異なるレーンを優先し、各12ダメージ。星のリンクが通る敵にも12ダメージ'],
 grok:['投斧造成 26.4 点伤害，溅射附近敌人并短暂击退；直击目标灼烧 1.5 秒，每 0.5 秒损失 2 HP','Throws an axe for 26.4 damage with nearby splash and a short push; the direct target burns for 1.5s, losing 2 HP every 0.5s','斧で26.4ダメージを与え、周囲に爆風と短いノックバック。直撃対象は1.5秒炎上し、0.5秒ごとに2HP減少'],
 claude:['契约标记最近敌人及其周围 85 范围内的敌人，最多 2 名；0.65 秒后各造成 27 点伤害','Marks up to 2 enemies within 85 of the nearest enemy; after 0.65s, deals 27 damage to each','最寄りの敵とその周囲85以内の最大2体を契約。0.65秒後に各27ダメージ'],
 minimax:['打板飞到战线最右侧后倒带卷回最左侧：去程每个敌人 57 点、返程 40 点，覆盖本行与上下相邻行（外行 60%），定格 0.2 秒','The clapperboard flies to the right edge, then rewinds past her to the left edge: 57 damage per enemy outbound and 40 on the way back, across this lane and its neighbours (60% on the outer lanes), freezing hits for 0.2s','カチンコが右端まで飛び、左端まで巻き戻る。行きは各57、戻りは各40ダメージ。同レーンと上下の隣接レーン（外側は60%）、0.2秒停止']
};
export const FULL_SKILLS={
 doubao:['对话气泡最多弹跳命中 3 个不同敌人，初始伤害 36，每跳衰减 20%','Chat bubbles hit up to 3 distinct enemies for 36 initial damage, losing 20% per bounce','会話バブルが異なる敵を最大3体攻撃。初撃36ダメージ、跳ねるたび20%減衰'],
 mimo:['推演箭沿本路贯穿最多 3 个不同敌人，每个造成 55 点伤害','Inference arrows pierce up to 3 distinct enemies in this lane for 55 damage each','推論の矢が同レーンの異なる敵を最大3体貫通し、各55ダメージ'],
 kimi:['每 8 秒为周围一格内的 LLM 恢复 40 HP，并产出 15 Token','Every 8s, restores 40 HP to LLMs within one tile and produces 15 Tokens','8秒ごとに周囲1マスのLLMを40HP回復し、15トークン生産'],
 chatgpt:['蓄力 0.45 秒后释放激光，贯穿本路前方敌人，持续 1.45 秒；每 0.12 秒造成 4 点伤害','Charges for 0.45s, then fires a 1.45s beam through enemies ahead in this lane, dealing 4 damage every 0.12s','0.45秒チャージ後、正面の同レーンへ1.45秒のビームを放ち、0.12秒ごとに4ダメージ'],
 glm:['每 4 次普通攻击生成大型冻结领域，持续 3 秒，范围内敌人减速 55%','Every 4 basic attacks, creates a large frost field for 3s that slows enemies within it by 55%','通常攻撃4回ごとに大型の凍結領域を3秒展開し、範囲内の敵を55%減速'],
 gemini:['双星优先攻击不同路线的敌人，各造成 20 点伤害；星链对穿过的敌人造成 20 点伤害','Twin stars favor separate lanes, dealing 20 damage each; their link deals 20 damage to enemies it crosses','双星が異なるレーンを優先し、各20ダメージ。星のリンクが通る敵にも20ダメージ'],
 grok:['投斧造成 44 点伤害，溅射附近敌人并短暂击退；直击目标灼烧 3 秒，每 0.5 秒损失 2 HP','Throws an axe for 44 damage with nearby splash and a short push; the direct target burns for 3s, losing 2 HP every 0.5s','斧で44ダメージを与え、周囲に爆風と短いノックバック。直撃対象は3秒炎上し、0.5秒ごとに2HP減少'],
 claude:['契约标记最近敌人及其周围 125 范围内的敌人，可波及邻路；0.65 秒后各造成 45 点伤害，并移除护盾','Marks the nearest enemy and enemies within 125 of it, including adjacent lanes; after 0.65s, deals 45 damage to each and removes shields','最寄りの敵とその周囲125以内を隣接レーンも含めて契約。0.65秒後に各45ダメージを与え、シールドを解除'],
 minimax:['打板飞到战线最右侧后倒带卷回最左侧：去程每个敌人 95 点、返程 67 点，覆盖本行与上下相邻行（外行 60%），定格 0.4 秒','The clapperboard flies to the right edge, then rewinds past her to the left edge: 95 damage per enemy outbound and 67 on the way back, across this lane and its neighbours (60% on the outer lanes), freezing hits for 0.4s','カチンコが右端まで飛び、左端まで巻き戻る。行きは各95、戻りは各67ダメージ。同レーンと上下の隣接レーン（外側は60%）、0.4秒停止']
};
export function skillDescription(m,stars,lang){
 const i=lang==='zh'?0:lang==='ja'?2:1,a=BASIC_ATTACKS[m.id],prefix=`⭐${stars} · `;
 const clean=text=>text.trim().replace(/[。.!！?？]+$/u,'');
 if(m.id==='deepseek'){
  if(stars<3)return prefix+[`每 7 秒产出 ${DEEPSEEK_INCOME[stars]} Token`,`Produces ${DEEPSEEK_INCOME[stars]} Tokens every 7s`,`7秒ごとに${DEEPSEEK_INCOME[stars]}トークン生産`][i];
  return prefix+clean(m.desc[lang]||m.desc.en);
 }
 if(m.id==='qwen'){
  if(stars===1)return prefix+['无法攻击，仅阻挡敌人','Cannot attack; blocks enemies only','攻撃不可。敵を足止めする'][i];
  const full=['每 6 秒恢复自身 30 HP；相邻 LLM 受到的伤害减少 25%；每次受到 Jensen 攻击，削减其 30 点 GPU 护甲','Every 6s, restores 30 HP to self; adjacent LLMs take 25% less damage; each hit from Jensen removes 30 GPU armor','6秒ごとに自身を30HP回復。隣接LLMの被ダメージ25%減。Jensenの攻撃を受けるたびにGPU装甲を30削る'][i];
  return prefix+clean(stars===2?WEAK_SKILLS.qwen[i]:full);
 }
 if(m.id==='kimi'&&stars===1)return prefix+['每 8 秒为正前方一格内的 LLM 恢复 18 HP','Every 8s heals the LLM in the tile directly ahead for 18 HP','8秒ごとに正面1マスのLLMを18HP回復'][i];
 if(stars===1)return prefix+[`普通攻击：每 ${a.period} 秒造成 ${a.damage} 点伤害`,`Basic attack: ${a.damage} damage every ${a.period}s`,`通常攻撃：${a.period}秒ごとに${a.damage}ダメージ`][i];
 if(stars===2)return prefix+clean(WEAK_SKILLS[m.id][i]);
 return prefix+clean(FULL_SKILLS[m.id]?.[i]||m.desc[lang]||m.desc.en);
}
export function harnessDescription(id,stars,lang,variant=null){
 const i=lang==='zh'?0:lang==='ja'?2:1;
 if(id==='qwen')return ['将实际所受伤害的 8% 反弹给周围一格内最近的一名敌人','Reflects 8% of actual damage taken to the nearest enemy within one tile','実際に受けたダメージの8%を周囲1マス以内の最も近い敵1体に反射'][i];
 if(id==='grok')return ['亡语：被击败或铲除时扔出巨型斧头，对本行及上下相邻行前方的每个敌人，造成等于该敌人命中时已损HP 100% 的伤害','Deathrattle: on defeat or removal, throws a giant axe ahead through this lane and its immediate neighbors, dealing damage equal to each enemy’s own missing HP at impact','断末魔：撃破・撤去時に巨大な斧を投げ、同レーンと上下の隣接レーンの前方の各敵に命中時のその敵自身の失ったHPの100%分のダメージ'][i];
 if(id==='claude')return ['契约期间有非 BOSS 敌人被击败时，将其转为友方，但全属性减半：HP、攻击、移速、护甲，以及技能的强度与发动频率；触发后冷却 200 秒','When a non-boss enemy is defeated under contract, converts it to an ally at half strength: HP, damage, movement, armor, and both the potency and cadence of its ability; 200s cooldown after activation','契約中のBOSS以外の敵が倒れた時、味方に転化するが全能力は半減（HP・攻撃・移動・装甲、およびスキルの強度と発動頻度）。発動後のクールダウン200秒'][i];
 if(id==='kimi')return ['周围一格内有 LLM 被击倒时，立即复活一位并恢复全部 HP；触发后冷却 60 秒','When an LLM within one tile is defeated, immediately revives one at full HP; 60s cooldown after activation','周囲1マスのLLMが倒れた時、1体を即座にHP全回復で復活。発動後のクールダウン60秒'][i];
 if(id==='deepseek')return ['每次产币额外产出 25 Token；每 3 次产币再追加 50 Token','Produces 25 extra Tokens each cycle; every 3 cycles, produces another 50 Tokens','生産ごとに25トークン追加。3回ごとにさらに50トークン追加'][i];
 if(id==='chatgpt')return ['额度重置：装备时及每 10 秒重置 ChatGPT 部署冷却与自身攻击冷却；正在释放的激光补满至 1.45 秒并结束蓄力','Quota reset: on equip and every 10s, resets ChatGPT deployment and own attack cooldowns; refills an active beam to 1.45s and ends its charge','上限リセット：装備時と10秒ごとにChatGPTの配置・自身の攻撃クールダウンをリセット。発射中のビームを1.45秒に補充し、チャージを完了'][i];
 if(id==='doubao'){
  if(variant==='trae')return ['多文件改写：技能气泡额外弹跳 2 次，最多命中 5 个不同目标，衰减不变','Multi-file Edit: the bubble bounces twice more, hitting up to five distinct targets with unchanged falloff','マルチファイル編集：バブルがさらに2回跳ね、最大5体の異なる敵に命中。減衰はそのまま'][i];
  return ['一镜到底：技能气泡施放后 0.6 秒重放本次弹跳链，伤害为原技能的 40%','One-take: 0.6s after the cast, replays this bounce chain for 40% damage','一鏡到底：スキル発動の0.6秒後に今回のバウンド連鎖を40%のダメージで再生'][i];
 }
 return [`技能间隔缩短 ${stars===3?12:6}%`, `Skill interval reduced ${stars===3?12:6}%`, `スキル間隔${stars===3?12:6}%短縮`][i];
}

export function stackDescription(u,lang){
 const copies=u.copies??STAR_COPIES[starsOf(u)],count=Math.max(0,copies-1);
 return lang==='zh'?`已叠加 ${count} 次`:lang==='ja'?`重ねた回数 ${count}`:`Stacked ${count} times`;
}
