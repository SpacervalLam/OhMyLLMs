import {enemySkillNames,localized} from './data.js';
import {ELON_GUIDE} from './elon-data.js';

const L=(zh,en,ja)=>({zh,en,ja});
// Each named ability owns its paragraph, so descriptions do not depend on
// punctuation or matching translated names inside a combined summary.
const GUIDES={
 elon_super:ELON_GUIDE,
 runner:{details:[L('低血量、高移速。优先拦截，避免它绕过薄弱战线。','Low health and high speed; intercept before it reaches a weak lane.','低HP・高速移動。薄い防衛線への侵入に注意。')]},
 medic:{details:[L('每 8 秒为附近一格内、距离不超过 220 的其他敌人恢复 45 HP。','Every 8s, heals other enemies within one lane and 220px by 45 HP.','8秒ごとに隣接レーン・距離220以内の他の敵を45HP回復。')]},
 bulwark:{details:[L('自带 60 护盾；每 10 秒将附近其他敌人的护盾补至 60，不能叠加。','Starts with 60 shield; every 10s, restores nearby allies to 60 shield without stacking.','初期シールド60。10秒ごとに周囲の他の敵のシールドを60まで補充、重複なし。')]},
 banner:{details:[L('附近一格内、距离不超过 220 的其他敌人移动速度提高 25%；光环不叠加。','Other enemies within one lane and 220px move 25% faster; auras do not stack.','隣接レーン・距離220以内の他の敵の移動速度が25%上昇、重複なし。')]},
 pony:{details:[L('锁定一位 LLM 的格子，预警 3 秒后从天而降并与该格 LLM 重合。不移动、不攻击，落地后可被攻击；落地 8 秒内未被击杀，就带走该格当前的 LLM 并撤离。被偷棋子不退款、不触发阵亡复活。','Locks an LLM tile, then drops onto it after a 3s warning. Never moves or attacks; vulnerable after landing. If not defeated within 8s of landing, takes the LLM currently in that tile and escapes. No refund or death-trigger revival.','LLMのマスをロックし、3秒の予告後に同じ位置へ降下。移動・攻撃せず、着地後は攻撃可能。着地から8秒以内に倒せなければ、そのマスのLLMを連れて撤退。返金・死亡時復活なし。')]},
 ipo:{intro:L('向本路前方投掷钟槌。','Throws a bell hammer down its lane.','同レーン前方へ鐘槌を投げる。'),details:[
  L('累计受到 220 伤害后切换相邻路线，冷却 5 秒，最多 3 次；换路瞬间无敌 0.4 秒。','Changes to an adjacent lane after 220 accumulated damage; 5s cooldown, 3 times max, with 0.4s invulnerability.','累計220ダメージで隣接レーンへ移動。間隔5秒、最大3回。移動時0.4秒無敵。'),
  L('每 12 秒召唤 2 名迷你快递员，震伤附近模型并眩晕 0.5 秒，同时为附近资本补至 60 护盾。','Every 12s summons 2 mini runners, damages and stuns nearby models for 0.5s, and restores nearby capital to 60 shield.','12秒ごとにミニランナー2体を召喚。周囲のモデルを攻撃し0.5秒スタン、周囲の資本の盾を60まで補充。'),
  L('每 18 秒向最近三路空投招股书，预警 1 秒后落地爆炸。','Every 18s drops prospectuses into the nearest three lanes; they explode after a 1s warning.','18秒ごとに最寄りの3レーンへ目論見書を投下。1秒の予告後に爆発。')
 ],notes:L('半血后攻击提高 35%、移速提高 20%，获得 120 护盾且技能间隔缩短。GPU 小车在此停止并造成 800 伤害。击败奖励 100 Token。','Below half HP: +35% damage, +20% speed, 120 shield and shorter ability intervals. Stops GPU carts and takes 800 damage. Defeat rewards 100 Tokens.','HP半分以下で攻撃+35%、速度+20%、盾120とスキル間隔短縮。GPUカートを止め800ダメージ。撃破報酬100トークン。')},
 overlord:{intro:L('自带 260 装甲。','Starts with 260 armor.','初期装甲260。'),details:[
  L('每 10 秒将自身护盾补至 160、附近敌人护盾补至 80。','Every 10s restores its shield to 160 and nearby enemies’ shields to 80.','10秒ごとに自身の盾を160、周囲の敵の盾を80まで補充。'),
  L('向本路前方发射热射线，在射程内停止前进。','Fires a heat ray down its lane, holding position while a target is in range.','同レーン前方へ熱線を発射。射程内に対象がいる間は前進しない。')
 ],notes:L('半血后攻击提高 35%、移速提高 20%，获得 120 护盾，补盾间隔缩至 7 秒。GPU 小车在此停止并造成 800 伤害。击败奖励 200 Token。','Below half HP: +35% damage, +20% speed, 120 shield; shield interval becomes 7s. Stops GPU carts and takes 800 damage. Defeat rewards 200 Tokens.','HP半分以下で攻撃+35%、速度+20%、盾120。盾補充の間隔は7秒。GPUカートを止め800ダメージ。撃破報酬200トークン。')},
 jack:{details:[
  L('向本路模型抛掷电商包裹，进入射程后停止前进。','Lobs e-commerce parcels at models in its lane, holding position when in range.','同レーンのモデルへ通販の荷物を投げ、射程内では前進を止める。'),
  L('每 15 秒向本路及上下邻路各派出一名迷你货运分身；边缘路线仅向有效路线派出。','Every 15s dispatches one mini cargo double into this lane and each valid adjacent lane.','15秒ごとに同レーンと有効な上下隣接レーンへミニ貨物分身を1体ずつ配備。')
 ]},
 pony_super:{details:[
  L('累计受伤 300 后切换相邻路线，冷却 6 秒，最多 4 次。','Changes to an adjacent lane after 300 accumulated damage; 6s cooldown, 4 times max.','累計300ダメージで隣接レーンへ移動。間隔6秒、最大4回。'),
  L('召唤 5 只 QQ 企鹅，优先锁定不同 LLM。3 秒预警后降落，不攻击；落地 8 秒未被击杀则偷走该格 LLM。不足 5 位时重复锁定，无目标时等待。','Summons 5 QQ penguins, preferring distinct LLMs. After a 3s warning they land and never attack; surviving 8s lets them steal their tile occupant. Repeats scarce targets; waits if none exist.','QQペンギン5体が異なるLLMを優先してロック。3秒後降下し攻撃せず、着地から8秒生存で同マスのLLMを強奪。対象不足時は重複、0体なら待機。'),
  L('封锁全部游戏操作 20 秒，战斗和自动收币继续。','Blocks all game input for 20s while battle and automatic coin collection continue.','全ゲーム操作を20秒封鎖。戦闘とコイン自動回収は続行。'),
  L('标记最多 3 位 LLM，累计 5 秒实际伤害（含护盾和装甲，不含溢出）；随后每位存活敌人各回复等量 HP，最多回满。','Marks up to 3 LLMs for 5s. Each living enemy then heals their total actual damage, including shield and armor but excluding overkill, capped at max HP.','最大3体のLLMの5秒間の実ダメージを集計（盾・装甲含む、過剰分除外）。生存中の各敵のHPを同量、上限まで回復。')
 ]},
 trump:{intro:L('固定在最右侧出战区，不向前推进。','Remains at the right edge without advancing.','右端の出撃エリアに固定され前進しない。'),details:[
  L('与目标路线的军用 Claude 交换位置，换路后仍位于最右侧；驻军占位同步交换，避免同路叠加。','Swaps positions with Military Claude in the target lane, staying at the right edge. Garrison slots exchange together to prevent stacking.','対象レーンの軍用Claudeと位置交換し、右端を維持。駐屯枠も同時交換し重複を防ぐ。'),
  L('随机指定最多 5 个有 LLM 的不同格子，预警 1.5 秒后各造成 150 伤害。','Targets up to 5 distinct occupied LLM tiles, dealing 150 damage each after a 1.5s warning.','LLMのいる異なる最大5マスを指定。1.5秒の予告後、各150ダメージ。'),
  L('其余四路各部署一位军用 Claude，后续补齐损失。军用 Claude 无法被策反，每条路全场最多一位，多个 Trump 共享此上限。','Deploys one Military Claude in each other lane and replenishes losses. They cannot be converted; all Trumps share a global limit of one per lane.','他の4レーンへ軍用Claudeを各1体配備し損失を補充。転向不可。複数のTrumpで全体の各レーン1体上限を共有。'),
  L('在场时立即斩杀 HP 严格低于 25% 的 LLM，正好 25% 不触发。','While present, instantly executes LLMs strictly below 25% HP; exactly 25% is safe.','在場中、HP25%未満のLLMを即処刑。ちょうど25%では発動しない。'),
  L('包括自身在内的每个敌人首次降至 10% HP 时回复到 30%，可挡住一次致命伤害，每个单位仅一次。','Each enemy, including Trump, first reaching 10% HP recovers to 30%, preventing one lethal hit. Once per unit.','自身を含む各敵が初めてHP10%に達すると30%へ回復。致命傷も一度防ぐ。各個体1回のみ。'),
  L('社会福利优先结算；之后自身降至 1% HP 时进入无敌状态 15 秒，再撤离战场。无法被击败，不计击杀、Token 或积分。倒计时内两个被动仍生效。','Welfare resolves first. Thereafter, at 1% HP, becomes invulnerable for 15s and withdraws. Cannot be defeated; awards no kill, Tokens or score. Both passives remain active until withdrawal.','福祉を優先。その後HP1%に達すると15秒無敵となり撤退。撃破不可、撃破数・トークン・得点なし。撤退まで両パッシブは有効。')
 ]},
 military_claude:{details:[
  L('使用三星 Claude 的战斗效果：每 2 秒射出 63 伤害普攻；每 2.3 秒锁定本路最近目标及其周围 125 范围内的目标，0.65 秒后各造成 45 伤害并剥除护盾，可波及邻路。无 Harness 效果，不会策反 LLM。','Uses three-star Claude combat: a 63-damage basic shot every 2s; every 2.3s marks the nearest same-lane target and others within 125px, including adjacent lanes. After 0.65s deals 45 damage each and strips shields. No Harness or LLM conversion.','三つ星Claudeの戦闘効果：2秒ごとに通常攻撃63。2.3秒ごとに同レーンの最寄り対象と周囲125以内をマークし、0.65秒後各45ダメージと盾解除。隣接レーンも対象。Harness・LLM転向なし。'),
  L('驻守右侧，Trump 换路时与其交换位置。无法被策反；每条路全场至多存在一位，多个 Trump 也不能叠加部署。','Holds the right edge and swaps positions with Trump on lane changes. Cannot be converted; at most one per lane globally, including deployments by multiple Trumps.','右端に駐屯しTrumpのレーン変更時に位置を交換。転向不可。全体で各レーン最大1体、複数Trumpでも重複配備不可。')
 ]}
};

export function enemyGuide(enemy,lang){
 const guide=GUIDES[enemy.id],names=enemySkillNames(enemy);
 return {intro:guide?.intro?localized(guide.intro,lang):'',notes:guide?.notes?localized(guide.notes,lang):'',
  skills:names.map((name,index)=>({name:localized(name,lang),description:localized(guide?.details[index]??enemy.desc,lang)}))};
}
