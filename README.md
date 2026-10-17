# 模型保卫战 · LLM vs. Capital

九位社区 AI 娘迎战六位 CEO 的非商业同人塔防。原生 HTML、CSS、Canvas、JavaScript；运行与游玩不调用模型 API，不需要 API Key，不包含服务端数据收集。所有战斗立绘和参考图都随项目提供。

## 逐帧动画

15 位角色各有一张独立透明动作图集，6 列 × 5 行，每张 30 帧，共 450 帧。每帧是独立绘制的姿势，包含头发、手臂、腿部、道具和表情的变化。

- LLM：待机、专属技能／Claude 罢工、攻击／后勤技能、受击、退场。
- CEO：待机、行走、攻击、受击、退场；冲刺时行走动作也会加速。
- 实战中的动作由攻击、伤害、生产、治疗、死亡等事件触发，暂停与倍速同步作用于动画。
- 出战卡牌与角色图鉴保留静态海报；逐帧动画用于战场角色。
- 六位 CEO 使用独立的六帧交替步态图集 `dist/assets/animations/walk/`，覆盖旧图集的行走行；两次迈步分别由不同腿领步。
- 图集位于 `dist/assets/animations/`，状态布局在 `dist/animation.js`，状态推进在 `dist/engine.js`，绘制在 `dist/sprite-atlas.js`。生成图的间距存在细微差异，`manifest.json` 为 450 帧提供经校准的裁切坐标，播放时以同一角色的待机高度确定缩放，避免邻帧残影与退场时异常放大。

可选的素材检查（需要安装 Pillow 的 Python 环境）：`python scripts/verify-animation-assets.py`。该脚本只检查透明度、各帧非空和帧重复，不会修改图像。

重新生成裁切索引：`python scripts/prepare-animation-manifest.py`；仅写入 JSON 元数据，不改动原始 PNG 像素。

## 本地运行

需要 Node.js 22 或更新版本，无须安装依赖。

```powershell
cd G:\LLM_vs_Capitalist
npm.cmd run dev
```

浏览器打开 http://127.0.0.1:4173 。静态部署目录为 `dist/`。

```powershell
npm.cmd test
npm.cmd run check
```

## 游玩

- 选择模型卡牌，再点击 5 × 9 草地部署。`1`—`9` 选卡，`S` 铲子，`Esc` 取消，空格开始／暂停。
- 开局赠送 DeepSeek、ChatGPT、Qwen 各一位。DeepSeek 产出 Token；掉落币点击收集，8 秒后自动入账。
- 挡住 6 波敌人。每路只有一次 GPU 救场小车，用完后再次突破即失败。
- 支持中文、English、日本語，3 档难度、1/2/3 倍速、可开关音效。
- 「梗彩蛋」默认开启：简体中文下 Claude 部署一秒后罢工，切换英文／日文或关闭彩蛋立即复工。Grok 对 Elon 有额外伤害。全部是虚构同人效果。
- 语言、音效、难度、彩蛋开关与最佳击退数保存在当前浏览器的 localStorage 中。进行中的局面不自动存档。

## 角色分工

| 模型 | 技能 |
|---|---|
| DeepSeek | 每 7 秒产出 25 Token |
| ChatGPT | 稳定龙息输出，每第四次攻击双发 |
| Claude | 书页贯穿 3 名敌人；简中罢工彩蛋 |
| Kimi | 周围一格治疗 40 HP，并产出 15 Token |
| Gemini | 同时攻击本路及相邻路线的两个目标 |
| GLM | 棋子减速 55%，持续 3 秒 |
| Grok | 范围爆炸，对 Elon 有彩蛋加成 |
| MiniMax | 大范围电影冲击波，可伤及相邻路线 |
| Qwen | 650 HP 抗线、自愈，受 Jensen 攻击时削减其装甲 |

CEO 来客：Sam Altman（常规）、Dario Amodei（护盾）、Elon Musk（冲刺）、Jensen Huang（装甲）、Mark Zuckerberg（分叉）、Liang Wenfeng（Token 价格战）。

## 素材与许可

所有来源、作者和改编说明见 [ASSET_CREDITS.md](ASSET_CREDITS.md)，游戏内也提供「创作署名」。社区图及衍生模型立绘依 CC BY-NC-SA 4.0 共享；本游戏整体也采用该协议，参见 [LICENSE.md](LICENSE.md)。项目与所提及的公司、人物及原作游戏不存在官方关系；技能与台词不代表真实产品行为或真实人物言行。
