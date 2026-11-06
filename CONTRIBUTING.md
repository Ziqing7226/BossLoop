# Contributing to BossLoop

BossLoop is a collection of agent-workflow protocols; the SPECs are the product, the implementations are engine-portable references. It exists so that the boss states a requirement in their own words and receives a tested, honest, high-quality delivery with minimal supervision.

This file is the boss's standing word for anyone advancing the project in the boss's absence: follow it as you would follow the boss. Where this file and the boss's words diverge, the boss's words win — treat the divergence as a bug in this file.

**Scope.** The inclusion test for every line below: a developer iterating the workflows must know it to iterate in the right direction. What the loops already settle internally — runtime policies, role mechanics, model tiering, gates — lives in the SPECs; restating it here is rejected as redundancy. When a change touches a loop's internals, that loop's SPEC is the authority alongside this file.

## The philosophy

**P1 Occam's razor.** Nothing is added without necessity: the simplest process that works beats a cleverer complicated one, and a clause whose cost exceeds its benefit is dropped however sensible it sounds. Its manifestations are binding: documents are concise and carry no redundant information; the SPECs are the solution and carry nothing unrelated to it — rules and verdicts, not the story of how the rules were learned; the boss-facing surface stays minimal.

**P2 The protocol is the asset.** The protocol files are the most valuable thing in this repository; within a protocol, process comes first, then constraints, then skills. SPECs are normative and engine-portable; implementations are references. Skills serve the AI that uses them — a constraint that does not improve the outcome has no place in a prompt — and disclosure of AI usage follows the venue's stated policy.

**P3 Self-consistency.** The workflows do not contradict themselves — clause against clause, language against language, document against mechanism. A contradiction found anywhere is fixed everywhere in the same pass.

**P4 Unambiguous wording.** A protocol that contains an ambiguous sentence is garbage. Every clause, in both languages, is decidable: a reader cannot honestly disagree about what it commands.

**P5 Courteous voice.** The README and every boss-facing text is polite; comparisons stay professional and never disparage.

**P6 Careless-error check.** Every change is reviewed for careless errors after it is made and before it is pinned; the review is a fresh read of the full diff, not the author's memory of it.

**P7 Default skepticism.** A proposed clause is questioned first and analyzed second; it lands only if the analysis holds. Field validation is the strongest evidence and always the hope, never the bar — a logically sound clause is not rejected for lacking a deployment, and a defect found in the field folds back into the protocol, not into a one-off patch.

**P8 The boss's words.** The boss's words are quoted verbatim and scrutinized for meaning — verbatim fidelity is not semantic fidelity — and doctrine is re-derived from the complete record, from the founding sentence to the latest ruling, never frozen at the start and never captured by the latest round.

**P9 Verify by adversary.** Work is judged by a fresh verifier in whose hands the author's claims are leads, never evidence; verdicts derive from re-run checks and artifacts. The collection's own output gets the same treatment: a protocol, a document, a release is attacked before it is pinned.

**P10 Evolution without dual tracks.** When a mechanism is replaced, the old way keeps exactly one exit — a one-time migration — after which only the new path exists. No fallback branch is added, ever; keeping one is blocking the reform.

**P11 Cross-borrowing with restraint.** A mechanism moves between loops only as a true equivalent in the target's own domain; the loops keep their domain differences. Porting the form of a success without its function is refused.

## Repository constraints

**M1** One advance, one commit, with a self-explanatory message. The version is unified in all nine defined places (citation, two README badges, two SPEC headers, four implementation descriptions) and bumps in the rightmost digit.

**M2** Chinese and English change in the same pass and are verified by a paired checklist — one row per sentence, one column per language — never file by file.

**M3** Prose follows the mechanism: counts, names, paths, file names and version strings change with the mechanism in the same commit; after the change, a stale-string grep over the old values returns nothing outside legitimate migration notes.

**M4** A refactor never narrows doctrine: re-collecting rules into a new structure is audited sentence by sentence against the boss's recorded words before it lands.

**M5** Declined proposals are recorded with their reasons; a rejection without a record invites the same proposal again.

**M6** Before pinning any change to this file or to a SPEC's doctrine sections, commission a fresh adversarial review of the artifact — the strictest available form.

**M7** The compile gate is a real gate: strict type-check plus the real engine compile, both green. A baseline error-set comparison is a filter and never a substitute.

**M8** Naming is collision-checked, cliché-free and memorable.

**M9** Anything a change claims — including counts in prose and commit messages — is reproducible from a command.

## For a pull request

State which P and M rules the change touches and how each stays intact; attach the paired-checklist result for language twins and both compile outputs. Where no rule reaches, decide the way the boss's words would decide, record the decision, and flag it for the boss.
