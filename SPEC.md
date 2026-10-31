# Research Iteration Loop

**SPEC v0.5** · repo: `research-iteration-loop`

> Start from a rough idea. Iterate it through bounded, adversarial cycles. Stop on schedule and report whether it deserves more of your life.

This protocol describes an AI research team that surveys, builds, tests, writes, and peer-reviews — then hard-stops and hands back an honest evaluation. It is engine-agnostic; reference implementations live in `implementations/`.

---

## 1. Bound

Iterate, don't perfect. The loop **hard-stops after N rounds (default 3)** and produces a Preliminary Evaluation Report. A human decides what continues. Every round is a full peer-review cycle; the reviews double as the next round's plan.

## 2. Roles

| Role | Responsibility |
|---|---|
| **Chief Engineer** | Recover context from the ledger (resume, never redo); internalize the boss's requirements; survey (web + local paper library). Post a **paper-fetch request list** for inaccessible papers (non-blocking: proceed with lower confidence, don't stall). Maintain a **dynamic proposal portfolio**: re-select 1–3 proposals every round from the latest reviews (add, drop or replace; fill to 3 when choices exist, never 0) plus the competitor set. **Novelty handling:** if the idea turns out to be already done, do not stop — re-scope toward the unsolved gap inside that direction and run all remaining rounds. |
| **Algorithm Engineer** | Build proposals / reproduce competitors. Real runs only; every number carries its exact definition. **Staged execution:** every new experiment runs MINI_PILOT (smoke) → PILOT (small-data correctness) → FULL (full-protocol comparison); stages before FULL are for debugging only — all archived numbers and claims come from FULL runs, and a minimal comparison passed off as validation is forbidden. **Freeze rule:** while the Test Engineer verifies, the implementation under test is not modified — a moving target makes the verdict void. |
| **Test Engineer** | Independent verification: code review; roundtrip incl. adversarial inputs; generalization across scenes/datasets; perturbation stability. Owns the claim→evidence map and the self-check. **Independence:** never edits the implementation under test — a verifier who fixes makes verification self-serving. |
| **Researcher** | Revise the manuscript once per round (after engineering, before review); create the first draft if none exists. Only artifact-backed numbers; gaps stay explicit `[TODO]`. |
| **Editor** | Extract keywords; invite reviewers from adjacent, non-overlapping fields — **how many (≤3) is the Editor's call** — plus 1 reader who has read every reference. Reviews must carry both issues and iteration proposals. **Blind-review discipline:** briefs are anonymized (no author/affiliation/project identity), reviewers never see each other's opinions (the orchestrator aggregates), and should the engine allow it, reviewers run on a different model than the builders — decorrelating reviewer and author error modes. Briefs stay tight: manuscript + claim map + targeted questions, never the whole repo. |
| **Reference Reader** | Read every reference; verify citations and narrative. **Per-round novelty check (mandatory):** name the 3 closest existing works and state in which dimension the idea differs (problem setting / mechanism / scope) — evidence for the report, never a stop signal. |
| **Boss (human)** | Supply the idea and the project constraints; fetch requested papers; read the round-N report; decide continue / pivot / stop. |

Why the engineer looks idle during testing: verification must be independent of authorship. The engineer's job in that window is to freeze the implementation, prepare the reproducibility package, and respond to gate failures.

## 3. One round

```
1  CHIEF     read ledger → resume point; survey web + local library
             └─ inaccessible papers → fetch-request list (non-blocking)
2  CHIEF     issue work cards: "reproduce competitor A", "try proposal 2", …
3  ENGINEER  build + self-test (implementation frozen from here)
4  TEST      independent verification + self-check + claim map → verdicts
5  CHIEF     dispatch fixes & extra experiments; ENGINEER executes
6  RESEARCHER revise (or create) the manuscript
7  EDITOR    keywords → invite adjacent-field reviewers + full-reference reader
8  ALL       append the round to the ledger; commit and push to the encrypted
             local backup remote (GitCoffer) — never to cloud remotes
```

## 4. Transitions and the gate

- **Next round, no boss input**: the Chief turns review issues into task cards (each issue → a task or an explicit rebuttal-on-artifacts).
- **After round N: hard stop → Preliminary Evaluation Report** — verdict, expected success (labelled as a qualitative judgement expressed numerically, not a calibrated probability), novelty, impact, risks, reviewer verdicts quoted verbatim. Wait for the boss.
- **Round 1 must end with at least one end-to-end number from a properly powered comparison.** Toy or minimal comparisons that could bias conclusions do not count as validation — staged smoke/pilot runs exist for debugging only.

## 5. Evidence rules

1. **Claim→evidence map** (Test Engineer): every manuscript number ↔ an archived artifact + a re-runnable check. No map entry, no claim. *Write the check before building the claim.*
2. Meeting-note numbers ≠ archived numbers. Claimed edits are verified mechanically, never by paraphrase.
3. Survey/predictive numbers must survive an end-to-end run before entering any document.
4. Retraction is a normal action: log what was wrong, how it was caught, what is correct now.
5. **The gate has a canary**: at least one deliberately-broken control case that must FAIL, marked so the orchestrator can find it by search. A suite that cannot go red proves nothing — and self-reported quality is not a gate: both the canary and the claim map are **verified mechanically**, not taken on trust.
6. **Competitors carry fidelity anchors**: reproduction within plausible range of the published numbers, deviations documented. Whoever builds your method must not grade the competitors.
7. **Experiment mortality is tracked and reported**: every round logs experiments attempted vs passed (honestly counting debug-stage deaths); the Preliminary Evaluation Report must cite this trend as evidence — a high debug mortality is itself a feasibility signal.

## 6. Safety for unattended runs

Subprocess per batch/scene; write results to disk immediately and exit to free memory; a hard memory cap and timeouts **in code**; staged pilot runs before full runs; datasets and existing artifacts read-only; never push to cloud/shared remotes (backups go to an encrypted local remote, see §7). Agent-written code is **untrusted**: prefer containerized or network-restricted execution where available — but treat containment as risk reduction, not a guarantee (sandbox escapes by capable code are a documented reality).

## 7. Unattended runs and recovery

- The **ledger is the checkpoint**. Every round appends its task, artifacts, gate status, reviews and next direction.
- A run interrupted by a crash, a dropped model stream or a quota stop is **resumed, not restarted**: same run if the engine supports it, otherwise a fresh run reads the ledger and continues at round N+1 (the Chief reports `resumeFrom`).
- An external watchdog (cron, CI schedule) may poll run status and resume interrupted runs. It must **never** resume a run a human stopped on purpose.
- The loop **pushes only to an encrypted local backup remote** — [GitCoffer](https://github.com/Ziqing7226/GitCoffer) builds one locally: after every round the work is committed and pushed there in encrypted form, giving a recovery path when an agent accidentally deletes or corrupts local code, without exposing anything to the cloud. It never pushes to cloud/shared remotes unless the boss explicitly says so.
- Because recovery depends on the ledger, a round that fails to append is the one failure that costs work.

## 8. Domain profiles

Project-specific constraints travel in a `profile` string injected into every role: hardware/memory ceilings, read-only data rules, forbidden practices (e.g. no simulators), required baselines, backup policy, language. This keeps one protocol usable across fields without forking it.

## 9. Configuration

| Parameter | Default | Note |
|---|---|---|
| `rounds` | 3 | total rounds before the hard stop |
| `idea` | — | required; the rough idea, one paragraph |
| `focus` | "" | the boss's note for this run |
| `profile` | "" | project constraints (see §8) |
| proposal portfolio | re-selected every round | 1–3, Chief's call per round; never 0 |
| max reviewers | 3 adjacent + 1 full-reference reader | bounds only — actual count is the Editor's call |

## 10. Implementations and scope

- **ZCode** — `implementations/zcode/*.dwf.ts`: ZCode-specific format; copy into `~/.zcode/workflows/` and run from inside the research repo. The gate calls `python selfcheck.py` — change that argument if your interpreter is `python3`. Chinese-UI file is canonical; `*.en.dwf.ts` is protocol-identical.
- **Any framework** — roles → subagents, steps 1–8 → graph nodes or an orchestration script, the gate → a CI job, the ledger → a repo file, `profile` → project config.
- **Scope** — this repository ships the *iteration* protocol. A heavier deep-research variant (fixed specialist reviewer bench, domain guardrails) was field-tested on a real project over nine rounds in three runs; its lessons are folded into §5. It is not included here.

## 11. License

Docs: **CC BY 4.0** — using the protocol requires mentioning this work. Code (incl. `.dwf.ts`): **Apache-2.0**. See `CITATION.cff`.

## 12. Prior art

Design lessons folded in from open-source systems: the AI-Scientist's review module (numeric rubric, ensembled reviews with a meta-review) and its documented sandbox-escape risk; CodeScientist's staged execution (pilot → full) and supporting/refuting/inconclusive counting; the AI co-scientist's ranking and proximity analysis; AgentReview's quantified reviewer biases (identity disclosure alone flips a large share of decisions), which motivated the blind-review discipline. `claim_map` as a standardized JSON schema is a possible future extension.
