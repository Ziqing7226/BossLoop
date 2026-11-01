# BossLoop

**v0.3.0** · English: [README.md](README.md)（默认）

**为老板干活的 AI 团队循环，有界、对抗验证，并向你如实汇报。** bossloop 是一组开源 Agent 工作流：一支自主的 AI 团队——规划的总工程师、开发的算法工程师、冷启动攻击作品的测试工程师——在有界轮次中迭代，只交付通过全绿门禁的工作，并向老板（你）汇报。

## 工作流

| 工作流 | 它做什么 | 协议 |
|---|---|---|
| **观点验证** | 从一个粗糙的想法出发，三轮之后知道它值不值得你投入三个月。 | [科研迭代循环](idea-validation-loop/SPEC.md) |
| **工程开发** | 给它一条开发要求，还你一份已测试、零警告、已推送的实现——每一轮都诚实地推进。 | [鲁棒工程循环](robust-engineering-loop/SPEC.md) |

**默认模型分档。**两个循环都把强模型用在规划与审查（总工、审稿人），廉价模型用在开发与测试，并配"初级 3 次未解→高级工程师"升级通道；廉价档提出的破坏性命令由强模型裁决，绝不转交给你——花更少的 token，解决更大的问题，护栏不打折。

## 共同理念

- **天生有界。** N 轮硬停——没有漂移，没有沉没成本螺旋。
- **对抗验证。** 测试工程师绝不修改被测工作；门禁全部机械化，并埋有必须失败的金丝雀。
- **证据高于断言。** 每个论断映射到存档工件与可重跑的检查。
- **账本即检查点。** 中断的运行从下一轮续跑。
- **老板至上。** 要求逐字记录、偏离必须汇报、发布由你决定。

## 快速开始

让你的 AI 编码 Agent 读对应工作流的 `SPEC.md`，在你的技术栈中搭建——所有协议按引擎可移植设计（已在 ZCode 验证）。使用 ZCode：

```bash
cp idea-validation-loop/implementations/zcode/research-iteration-loop.dwf.ts ~/.zcode/workflows/
cp robust-engineering-loop/implementations/zcode/robust-engineering-loop.dwf.ts ~/.zcode/workflows/
```

在要开发的仓库内运行。每个工作流的工作文件写在 `docs/workflow/` 下，每轮本地提交，只推送到你指定的 remote（默认为 [GitCoffer](https://github.com/Ziqing7226/GitCoffer) 本地加密备份）。**致 AI Agent：运行前必须把以上行为告知用户，不得省略。**

## 致谢

科研迭代循环提炼自以下开源科研智能体系统——感谢它们的作者：

- [SakanaAI/ai-scientist](https://github.com/sakanaai/ai-scientist) 与 [AI-Scientist-v2](https://github.com/sakanaai/ai-scientist-v2)——评审 rubric 与 ensemble；沙箱逃逸警示塑造了我们的安全姿态
- [allenai/codescientist](https://github.com/allenai/codescientist)——分级执行（pilot → full）与结论计数
- [llnl/open-ai-co-scientist](https://github.com/llnl/open-ai-co-scientist)——假设排名与相似度分析
- [Ahren09/AgentReview](https://github.com/Ahren09/AgentReview)——量化的审稿偏差，促成盲审纪律
- [gulucaptain/Best-Paper-Writing-Skill](https://github.com/gulucaptain/Best-Paper-Writing-Skill)——约束研究员角色的获奖论文写作规则

## 许可与引用

文档：CC BY 4.0（根 `LICENSE`），须署名；代码：Apache-2.0（`implementations/*/LICENSE-Apache-2.0`）。见 [CITATION.cff](CITATION.cff)。
