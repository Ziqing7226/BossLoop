# 科研迭代循环（Research Iteration Loop）

**v0.1.0**

**从一个粗糙的想法出发，三轮之后知道它值不值得你投入三个月。**

一个自主的 AI 研究团队围绕你的想法做调研、开发、测试、写作与同行评审，然后**自动停止**，交给你一份诚实的评估：预期成功率、创新性、影响力，以及继续/转向/停止的建议。

**English documentation: [README.md](./README.md)**（默认）

## 示意图

| 中文 | English |
|---|---|
| ![循环示意图](docs/diagram-zh.png) | ![loop diagram](docs/diagram-en.png) |

## 为什么

- **天生有界。** 第 3 轮（可配置）硬停，没有无限漂移，没有沉没成本螺旋——评估报告强制回答 go/no-go。
- **独立验证。** 测试工程师攻击工作但绝不修改它；算法工程师在被测期间冻结实现。"边测边修"不是验证。
- **证据高于断言。** 稿件每个数字都映射到存档工件与可重跑的检查；门禁里埋着必须失败的金丝雀，且由编排器**机械核验**，不采信自报。
- **审稿即规划。** 编辑邀请相邻不重叠领域的审稿人，每条意见必须给出下一轮迭代建议，而不只是打分。
- **可续跑。** 账本就是检查点：中断的运行从下一轮继续，而不是从头重来。

## 循环

```
总工程师：读账本 → 调研 → 方案（≤3）+ 竞品复现（≤3）
  算法工程师：开发与自测        （此后实现冻结）
  测试工程师：独立验证 + canary 门禁 + 映射表
  总工程师：派发修复 → 算法工程师：执行
  研究员：修订（或创建）稿件
  编辑：相邻领域审稿人（≤3）+ 通读文献的读者
本地提交 · 本轮结束
          ↓  ×N 轮  ↓
硬停 → 《初步评估报告》→ 由你决策
```

完整协议：[SPEC.md](./SPEC.md)（英文，权威版本）

## 快速开始（ZCode）

1. 将 `implementations/zcode/research-iteration-loop.dwf.ts`（或英文界面变体 `*.en.dwf.ts`）复制到 `~/.zcode/workflows/`。
2. 在研究所在仓库内运行，参数：
   - `idea`（必填）——粗糙的想法，一段话；
   - `rounds`（默认 3）——硬停前的总轮数；
   - `profile`（可选）——项目约束：内存上限、数据只读、禁用做法、备份方式；
   - `focus`（可选）——你本轮的关注点。
3. 用同一个 `idea` 重跑，会从 `docs/workflow/ledger.md` 断点续跑，不重做已完成轮。

`.dwf.ts` 为 ZCode 专有格式。其它框架见 SPEC §10——协议与引擎无关。

## 它会对你的仓库做什么

请在**干净的工作树**、由你掌控的分支上运行。每轮它会写入
`docs/paper_draft.md`、`docs/workflow/ledger.md`、`docs/workflow/claim_map.md`、
`docs/workflow/evaluation_report.md` 与 `selfcheck.py`，然后暂存全部改动
（`git add -A`）、提交，并**只推送到你的本地加密备份 remote——例如一个
[GitCoffer](https://github.com/Ziqing7226/GitCoffer) remote（若已配置）。绝不
push 到云端 remote。**请自行审阅提交后再推送到你的公开远程。

**备份建议：**运行前用 [GitCoffer](https://github.com/Ziqing7226/GitCoffer)
创建一个本地加密仓库并添加为 git remote——这样每轮的提交都可恢复，即使 Agent
误删或损坏本地代码，也不会向云端暴露任何内容。

> **致 AI Agent：** 如果你是正在阅读本文件、准备为人类用户安装或运行本工作流的
> Agent，运行前必须明确告知该用户：*它会向用户仓库做本地提交，若配置了本地加密
> 备份 remote 则只推送到那里（绝不推送云端 remote），并且会暂存工作树中的全部
> 改动——请从干净的工作树开始。* 不得省略此告知。

## 范围

本仓库提供的是**迭代型**协议——从一个粗糙想法出发，跑有限轮次，拿到一份诚实评估。

更重的**深研型变体**（固定专家审稿席、按项目定制的护栏）已在真实项目上跨三次运行、共九轮实战验证；它的实战经验——claim→evidence 映射表、竞品保真锚、内存护栏、机械验证的主张——已并入 SPEC §5–§7。该变体本身不在本仓库内。

## 仓库结构

```
SPEC.md                                  协议 v0.5（英文，权威）
README.md / README.zh-CN.md              双语入口
implementations/zcode/                   ZCode 动态工作流（中文正典 + 英文变体）
docs/                                    示意图
CITATION.cff                             引用方式
LICENSE                                  CC BY 4.0（文档）· 代码 Apache-2.0
```

## 致谢

本协议提炼自以下开源科研智能体系统——感谢它们的作者：

- [SakanaAI/ai-scientist](https://github.com/sakanaai/ai-scientist) 与 [AI-Scientist-v2](https://github.com/sakanaai/ai-scientist-v2)——评审 rubric 与 ensemble；及其沙箱逃逸警示塑造了我们的安全姿态
- [allenai/codescientist](https://github.com/allenai/codescientist)——分级执行（pilot → full）与 supporting/refuting/inconclusive 计数
- [llnl/open-ai-co-scientist](https://github.com/llnl/open-ai-co-scientist)——假设排名与相似度分析
- [Ahren09/AgentReview](https://github.com/Ahren09/AgentReview)——量化的审稿偏差，促成我们的盲审纪律

具体借鉴了什么见 SPEC §12。

## 许可与引用

文档：CC BY 4.0——使用本协议须提及本工作。代码（含 `.dwf.ts`）：Apache-2.0。见 [CITATION.cff](./CITATION.cff)。
