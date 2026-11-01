# Robust Engineering Loop

**v0.2.8** · collection: `bossloop` · sibling: [Research Iteration Loop](../idea-validation-loop/SPEC.md)

> Give it a requirement. Get back a tested, zero-warning, pushed implementation — one honest round at a time.

This protocol describes an AI engineering team that plans a bounded set of rounds up front, develops one round per commit, and submits every round to **cold-start adversarial testing** before it is pushed anywhere. It is portable by design (validated on ZCode); reference implementations live in `implementations/`.

---

## 1. Bound

Ship iteratively, but never unverified. The Chief commits **before round 1** to N rounds with a one-line scope each (the boss may fix N via config); after round N the loop hard-stops and produces the Final Report to the boss. Finishing early is allowed once every requirement has a closed entry in the requirement map and the gate is green; **extending N is a boss decision** — a major issue, handled by interrupt, never improvised.

## 2. Roles

| Role | Responsibility |
|---|---|
| **Chief Engineer** *(strong tier)* | **Requirement intake:** before round 1, record the boss's words **verbatim** in the requirement ledger, each with interpretation and acceptance criteria; if the requirement is ambiguous in a way that changes scope, ask before starting — the only blocking question. **Round planning:** commit to N rounds with per-round scopes; re-plan each round from the ledger (last round's verdict, findings, rebuttals, remote-CI carryover); every work card traces to a requirement. **Arbitration:** decide finding-vs-rebuttal disputes on evidence. **Interrupt policy:** major issues (infeasible requirement, scope-changing ambiguity, extending N, gate still red after the attempt cap) → stop the loop and write a mid-run report to the boss — a destructive operation is not itself an interrupt trigger: it goes to the §7 ruling (junior declarations → Senior Engineer; the Senior Engineer's own escalation-phase declarations → the Chief), and only a round that still cannot proceed after the ruling is interrupted; minor issues (implementation details inside scope, tooling choices, ordering) → decide autonomously and log the decision. **Final Report:** every requirement → outcome → evidence, deviations with reasons, final state, decision list. |
| **Algorithm Engineer** *(junior tier — cheap model)* | Implement the round's cards; **one local commit per round**. **Docs are a deliverable:** professional, clean and concise — one home per fact, no redundant or duplicated information; every code change ships with its doc change in the same commit. The tree is frozen while the tester verifies. On findings: **reproduce first** — confirmed findings get fixes, misdiagnoses get evidence rebuttals; blind fixes are forbidden. Fixes land as `git commit --amend` on the round commit — never on pushed history. The dev report (with per-requirement coverage) goes to the Chief for planning, **never to the Test Engineer**. |
| **Senior Engineer** *(strong tier)* | Escalation path: takes over any finding the junior-tier Algorithm Engineer could not solve in 3 fix attempts — read the gate output and ledger, fix the root cause in one pass, under the same one-commit amend discipline. May declare a finding a genuine blocker (→ interrupt). Engaged only on escalation; the junior stays the default builder. |
| **Test Engineer** *(cheap tier)* | **Cold start every round** (large diffs: inventory first, deep-read the high-risk areas, and declare what was only skimmed — see §4.7)**:** a fresh context that receives the diff and the repo — never the author's claims. Review `diff(baseline..HEAD)` (what changed, not what was claimed) — including doc quality: professional, concise, free of redundant or duplicated information. Build and maintain the robustness suite (boundary and adversarial inputs, perturbation where applicable) and `selfcheck.py` with a must-fail **canary**. If the repo has CI, run the local CI equivalent — all green. **Strict build:** warnings are errors (`-Werror` / `/WX` / `-D warnings` / `deny(warnings)` per language). **Remote-CI carryover:** check the previous round's push on the agreed remote; failures become mandatory fix items this round. Independence: never edits the implementation — owns `selfcheck.py`, the robustness suite, and the verification column of the requirement map. Every finding carries reproduction evidence; after a fix, re-runs the original failing check to confirm closure. |
| **Boss (human)** | State the requirement in their own words (verbatim input); optionally fix N; name the push remote (default: a GitCoffer local encrypted backup; may name GitHub or any other); read round digests and the Final Report; decide on interrupts. |

The *orchestrator* is the engine layer that runs the loop (workflow runtime, script, or CI) — not a persona.

Why the tester starts cold: a tester who has read the author's claims anchors on them. The diff and the code are the tester's only inputs; the engineer's report flows to the Chief for planning.

## 3. One round

```
1  CHIEF     read ledger → resume point; check last round's push on the
             agreed remote — remote-CI failures become mandatory fix cards
2  CHIEF     issue this round's work cards (each traced to a requirement)
3  ENGINEER  develop + docs → ONE local round commit
4  TEST      COLD START on diff(baseline..HEAD): diff review · robustness
             suite + canary · local CI green · strict zero-warning build
             → verdict: pass | findings, each with reproduction evidence
5  ENGINEER  triage every finding (confirmed → fix; misdiagnosis →
             evidence rebuttal) → amend the round commit → TEST
             re-verifies  (junior attempts 1–3, then senior-engineer
             escalation 4–10; still red → interrupt)
6  PUSH      round commit → the agreed remote (append-only, never force)
7  CHIEF     append ledger (docs-only commit, pushed right after) →
             next round | Final Report
```

## 4. The gate

Mechanical checks run by the orchestrator, never taken on trust:

1. **Round commit exists** and `diff(baseline..HEAD)` is non-empty.
2. **Amend discipline:** after fixes, HEAD changed *and* the baseline is unchanged — a round never rewrites history below itself.
3. **selfcheck.py exits 0** and contains a grep-able `canary` marker — a suite that cannot go red proves nothing.
4. **Push verified:** after pushing, the remote's HEAD equals the local HEAD.
5. **Remote CI of the previous push** is checked via the CI CLI where available (e.g. `gh run list/view` on GitHub remotes); where not checkable, the ledger says so honestly — an unchecked CI is never reported as passed.
6. **Destructive-operation consistency:** every executed dangerous command must line up with a declaration, a ruling, and the approved form (the executor reports what it actually ran; the orchestrator compares). A mismatch fails the gate.
7. **Coverage statement:** the tester's verdict states which files/areas were reviewed deeply and which were only skimmed (the orchestrator measures diff size and reports it; no fixed threshold). The statement is written before findings are known — a later problem in a skimmed area is reconciled against it.

## 5. Evidence rules

1. **Requirement→evidence map** (Test Engineer owns the verification column): every boss requirement ↔ implementation location ↔ re-runnable check. No map entry, no "done". *Write the check before claiming done.*
2. Findings carry reproduction (command + output). A fix is verified by re-running the failing check, never by narrative.
3. Rebuttals carry evidence (command output, spec citation). Only the Test Engineer arbitrates a rebuttal; both sides are logged in the ledger.
4. Reports quote exit codes and command outputs, never paraphrases.
5. Push and remote-CI states are quoted from git/CI output, not assumed.

## 6. Misdiagnosis discipline

- **Reproduce before repairing.** An unreproducible finding is a rebuttal candidate, not a to-do.
- **Blind "fixes" of non-issues are forbidden** — churn masks real regressions and pollutes the round diff.
- A finding is closed by evidence: after the fix, the tester re-runs the original failing check.
- Disputes escalate on evidence: Test Engineer → Chief → boss (major). Nobody grades their own work.
- Misdiagnosis counts are tracked per round in the ledger — a tester whose findings are mostly rebutted, or an engineer whose rebuttals are mostly wrong, is a process signal the Chief acts on.

## 7. Push policy, destructive operations and safety

- The loop pushes **only to the agreed remote** — default: a local encrypted backup built with [GitCoffer](https://github.com/Ziqing7226/GitCoffer); the boss may name any other (GitHub, internal, …). If no agreed remote exists, pushes are skipped, loudly logged, and listed in the Final Report — the loop never falls back to another remote on its own.
- **Append-only history:** never force-push, never rewrite pushed history; `amend` only before push, within the round. History is evidence.
- **Destructive operations are adjudicated, not improvised.** Deleting files or directories, dropping data, `git reset --hard`, `git clean -fdx`, force pushes, rewriting pushed history and overwriting artifacts must be **declared** (`dangerRequests`: exact command, reason, blast radius) and **never executed unilaterally** by the cheap tier. The **Senior Engineer** (strong tier) rules each request: `reject`, `approve-with-change` (a narrower safe form — scoped path, dry-run first, backup first, list the affected files first) or `approve`. Only the approved form runs, amended into the round commit.
- **The ruling never goes back to the boss.** This is an automation guarantee: routine deletions do not become questions for the user. Only a round that genuinely cannot proceed without the operation (a corrupted artifact must be removed, an index rebuilt) reaches the interrupt path — and the ledger records every ruling.
- Agent-written code is untrusted: prefer containerized or network-restricted execution where available — containment is risk reduction, not a guarantee.
- **What stays boss-only:** changing remotes, and any destructive operation whose blast radius escapes the round's workspace — the Senior Engineer marks these and only then does the interrupt path engage.

## 8. Commit topology

Each round is **one round commit** (development + docs + test-suite updates, amended until the gate is green, pushed once) followed by **one ledger commit** (Chief, docs-only, pushed right after). The next round's baseline is the ledger commit, so every round's diff stays pure. Baselines and pushed SHAs are recorded explicitly in the ledger.

## 9. Unattended runs and recovery

The **ledger is the checkpoint**. Every round appends its cards, verdicts, rebuttals, gate status, baseline/pushed SHAs and next direction. An interrupted run **resumes** at round N+1 (the Chief reports `resumeFrom`) — it never redoes finished rounds. A round that fails to append is the one failure that costs work. An external watchdog may resume interrupted runs but must never resume a run a human stopped on purpose.

## 10. Boss fidelity

- The requirement ledger (`docs/workflow/requirements.md`) exists **before round 1**: the boss's words verbatim, interpretation, acceptance criteria.
- Requirements are never silently contradicted. Every deviation is justified and listed in the Final Report — reason plus the alternative chosen.
- The Chief does not get to reclassify a clearly boss-facing tradeoff (scope, schedule, quality bar, budget) as minor. Major → interrupt and report mid-run; minor → decide and log.
- The Final Report maps every requirement, quoted verbatim, to its outcome and evidence — nothing is silently dropped.

## 11. Model tiers and escalation

Roles run on two model tiers by default (`models=tiered`; `uniform` puts every role on the session model):

- **Strong tier** — Chief Engineer, Senior Engineer: analysis, planning, arbitration.
- **Cheap tier** — Algorithm Engineer (junior), Test Engineer: hands-on build and verify. Safe exactly because the gate is mechanical — quality is decided by selfcheck/CI/the zero-warning build, never by model self-report.

**Junior→senior escalation:** a finding the junior cannot solve in **3 fix attempts** escalates to the Senior Engineer (strong model) with the failed attempts in context; attempts 4–10 of the gate loop run on the senior, under the same amend discipline. The executor never rules on its own declarations: escalation-phase destructive requests are adjudicated by the Chief. Escalations are counted per round in the ledger — a high escalation rate is a signal that the tiering or the task split is wrong, and the Chief acts on it.

**Portability:** tier assignment is engine config, not protocol. Any strong/cheap pair works; the cheap tier may be a locally deployed model (e.g. Qwen4) where the engine allows it.

## 12. Domain profiles

Project constraints travel in a `profile` string injected into every role: build/test/lint commands **with their strict flags**, CI flavor and its local equivalent, forbidden practices, resource ceilings, documentation language. One protocol across stacks without forking it — and no guessing build systems.

## 13. Configuration

| Parameter | Default | Note |
|---|---|---|
| `requirement` | — | required; the boss's requirement, verbatim |
| `rounds` | 0 (Chief plans) | boss-fixed total round count; once set, hard stop |
| `remote` | `gitcoffer` | agreed push target: auto-detected GitCoffer remote, or a remote name / URL, or `none` to disable pushes |
| `profile` | "" | project constraints (see §12) |
| `models` | `tiered` | tiered = strong tier for Chief/Senior, cheap tier for Engineer/Tester; `uniform` = session model for all |
| `focus` | "" | the boss's note for this run |

## 14. Implementations and scope

- **ZCode** — `implementations/zcode/*.dwf.ts`: copy into `~/.zcode/workflows/` and run from inside the project repository being developed. The Chinese-UI file is canonical; `*.en.dwf.ts` is protocol-identical.
- **Any framework** — roles → subagents, steps 1–7 → graph nodes or an orchestration script, the gate → a CI job, the ledger → a repo file, `profile` → project config.
- **Scope** — this protocol ships the *development* loop. The requirement map, cold-start testing and amend discipline are engine-agnostic; the remote-CI check degrades honestly when no CI CLI exists.

## 15. License

Docs: **CC BY 4.0** — redistributing or adapting the documentation requires attribution; if the protocol helps you, please cite the work (`../CITATION.cff`). Code (incl. `.dwf.ts`): **Apache-2.0**.

## 16. Design lineage

The backbone comes from the [Research Iteration Loop](../idea-validation-loop/SPEC.md) (same collection): bounded rounds, the independent tester, the canary, ledger recovery, the GitCoffer posture. This loop diverges where engineering differs from research: **push-by-agreement** instead of never-push (remote verification requires a remote), a **requirement map** instead of a claim map, **cold-start** testing (stronger than sibling independence), a **zero-warning** gate, **misdiagnosis discipline**, and the **single-commit amend round**. The engineering habits it enforces — warnings-as-errors, small reviewable commits, append-only history, reproduce-before-repair — are old discipline; the protocol's job is making agents obey it.
