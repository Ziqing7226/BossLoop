# Skill: Math Proof

Machine-checked theorem proving for the research loop, on Lean 4 + Mathlib. Consumed by the Research Iteration Loop: the Algorithm Engineer formalizes and proves during derivation, the Researcher re-verifies manuscript proofs at writing time, reviewers attack statement fidelity at review time — the Chief judges when to formalize (§1) and the Test Engineer re-runs the gate in the selfcheck (§4). Companion skills: [paper-writing.md](paper-writing.md) (how to write what you proved), [paper-search.md](paper-search.md) (how to find what others proved). Usable standalone.

---

## 0. The one doctrine

**The type checker is the only referee.** A proof is trusted when — and only when — all three hold:

1. it compiles: `lake env lean <file>` exits 0;
2. it carries no `sorry`/`admit` in any proof body (they compile too — `sorry` is an axiom in disguise);
3. `#print axioms <theorem>` for every theorem the paper cites lists only the three standard axioms: `propext`, `Classical.choice`, `Quot.sound`.

Compile exit 0 alone proves nothing. Statements are contracts: a statement is written once, then defended — never edited to let its proof go through (that is how a formalization quietly changes the proposition it claims to prove).

## 1. When to formalize

Formalization is expensive; spend it only where the paper leans on the mathematics:

- **Formalize** the load-bearing claims: a theorem or lemma, a bound, a convergence proof, an equivalence, a correctness guarantee — claims whose falsehood would sink the paper's headline conclusion.
- **Do not formalize** routine algebra a computation already checks, empirical claims (they belong to experiments and the claim→evidence map), or decorative mathematics.
- The math-claims judgment is standing, with three triggers: the boss's words demand a proof (mandatory card); the opening spec table finds load-bearing formalizable claims; or any role spots a suspected simple, effective pattern in the data or the literature — a conjecture — and the Chief weighs proof against experiment. A conjecture proven in Lean becomes a theorem, the strongest evidence form; an experiment that verifies it equally well counts. A run with empirical-only claims keeps this skill dormant at zero cost.

## 2. Environment

- Install the toolchain with elan (per the official [lean-setup guide](https://github.com/leanprover/skills/tree/main/skills/lean-setup)); a project is a lake project with the Mathlib dependency; fetch the Mathlib cache (`lake exe cache get`) before building.
- Probe before use: `elan --version`, `lake --version`. No working toolchain → set one up (install elan per the guide, fetch the cache) and record the install — the user is told through the report; if setup is genuinely impossible (no network, no permission), record it and leave the claim honestly unstamped — never substitute a non-proving tool, never fake a stamp.

## 3. Proving methodology

One tactic at a time: write a single tactic, compile, and confirm closure with `done` — it errors while any goal remains unsolved; read the error, repeat. Handle errors in priority order — syntax → type-checking → unsolved goals → linter warnings — fixing the first one; later ones are usually its echoes. Start from the hardest case (if the core lemma resists, the plan is wrong — find out early). `sorry` appears only as a marked placeholder during work, never in a finished state; a proof session ends with zero sorries or an honest report. Once done, clean up: inline one-off lemmas, drop unused hypotheses, keep names readable.

## 4. The mechanical gate

Every formalized claim passes one gate, and the output is archived as a stamp (round and attempt in the name — e.g. `_r2_lean_check_run1.log` — an earlier stamp is never overwritten):

```bash
lake env lean <file>.lean                   # 1. exit 0
grep -nE '\bsorry\b|\badmit\b' <file>.lean  # 2. no hits inside proof bodies
# 3. '#print axioms <thm>' appended per cited theorem — output shows the three standard axioms only
```

The Test Engineer's selfcheck re-runs this gate on every stamp on file and checks that every theorem written as "proven" carries one — a stamp or claim-map row missing where the paper says proven is a red line; a failed proof honestly downgraded (§7) is a ledger row, not a finding.

## 5. Statement fidelity

The manuscript and the proofs must say the same thing:

- One map row per formalized theorem: manuscript statement ↔ Lean declaration ↔ stamp file.
- The manuscript's theorem statements correspond to the Lean declarations one for one — same hypotheses, same conclusion, same quantifier scope. A mismatch is a finding (statement drift).
- An unproven claim — unformalized, or a proof that failed — is written as what it is: a conjecture or an empirical observation, never dressed in theorem clothing; the downgrade is a ledger row and never blocks the round.

## 6. Disprove first

When a proof stalls, hunt the counterexample before hammering: probe with concrete instances (`#eval`), search degenerate cases, try the claim with its strongest hypothesis removed. A certified refutation is a result — it kills a wrong claim early and cheaply. An unprovable-as-stated claim goes back to the Chief (an idea-flawed verdict, ledgered); it is never silently weakened into something provable but different.

## 7. When a proof fails

A failed proof never blocks the workflow. One serious attempt per card per round: counterexample first (§6); when the attempt fails, the ledger records the failure with its evidence and the claim is downgraded in the manuscript to a conjecture or an empirical observation — then the round moves on to the rest of its work. A problem recognized as far beyond this project's scale (an open problem of Fields-medal caliber) is recorded as too hard in the ledger and abandoned — the workflow's time stays on the main line, and a retry happens only when the Chief re-cards it on new grounds (new literature, a new method). The stamp stays the only voucher for "proven": the gate guards honesty, never progress.

## 8. For reviewers

Reviewers of formalized claims receive the .lean files and the axiom report in the brief, and attack the two things the type checker cannot judge: **statement fidelity** — did the formalization quietly change the proposition (weaker hypotheses, narrower scope, a redefined object)? — and **weight** — does the formalized claim actually back the paper's headline conclusion, or is it a formal proof of something marginal dressed as the main theorem?

---

*Methodology distilled from [leanprover/skills](https://github.com/leanprover/skills) (lean-proof: one-step-at-a-time proving, error priority, sorry handling) and [cameronfreer/lean4-skills](https://github.com/cameronfreer/lean4-skills) (the axiom doctrine and statement preservation), 2026-11.*
