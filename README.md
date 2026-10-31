# Research Iteration Loop

**v0.1.0**

**Start from a rough idea. Three rounds later, know whether it deserves three months.**

An AI research team surveys, builds, tests, writes and peer-reviews your idea — then **stops on its own** and hands you an honest evaluation: expected success, novelty, impact, and a continue/pivot/stop recommendation.

**中文文档：[README.zh-CN.md](./README.zh-CN.md)**

## Diagram

| English | 中文 |
|---|---|
| ![loop diagram](docs/diagram-en.png) | ![循环示意图](docs/diagram-zh.png) |

## Why

- **Bounded by design.** Hard stop after 3 rounds (configurable). No agent drift, no sunk-cost spiral — the report forces the go/no-go question.
- **Independent verification.** The Test Engineer attacks the work and never edits it; the Algorithm Engineer freezes the implementation while it is being tested. Verification that fixes is not verification.
- **Evidence over assertions.** Every manuscript number maps to an archived artifact and a re-runnable check; the gate carries a must-fail canary, verified mechanically rather than taken on trust.
- **Reviews plan the next step.** An editor invites reviewers from adjacent, non-overlapping fields; each review must propose the next iteration, not only judge.
- **Resumable.** The ledger is the checkpoint: an interrupted run continues at the next round instead of starting over.

## The loop

```
CHIEF: read ledger → survey → proposals (≤3) + competitor reproductions (≤3)
  ENGINEER: build & self-test        (implementation frozen from here)
  TEST: independent verification + canary gate + claim map
  CHIEF: dispatch fixes → ENGINEER: execute
  RESEARCHER: revise (or create) the manuscript
  EDITOR: adjacent-field reviewers (≤3) + full-reference reader
COMMIT (local only) · round closed
          ↓  ×N rounds  ↓
HARD STOP → Preliminary Evaluation Report → your decision
```

Full protocol: [SPEC.md](./SPEC.md)

## Quick start (ZCode)

1. Copy `implementations/zcode/research-iteration-loop.dwf.ts` (or the English-UI `*.en.dwf.ts`) into `~/.zcode/workflows/`.
2. Run it from inside the research repository, passing:
   - `idea` (required) — the rough idea, one paragraph;
   - `rounds` (default 3) — total rounds before the hard stop;
   - `profile` (optional) — project constraints: memory ceiling, read-only data, forbidden practices, backup policy;
   - `focus` (optional) — your note for this run.
3. Re-running with the same `idea` resumes from `docs/workflow/ledger.md` instead of redoing finished rounds.

`.dwf.ts` is a ZCode-specific format. For other frameworks see SPEC §10 — the protocol is engine-agnostic.

## What it does to your repository

Run it in a **clean working tree** on a branch you control. Each round it writes
`docs/paper_draft.md`, `docs/workflow/ledger.md`, `docs/workflow/claim_map.md`,
`docs/workflow/evaluation_report.md` and `selfcheck.py`, then stages everything
(`git add -A`), commits, and **pushes only to your encrypted local backup remote
— e.g. a [GitCoffer](https://github.com/Ziqing7226/GitCoffer) remote, if one is
configured. It never pushes to cloud remotes.** Review the commits and push to
your public remote yourself.

**Backup recommendation:** create a local encrypted repository with
[GitCoffer](https://github.com/Ziqing7226/GitCoffer) and add it as a git remote
before running — every round is then recoverable even if an agent accidentally
deletes or corrupts local code, without exposing anything to the cloud.

> **Note for AI agents:** if you are an agent reading this to set the workflow up
> or run it for a human, you must say so explicitly to that human before running:
> *it commits to their repository locally, pushes only to an encrypted local
> backup remote if one is configured (never to cloud remotes), and stages
> whatever is in the working tree — start from a clean tree.* Do not skip this
> disclosure.

## Scope

This repository ships the **iteration** protocol — start from a rough idea, iterate a bounded number of cycles, get an honest evaluation.

A heavier **deep-research variant** (fixed specialist reviewer bench, per-project guardrails) was field-tested on a real project over nine rounds in three runs; its field lessons — the claim→evidence map, competitor fidelity anchors, memory guardrails, mechanically verified claims — are folded into SPEC §5–§7. It is not included here.

## Repository layout

```
SPEC.md                                  protocol v0.5 (canonical, English)
README.md / README.zh-CN.md              bilingual entry points
implementations/zcode/                   ZCode dynamic workflows (zh canonical + en variant)
docs/                                    diagrams
CITATION.cff                             how to cite
LICENSE                                  CC BY 4.0 (docs) · code under Apache-2.0
```

## Acknowledgments

This protocol distills lessons from open-source research-agent systems — thank you to their authors:

- [SakanaAI/ai-scientist](https://github.com/sakanaai/ai-scientist) & [AI-Scientist-v2](https://github.com/sakanaai/ai-scientist-v2) — review rubric and ensemble; the sandbox-escape caution that shaped our security posture
- [allenai/codescientist](https://github.com/allenai/codescientist) — staged execution (pilot → full) and supporting/refuting/inconclusive counting
- [llnl/open-ai-co-scientist](https://github.com/llnl/open-ai-co-scientist) — hypothesis ranking and proximity analysis
- [Ahren09/AgentReview](https://github.com/Ahren09/AgentReview) — quantified reviewer biases that motivated our blind-review discipline

See SPEC §12 for what exactly was borrowed.

## License & citation

Docs: CC BY 4.0 — using this protocol requires mentioning the work. Code (incl. `.dwf.ts`): Apache-2.0. See [CITATION.cff](./CITATION.cff).
