# BossLoop

**v0.3.1** · 中文文档：[README.zh-CN.md](README.zh-CN.md)

**Bounded AI-team loops that work for the boss — and report to you.** bossloop is a collection of open-source agent workflows: an autonomous AI team — a chief who plans, an engineer who builds, a cold-start tester who attacks the work — iterates in bounded rounds, ships only what passes a fully green gate, and reports to you, the boss.

## The loops

| Workflow | What it does | Protocol |
|---|---|---|
| **Idea Validation** | Start from a rough idea. Three rounds later, know whether it deserves three months. | [Research Iteration Loop](idea-validation-loop/SPEC.md) |
| **Engineering Development** | Give it a requirement. Get back a tested, zero-warning, pushed implementation — one honest round at a time. | [Robust Engineering Loop](robust-engineering-loop/SPEC.md) |

**Tiered models by default.** Both loops put strong models on planning and review (chief, reviewers) and cheap models on build and test, with a junior→senior escalation path; destructive commands raised on the cheap tier are ruled on by the strong tier, never bounced back to you — fewer tokens, larger jobs, same guardrails.

## Shared philosophy

- **Bounded by design.** Hard stop after N rounds — no drift, no sunk-cost spiral.
- **Adversarial verification.** A tester who never edits the work; gates are mechanical and carry a must-fail canary.
- **Evidence over assertions.** Every claim maps to an archived artifact and a re-runnable check.
- **The ledger is the checkpoint.** Interrupted runs resume at the next round.
- **The boss is sovereign.** Requirements are recorded verbatim, deviations are reported, publishing is your call.

## Quick start

Point your AI coding agent at a loop's `SPEC.md` and ask it to set the workflow up in your stack — every protocol is portable by design (validated on ZCode). Running ZCode:

```bash
cp idea-validation-loop/implementations/zcode/research-iteration-loop.dwf.ts ~/.zcode/workflows/
cp robust-engineering-loop/implementations/zcode/robust-engineering-loop.dwf.ts ~/.zcode/workflows/
```

Run from inside the repository to be worked on. Each loop writes its working files under `docs/workflow/`, commits every round locally, and pushes only to the remote you name (default: a [GitCoffer](https://github.com/Ziqing7226/GitCoffer) encrypted local backup). **AI agents: disclose this to the human before running — do not skip.**

## Acknowledgments

The Research Iteration Loop distills lessons from these open-source research-agent systems — our thanks to their authors:

- [SakanaAI/ai-scientist](https://github.com/sakanaai/ai-scientist) & [AI-Scientist-v2](https://github.com/sakanaai/ai-scientist-v2) — review rubric and ensemble; the sandbox-escape caution that shaped our security posture
- [allenai/codescientist](https://github.com/allenai/codescientist) — staged execution (pilot → full) and outcome counting
- [llnl/open-ai-co-scientist](https://github.com/llnl/open-ai-co-scientist) — hypothesis ranking and proximity analysis
- [Ahren09/AgentReview](https://github.com/Ahren09/AgentReview) — quantified reviewer biases that motivated the blind-review discipline
- [gulucaptain/Best-Paper-Writing-Skill](https://github.com/gulucaptain/Best-Paper-Writing-Skill) — award-paper writing rules that govern the Researcher role

## License & citation

Docs: CC BY 4.0 (root `LICENSE`), attribution required; code: Apache-2.0 (`implementations/*/LICENSE-Apache-2.0`). See [CITATION.cff](CITATION.cff).
