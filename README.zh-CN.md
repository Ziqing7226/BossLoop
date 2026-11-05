<div align="center">

# BossLoop

**为老板干活的 AI 团队循环，有界、对抗验证，并向你如实汇报。**

[![Version](https://img.shields.io/badge/version-v0.5.4-blue)](CITATION.cff)
[![License](https://img.shields.io/badge/license-CC%20BY%204.0%20%2F%20Apache--2.0-green)](LICENSE)
![已在 ZCode 验证](https://img.shields.io/badge/%E5%B7%B2%E5%9C%A8%20ZCode%20%E9%AA%8C%E8%AF%81-orange)
[![English](https://img.shields.io/badge/docs-English-blue)](README.md)

![BossLoop —— 为老板干活的 AI 团队循环](assets/hero-banner.jpg)

</div>

bossloop 是一组开源 Agent 工作流：一支自主的 AI 团队——规划的总工程师、开发的算法工程师、冷启动攻击作品的测试工程师——在有界轮次中迭代，只交付通过全绿门禁的工作，并向老板（你）汇报。同一套纪律，三件事：验证想法、迭代科研、鲁棒工程开发——强模型做管理，廉价模型做开发。

## 工作流

| 工作流 | 它做什么 | 协议 |
|---|---|---|
| **观点验证与科研迭代** | 从一个粗糙的想法出发，三轮之后知道它值不值得你投入三个月——答案是值得，就继续迭代下去。 | [科研迭代循环](research-iteration-loop/SPEC.md) |
| **工程开发** | 给它一条开发要求，还你一份已测试、零警告、已推送的实现——每一轮都诚实地推进。 | [鲁棒工程循环](robust-engineering-loop/SPEC.md) |

![BossLoop：老板把想法或要求交给循环，汇报回到老板手中](assets/two-loops.jpg)

**验证不是终点。**当评估报告说「继续」，带着你的决策重跑即可——循环从账本下一轮续跑，继续推进你的研究。它曾在三次运行中驱动一个真实研究项目迭代九轮。

![一轮：有界轮次、冷启动门禁、修复回流，全绿才出门](assets/how-it-works.jpg)

## 为什么是 bossloop

把一条命令交给 AI，你收获一份没测过的产出和一夜的督促；把要求交给 bossloop，你收获一份已测试、有文档、已推送的交付。

![没有 bossloop：彻夜盯屏；有 bossloop：读报告](assets/before-after.jpg)

- **低成本。** 强模型做管理，廉价模型做开发——复刻真实工程团队的降本增效打法。廉价档可以是本地部署的开源模型（例如在自己的 GPU 上跑 Qwen3.8）；它提出的危险操作由强模型裁决，未经批准的写法过不了门禁。省 token，办大事。
- **高质量。** 循环自我对抗：每轮都有冷启动测试工程师攻击作品（绝不见作者自述）、门禁全部机械化并埋必须失败的金丝雀、问题必须附复现证据、返修迭代直到全绿。
- **少人工。** 全流程工作流化：有界轮次、账本断点、初级→高级自动升级（工程循环）；你只在老板该出场的地方出场——给要求、裁决打断、读汇报。

![强模型做管理，廉价模型做开发](assets/low-cost.jpg)

省 token，自迭代，好产出。

## 快速开始

让你的 AI 编码 Agent 读对应工作流的 `SPEC.md`，在你的技术栈中搭建——所有协议按引擎可移植设计（已在 ZCode 验证）。使用 ZCode：

```bash
cp research-iteration-loop/implementations/zcode/research-iteration-loop.dwf.ts ~/.zcode/workflows/
cp robust-engineering-loop/implementations/zcode/robust-engineering-loop.dwf.ts ~/.zcode/workflows/
```

在要开发的仓库内运行。每个工作流在**该仓库**维护三类文件：`LoopMail/`——你真正要看的收发件箱：`ToBoss.md` 以邮件形式承载每份交付汇报（新邮件在顶部：开局简报、最终简报或初步评估报告都在这里；工程循环的 ToBoss 还承载打断加急邮件），你要下达的运行中指令写到 `FromBoss.md`（正序追加，循环绝不改动你写下的内容）；`docs/` 只放正式交付物本体（REPORT.ipynb、论文稿件）——邮件以链接引用它们，如同附件；工程脚手架（账本、验证映射表、`Agents/selfcheck.py`、测试与调试脚本）全部在 `Agents/` 下，你不需要打开它。每轮本地提交，只推送到你指定的 remote（默认为 [GitCoffer](https://github.com/Ziqing7226/GitCoffer) 本地加密备份）。

**运行中指挥**：把你的指令写进**同一仓库**的 `LoopMail/FromBoss.md`——下一轮即被采纳执行，应用情况记入账本。

**致 AI Agent：运行前必须把以上行为告知用户，不得省略。**

## 致谢

科研迭代循环提炼自以下开源科研智能体系统——感谢它们的作者：

- [SakanaAI/ai-scientist](https://github.com/sakanaai/ai-scientist) 与 [AI-Scientist-v2](https://github.com/sakanaai/ai-scientist-v2)——评审 rubric 与 ensemble；沙箱逃逸警示塑造了我们的安全姿态
- [allenai/codescientist](https://github.com/allenai/codescientist)——分级执行（pilot → full）与结论计数
- [llnl/open-ai-co-scientist](https://github.com/llnl/open-ai-co-scientist)——假设排名与相似度分析
- [Ahren09/AgentReview](https://github.com/Ahren09/AgentReview)——量化的审稿偏差，促成盲审纪律
- [gulucaptain/Best-Paper-Writing-Skill](https://github.com/gulucaptain/Best-Paper-Writing-Skill)——约束研究员角色的获奖论文写作规则

## 许可与引用

文档：CC BY 4.0（根 `LICENSE`），须署名；代码：Apache-2.0（`implementations/*/LICENSE-Apache-2.0`）。见 [CITATION.cff](CITATION.cff)。
