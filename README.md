# Oh My LLMs · 1.0.0

十一位 AI 娘迎战资本阵营的无限波次同人塔防。Windows 原生窗口与本地 WebView2 渲染，运行不调用模型 API、不需要 API Key、不包含服务端数据收集。

## 安装与启动

支持 Windows 10 2004 或更新版本、Windows 11，x64。

- 完整安装包：`OhMyLLMs-1.0.0-Setup-x64.exe`。包含全部素材、.NET 运行时与 Microsoft WebView2 离线安装程序，可离线安装；已有 WebView2 时跳过依赖安装。
- 便携包：`OhMyLLMs-1.0.0-Windows-x64.zip`。解压后运行 `OhMyLLMs.exe`，保留完整目录。已包含 .NET 运行时，电脑需要具备 Microsoft WebView2 Runtime。
- 源码目录：双击 `OhMyLLMs.cmd`；尚无构建产物时启动器使用本机 .NET SDK 构建。

安装包默认安装到当前用户的应用目录，提供开始菜单快捷方式、可选桌面快捷方式和标准卸载程序。战绩、设置与窗口位置保存在 `%LOCALAPPDATA%/OhMyLLMs/`，卸载不删除个人数据。

## 玩法

点击右侧入口开始防守；准备阶段可以先部署，没有模型冷却。

- 选择卡牌再点击草地，或将卡牌拖到棋盘。同格同名投入累计 1 / 3 / 7 枚，分别为一 / 二 / 三星；升星提高生命与普攻，并逐步解锁技能。三星后可另购 Harness 装备。
- DeepSeek 生产 Token，Kimi 治疗与支援，Qwen 抗线、自愈并保护邻军；其他模型各有贯穿、范围输出、控制和特殊技能。完整规则见游戏图鉴。
- 铲除返还实际投入费用的 50%，开局赠送棋子不计入退款。
- 无限波次。每路有一次 GPU 救场小车；救场用完后再次突破，该局结束。击败敌人累计积分并保存最高纪录。
- 简中下二星、三星 Claude 会触发账号暂停彩蛋，切换英文或日文复工。Grok 对 Elon 的技能有额外伤害。

| 操作 | 按键 |
| --- | --- |
| 按价格顺序选择十一张卡牌 | `1`–`9`、`0`、`-` |
| 铲除 | `S` |
| 取消选择 / 关闭弹窗 / 退出全屏 | `Esc` |
| 暂停 / 继续 | 空格 |
| 全屏 | `F11` |

窗口支持 DPI 适配、大小与位置记忆；切出窗口或最小化自动暂停。设置提供中文、English、日本語与音效开关。

## BOSS

每 3 波出现一位，五位按顺序轮换。每完成一轮 15 波，下一轮敌人属性乘以 1.05，后续轮次叠乘。

| 首次出现 | BOSS | 主要机制 |
| --- | --- | --- |
| 第 3 波 | IPO Chairman | 转板、敲钟、招股书空投 |
| 第 6 波 | Compute Overlord | 重装甲、群体护盾、热射线 |
| 第 9 波 | Pony Ma Super | 换路、夺取 SP、垄断、入股分红 |
| 第 12 波 | Donald John Trump | 驻军、轰炸、斩杀线、社会福利、战略撤离 |
| 第 15 波 | Elon Musk Super | 星链、火箭与 xAI / X 的十一项战术 |

Elon Musk Super 拥有星链组网、全自动驾驶、星舰试射、一级回收、实时搜索、深度思考、Grok 分身、转发风暴、热搜第一、算法限流、社区注释。半血进入「超级传播」：试射前先变道、发射间隔缩短、回收窗口延长，转发优先衔接搜索目标。拆除卫星、打断推理、用 Grok 中断试射，或以三种不同模型触发社区注释，都能创造反击机会。

## 素材与许可

最终素材位于 `dist/assets/`，共 64 份无损 WebP 图片，原尺寸、透明通道与可见像素均保持一致。32 位角色各有 30 帧动作，两套防御形态各有 30 帧，合计 1,020 帧。Windows 图标保留原生 ICO，网页图标使用 SVG。

人物、技能和台词均为非官方虚构同人创作，不代表相关公司或个人认可。完整作者、来源与改编说明见 [ASSET_CREDITS.md](ASSET_CREDITS.md)，许可见 [LICENSE.md](LICENSE.md)。保留上游作者署名、非商业与相应共享要求。

## 源码构建

需要 Windows、Node.js 22+ 与 .NET 10 SDK。首次构建和首次下载安装工具需要联网；生成的完整安装包可离线安装。

```powershell
npm.cmd run dev          # 构建并启动桌面窗口
npm.cmd run build        # 构建带 .NET 运行时的完整应用目录
npm.cmd run package      # 构建便携 ZIP
npm.cmd run installer    # 构建完整 Setup EXE、便携 ZIP 与 SHA256 校验文件
npm.cmd test             # 引擎、交互、图集与版本验证
npm.cmd run check        # JavaScript 语法检查
npm.cmd run test:desktop # 实际 Windows / WebView2 宿主验证
npm.cmd run dev:web      # 可选网页调试
```

发布文件位于 `artifacts/releases/1.0.0/`，完整应用目录位于 `artifacts/desktop/OhMyLLMs/`。安装工具缓存于 `%LOCALAPPDATA%/OhMyLLMs/BuildTools/`，下载的安装程序会验证官方 Authenticode 签名。

测试报告与截图默认写入用户目录 `.codex/documents/OhMyLLMs/desktop-smoke/`，可用 `OHMYLLMS_SMOKE_DIR` 指定其他仓库外路径。开发过程资料、未采用美术和旧构建不纳入源码仓库或安装包。
