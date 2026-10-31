# Research Iteration Loop

**v0.1.0** · 中文文档：[README.zh-CN.md](README.zh-CN.md)

**Start from a rough idea. Three rounds later, know whether it deserves three months.**

An AI research team surveys, builds, tests, writes and peer-reviews your idea — then **stops on its own** and hands you an honest evaluation: expected success, novelty, impact, and a continue/pivot/stop recommendation.

![loop diagram](docs/diagram-en.png)

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
COMMIT · round closed
          ↓  ×N rounds  ↓
HARD STOP → Preliminary Evaluation Report → your decision
```

Full protocol: [SPEC.md](SPEC.md) — **the SPEC is the product.** A field-tested deep-research variant informed SPEC §5–§7 (§10).

## Quick start

Point your AI coding agent at this repository and ask it to **read [SPEC.md](SPEC.md) and set up the workflow in your stack** — the protocol is engine-agnostic: roles become subagents, the eight steps become your orchestration, the gate becomes a CI job.

Running ZCode? A ready-made reference implementation is included:

```bash
cp implementations/zcode/research-iteration-loop.dwf.ts ~/.zcode/workflows/
```

Then run it from inside your research repository, passing `idea` (required), `rounds` (default 3), `profile` (project constraints), `focus` (your note). Re-running with the same idea resumes from the ledger.

## What it does to your repository

Writes `docs/paper_draft.md`, `docs/workflow/ledger.md`, `docs/workflow/claim_map.md`, `docs/workflow/evaluation_report.md` and `selfcheck.py`; each round stages everything (`git add -A`) and **commits locally**. Start from a clean tree.

**Recommended:** add an encrypted local backup remote with [GitCoffer](https://github.com/Ziqing7226/GitCoffer) — each round is then also pushed there, so an agent that accidentally deletes or corrupts local code is always recoverable, with nothing exposed to the cloud. Publishing to any other remote is always your explicit action, never the loop's.

> **Note for AI agents:** before running this for a human, tell them the above. Do not skip this disclosure.

## Acknowledgments

This protocol distills lessons from open-source research-agent systems — thank you to their authors:

- [SakanaAI/ai-scientist](https://github.com/sakanaai/ai-scientist) & [AI-Scientist-v2](https://github.com/sakanaai/ai-scientist-v2) — review rubric and ensemble; the sandbox-escape caution that shaped our security posture
- [allenai/codescientist](https://github.com/allenai/codescientist) — staged execution (pilot → full) and supporting/refuting/inconclusive counting
- [llnl/open-ai-co-scientist](https://github.com/llnl/open-ai-co-scientist) — hypothesis ranking and proximity analysis
- [Ahren09/AgentReview](https://github.com/Ahren09/AgentReview) — quantified reviewer biases that motivated our blind-review discipline

See SPEC §12 for what exactly was borrowed.

## License & citation

Docs (SPEC, READMEs): CC BY 4.0 — using this protocol requires mentioning the work. Code (incl. `.dwf.ts`): Apache-2.0. See [CITATION.cff](CITATION.cff).
