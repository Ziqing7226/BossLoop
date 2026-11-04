/* zcode-workflow
description: Robust Engineering Loop (v0.3.3), English UI. Turns one verbatim requirement into a cold-start-verified delivery. The Chief records the requirement ledger and commits to N rounds (boss may lock); each round ships one local commit, then faces a cold-start gate (diff review, robustness suite, canary, zero-warning build, remote-CI carryover) — findings are reproduced before rework (misdiagnoses need evidence rebuttals) and amended into the round commit (3 unsolved attempts escalate to the Senior Engineer; 10 red gate re-checks interrupt to the boss); only a fully green gate is pushed to the agreed remote (GitCoffer by default; append-only, never force). Resumes from the ledger; destructive operations follow a declared-ruled-executed trail, never handed to the boss; model tiering tiered/uniform.
args:
  requirement:
    type: string
    required: true
    description: The boss's development requirement, verbatim (enters the requirement ledger and is reconciled line by line in the final report)
  rounds:
    type: number
    default: 0
    description: Total rounds; 0 = planned and committed by the Chief (a boss-given value is locked in; hard stop)
  remote:
    type: string
    default: "gitcoffer"
    description: Agreed push target; auto-detect a gitcoffer remote, or any remote name/URL; none = never push
  profile:
    type: string
    default: ""
    description: Project constraints (build/test/lint commands with strict flags, CI flavor and its local equivalent, forbidden practices; optional)
  focus:
    type: string
    default: ""
    description: The boss's focus note for this run (optional)
  models:
    type: string
    default: "tiered"
    description: Model tiering; tiered = Chief/Senior on the strong model and engineer/tester on the cheap one (GLM-5.3 vs GLM-5.3-Flash here), uniform = every role on the session model
*/

interface Commitment {
  /** Committed total round count N (fixed before round 1; a boss-given rounds value wins) */
  roundsTotal: number;
  /** One-line scope per round (one line each) */
  roundsOutline: string;
  /** Rounds already completed per the ledger; 0 for a fresh start (drives the resume point) */
  resumeFrom: number;
  /** Major issues only: interrupt the loop, write the interrupt report and return early */
  blocked?: { reason: string; question: string };
}

interface RoundCards {
  /** This round's theme in one sentence */
  title: string;
  /** Work cards, one instruction each, each traceable to a requirement entry (R1/R2...) */
  cards: string[];
  /** Remote-CI issues found on last round's push (via gh run etc.; say so honestly if uncheckable) — mandatory fix items this round */
  remoteCiIssues: string[];
  /** Set true only when every requirement is closed and the gate is green: finish early, skip remaining rounds */
  done?: boolean;
  /** Major issues only: interrupt the loop and report to the boss */
  blocked?: { reason: string; question: string };
}

interface DevReport {
  /** One sentence: what was done */
  summary: string;
  /** Artifact paths */
  artifacts: string[];
  /** Per-card requirement coverage (e.g. "R1: API done (card 1)") — goes to the Chief only, never to the Test Engineer */
  requirementCoverage: string[];
  /** Destructive operations this round needs (delete/overwrite/rewrite history): declare only, never run them yourself; empty when none */
  dangerRequests: DangerRequest[];
  /** Leftovers, or "none" */
  leftover: string;
}

interface Finding {
  /** Finding id (F1/F2...) — fixes and rebuttals reconcile by id */
  id: string;
  severity: "minor" | "major" | "blocker";
  /** Reproduction evidence: command + output excerpt (a finding without evidence may not be filed) */
  evidence: string;
}

interface TestVerdict {
  /** One-sentence verdict */
  summary: string;
  /** Whether the whole gate is green */
  passed: boolean;
  /** Findings, each with reproduction evidence */
  findings: Finding[];
  /** Coverage and verification statement: deep vs skimmed areas + the means of verification per conclusion (written before the verdict, reconciled later) */
  coverage: string;
  /** Artifact paths delivered this round (images included; list gitignored artifacts too so the visual review can find them); empty when none */
  artifacts?: string[];
}

interface VisualVerdict {
  /** One-sentence verdict */
  summary: string;
  /** Per-image issues (file name + one sentence + what was seen); empty when clean */
  issues: string[];
}

interface FixOutcome {
  /** One sentence: what the rework did */
  summary: string;
  /** Ids of findings confirmed real and fixed (amended into the round commit) */
  fixed: string[];
  /** Findings ruled misdiagnoses and rebutted: id + evidence (command output / spec citation) */
  rebutted: { id: string; evidence: string }[];
  /** Destructive operations the rework needs: declare only, do not execute; empty when none */
  dangerRequests: DangerRequest[];
}

interface DangerRequest {
  /** The destructive command as written */
  command: string;
  /** Why it has to be done */
  reason: string;
  /** Blast radius: which paths/data it deletes or overwrites, and whether it is reversible */
  scope: string;
}

interface DangerDecision {
  command: string;
  decision: "approve" | "approve-with-change" | "reject";
  /** The safe form when approve-with-change (narrower path, dry-run first, back up first); empty on a plain approve */
  safeForm: string;
  /** Why this decision */
  reason: string;
}

interface DangerReview {
  /** One-sentence conclusion */
  summary: string;
  /** One decision per request, in order */
  decisions: DangerDecision[];
}

interface RoundRow {
  round: number;
  task: string;
  dev: string;
  test: string;
  /** Finding/rebuttal counts (e.g. "3 findings / 1 rebuttal") */
  findings: string;
  push: string;
  next: string;
}

interface FinalReport {
  /** Completion verdict */
  verdict: "done" | "interrupted" | "incomplete";
  /** Line-by-line reconciliation: boss's verbatim requirement -> outcome -> evidence (a requirement without an entry is not done) */
  requirementOutcomes: { id: string; verbatim: string; outcome: string; evidence: string }[];
  /** Deviations from the boss's requirements, each with reason and the alternative chosen; empty if none */
  deviations: string[];
  /** Final state in one sentence: commits/pushes/CI/tests/known limitations */
  state: string;
  /** Decisions only the boss can make */
  decisionList: string[];
  /** Deferred items: a recorded deferral is a decision, not an omission */
  deferred?: { item: string; reason: string }[];
  /** Declined items: with reasons, so a rejected idea is not re-proposed next run */
  declined?: { item: string; reason: string }[];
  /** Process lessons: how the loop itself failed or nearly failed, as checklist entries */
  processLessons?: string[];
  /** Questions from the boss's own words -> direct answer (including the artifact's form) -> where the evidence is */
  questionAnswers?: { q: string; a: string; evidence: string }[];
  /** Autonomous decisions: decision, reason, consequence if rejected, Occam self-assessment (adds complexity vs simplifies) */
  autonomousDecisions?: { decision: string; reason: string; ifRejected: string; occam: string }[];
  /** One-sentence advice to the boss */
  advice: string;
}

const CHIEF_EN = [
  "You are the Chief Engineer. Mission: turn the boss's (user's) development requirement into a high-quality delivery within a committed, bounded number of rounds — every round passes cold-start verification, a fully green gate and a zero-warning build before anything is pushed.",
  "Boss fidelity is the top discipline: before round 1 create Agents/requirements.md — the boss's words verbatim, each with interpretation and acceptance criteria, none dropped; never act against the boss's requirements; a deviation you cannot avoid must be explained line by line in the Final Report — never silently.",
  "Intake does three mechanical passes, none optional: (1) sentence inventory — split every boss message (requirement arg, focus, boss_directives file) sentence by sentence and mark each one registered-as-Rn / not-applicable-with-reason / needs-clarification; (2) artifact spec table — for each deliverable, its axis, domain, resolution, colour encoding and pass criteria (machine-checkable), and every number or format word in the boss's words must land on a row; (3) open questions — every interrogative sentence logged (text, when logged, answer status). All three live in Agents/requirements.md. The reading of the boss's words must be self-consistent and capture the gist; what you cannot pin down, never guess — carry the boss's words verbatim (quoted, marked unsure) in the ledger and the brief; the engineers may resolve them during development or testing. Verbatim fidelity is not semantic fidelity: copying the words while misreading the meaning is the most dangerous failure.",
  "Opening brief: after committing the round count and before starting work, write docs/brief.md (at most one page, three parts only): what I intend to deliver (each tied to the sentence of the boss's words it answers, quote <=15 chars), how each item counts as passing (machine-checkable), and what I am unsure about (<=3 items, each with my default reading and what happens if it is wrong). Then start immediately — never idle waiting for the boss to look at it; the boss corrects it item by item the next morning.",
  "Ambiguity is a major-issue candidate: when the boss's words cannot be filled into the spec table (e.g. a number reads either as bin width or as axis range), do not pick one literal reading and proceed — quote the words verbatim in the brief's unsure section, or decide from whether the scope changes whether to interrupt.",
  "Two file classes (delivery discipline), bounded by location: everything not under Agents/ is boss-facing — the artifacts the boss's words name, plus docs/brief.md, docs/boss_directives.md (written by the boss), the final report and interrupt reports; everything under Agents/ is working scaffolding — the ledger, the requirement map, Agents/selfcheck.py, test and debug scripts, falsified history, agent-facing docs. Delivery follows Occam's razor: the boss reads everything outside Agents/; if the boss has to open Agents/, the loop has failed.",
  "Interrupt policy: major issues (infeasible requirement, scope-changing ambiguity, extending the round count, gate still red after 10 gate re-checks) -> interrupt the loop immediately; a destructive operation is not itself an interrupt trigger — it goes to the danger-clause ruling (junior declarations -> Senior Engineer; the Senior Engineer's own declarations in the escalation phase -> you), and only when the round still cannot proceed after the ruling do you interrupt and write docs/interrupt_report.md for the boss; minor issues (in-scope implementation details, tooling choices, ordering) -> decide yourself and log the decision. Scope, schedule, quality bar and budget are boss-level tradeoffs — you may not downgrade them to minor.",
  "Round planning: commit to N rounds with a one-line scope each before round 1 (a boss-locked rounds value is final — no adding or dropping); each round re-plan from the ledger — last round's verdict, findings and rebuttals, remote-CI carryover and leftovers must all be disposed of; every work card traces to a requirement entry (R1/R2...); when last round's fix was contradicted by validation (later validation), this round's cards open with an explicit rollback-vs-fix-forward decision, evidence first — a contradicted fix is never stacked on.",
  "Before issuing each round's cards, check the open questions in requirements.md: with unanswered items, the first card is the answer (including the artifact's form: raw or derived, whether a writer exists).",
  "Occam's razor: your autonomous decisions naturally lean toward adding things (modules, checks, config) — every complexity-increasing decision must state the value it buys, or it is not taken; such a decision never lives only in the ledger — it goes into the Final Report's autonomous-decision list.",
  "Misdiagnosis arbitration: when the engineers dispute a finding, arbitrate on evidence only; if still undecided -> major issue, interrupt and report to the boss.",
  "Take over by reading the ledger (Agents/ledger.md): resume, never redo; the ledger also records each round's baseline hash and pushed SHAs. Resuming after an interrupt or a cancelled stretch opens with a closure review of the discarded range: every in-flight item is either verified present or dropped with a ledger note — lost work is reconciled before new rounds, never silently skipped.",
  "Git write scope: run only the git add/commit/amend an ask names; pushes are executed and verified by the orchestrator — never push yourself, and never run reset/rebase/tag or any other repository-writing git operation.",
  "Boss directives file: the orchestrator attaches the current content of docs/boss_directives.md to every round's card ask (instructions the boss issues mid-run; may be empty) — turn each into work cards and log its application in the ledger; it carries run steering only, not a replacement for the requirement ledger; when it disagrees with earlier boss requirements, the latest boss instruction wins and is recorded honestly.",
  "Honesty first: reports quote command outputs and exit codes only; say what you don't know; escalate contradictions instead of working around them.",
].join("\n");

const ALGO_EN = [
  "You are the Algorithm Engineer: implement this round's work cards; make exactly ONE local commit per round (the round commit), message in one sentence. Docs are a deliverable: professional, clean and concise — one home per fact, no redundancy or duplication; every code change ships with its doc change in the same commit. Test and debug scripts and process artifacts go under Agents/; the repo root and docs/ hold boss-facing deliverables only.",
  "The working tree is frozen while the Test Engineer verifies: do not modify the implementation under test.",
  "Rework discipline: reproduce every finding before touching code — confirmed findings get fixes; findings you cannot reproduce or that contradict the facts get evidence rebuttals (command output, spec citation). Never blindly \"fix\" a non-issue — churn is not progress. A stale entry (line numbers from an older version, already fixed, not reproducible on this round's code) is discarded and marked \"stale\" in the rebuttal — never code against it.",
  "Fixes always land as git add -A && git commit --amend --no-edit into the round commit: never rewrite pushed history, never amend below the baseline.",
  "Your dev report (with per-card requirement coverage) goes to the Chief for planning only; the Test Engineer never sees it — the cold start is by design, not an oversight.",
  "Report failures as failures; escalate contradictions. Never fake, never bypass the gate, never force-push.",
  "Repair discipline, three rules: layer attribution before repair — pin the layer/component the defect lives in with discriminating evidence first; no \"just in case\" cross-layer fixes, and an unattributable finding is reported as such, never patched speculatively. Falsifiability — a diagnosis names the experiment that would refute it; an unfalsifiable story is a conjecture and never justifies a change; direct observation of the failure outranks theory. Reference anchoring — when a reference implementation exists (upstream project, prior art), check it first at its behavior layer before concluding; a divergence is either justified in the ledger or aligned with the reference.",
  "Context discipline: redirect long command output to a file and take summaries via tail/grep — never page through it; read only relevant excerpts of reference material (files touched by this round's diff are exempt — they fall under the tester's full-read duty); take only decision-relevant excerpts of oversized tool output.",
  "Git write scope: run only the git add/commit/amend an ask names; pushes are executed by the orchestrator — never push yourself, and never run reset/rebase/tag or other repository-writing git operations.",
  "Destructive-operation rule: rm -rf / deleting directories or data files / git reset --hard / git clean -fdx / force push / rewriting pushed history / overwriting others' artifacts are declared, never executed unilaterally — put them in dangerRequests (exact command, reason, blast radius) and wait for the Senior Engineer's ruling, then run exactly the approved form.",
  "You run on the cheap tier as the junior engineer: when the same problem survives 3 fix attempts, stop grinding — write up the minimal reproduction and a root-cause hypothesis and hand it to the Senior Engineer (strong model).",
].join("\n");

const SENIOR_EN = [
  "You are the Senior Engineer (escalation path, strong tier): findings the junior could not solve in 3 fix attempts escalate to you. Read the gate output and the ledger first and fix the root cause in one pass rather than papering over symptoms; your fixes amend into the same round commit under the engineer's full discipline. If it is a genuine blocker (contradictory requirements, unusable environment), say so plainly and recommend an interrupt.",
  "You are also one of the authorities on destructive operations: adjudicate each request from the junior engineer — is the blast radius precisely bounded, is it reversible, is there a narrower safe equivalent (scoped path, dry-run first, back up first, list the affected files first)? Reject by default; use approve-with-change with the safe form written into safeForm when a safer equivalent exists; approve only when necessary and safe (in the escalation phase your own declarations are ruled on by the Chief — you never rule on your own).",
  "This ruling is never handed back to the boss: only when the round cannot proceed at all without the operation (an index must be rebuilt, corrupted artifacts must be removed) should you say so and recommend the Chief's interrupt path — routine deletions never block on the user.",
].join("\n");

const VISUAL_EN = [
  "You are the Visual Reviewer: you look at images only — not the code, and never at anyone's self-report. Open each given image and answer three questions: (1) does the data fill the domain it should (large blank regions, only a handful of points); (2) are axes, ticks and legend readable and consistent with the spec table; (3) can this image support the conclusion this round claims.",
  "Judge against the artifact spec table in Agents/requirements.md — what it should look like — not against what looks pretty. Read-only, change nothing; say plainly which images you could not open.",
].join("\n");

const TEST_EN = [
  "You are the Test Engineer, cold-started: you work only from the diff (baseline..HEAD) and the repository itself, never from the author's narrative; nobody will hand you the dev report — author claims anchor a verifier, and this is by design.",
  "Diff review: review what actually changed, not what was claimed: new code, changed behavior, docs-vs-implementation consistency — and doc quality (professional, concise, free of redundant or duplicated information) is a finding when lacking; user-facing claims are audited too — every claim the diff introduces (README, docs, release notes) maps to a mechanism or a re-runnable check, and each number keeps one source.",
  "Full-read duty: every file touched by this round's diff must be read in full (including the context around the changes) — never conclude from a few paragraphs; skimming is allowed only for repository areas outside this round's diff and must be declared in coverage; for every deeply-read file, coverage states the checks actually performed with line anchors (file:line) for later reconciliation.",
  "Context discipline: redirect long command output to a file and take summaries via tail/grep; the full-read duty overrides excerpt reading for diff-touched files; take only decision-relevant excerpts of oversized tool output.",
  "Git write scope: run only the git add/commit/amend an ask names (test fixtures amend into the round commit); pushes are executed by the orchestrator — never push yourself, and never run other repository-writing git operations.",
  "Read the four sections of Agents/requirements.md (sentence inventory, requirements and acceptance criteria, artifact spec table, open questions) and brief.md first: the gate must cover the pass criteria in the spec table, not just structure (a file exists, a plot is non-empty, colours follow the rule).",
  "Content assertions: every deliverable's selfcheck must carry assertions derived from the spec table — domain/range assertions (a plot's axis must equal the specified value), fill assertions (data should cover at least ~60% of the axis), discriminability assertions (input and output must differ observably). A suite that only checks existence and not correctness means the gate is not met — a blank figure passing 40 structural checks is the worst case.",
  "Test expectations may only derive from the spec table or a registered requirement, never from the current implementation; every assertion's comment names its source (Rn or spec row). Writing a misreading into a must-pass test is the worst moat of all.",
  "Number-hallucination warning: a good-looking number is not a good outcome — scrutinize whether what the number means is really as simple as it appears; the theory behind it may itself be wrong, and the flattering number then reinforces that theoretical illusion. Understanding a number presupposes solid knowledge of the theory beneath it: for every headline number ask — what theory or mechanism does it rest on, and what would it still show if that theory were wrong?",
  "Write and maintain robustness tests: boundary and adversarial inputs, perturbation scenarios where applicable; create/maintain Agents/selfcheck.py under Agents/ (test and debug scripts always live under Agents/ — the repo root and docs/ hold boss-facing deliverables only; explore freely while building, Occam's razor at delivery), aggregating, per the project profile: a strict build (warnings are errors: -Werror / /WX / -D warnings / deny(warnings), per language), the full test suite + robustness cases, and the local CI equivalent (if the repo has CI, it must run green locally). The suite falsifies, not just exercises: every mechanism the diff adds ships with a negative check (a tampered input that must fail, an injection that must be refused) — \"verified\" means a refutation attempt failed, never that a happy path passed.",
  "Agents/selfcheck.py must contain a deliberately-broken canary case marked `canary` (the orchestrator verifies it by search) — a suite that cannot go red proves nothing.",
  "Check the previous round's push on the remote: on GitHub remotes with gh available use gh run list / gh run view; if uncheckable, say so honestly — an unchecked CI is never reported as passed; failures become mandatory fix items this round.",
  "Destructive-operation criterion (aligned with the declaration duty): beyond the approved list — data files or whole directories vanishing, history below the baseline rewritten, a force push, existing artifacts overwritten — is a blocker; demand the declaration and the ruling record. Source-file deletions in an ordinary refactor are not destructive, but must stay traceable. Third-party upstreams are read-only: pushes still go only to the agreed remote, never upstream; before the round closes, upstream refs are verified unchanged, quoted from git output.",
  "Independence is absolute: never edit the implementation under test. You only write Agents/selfcheck.py, the robustness cases, and the verification column of Agents/requirement_map.md (requirement <-> implementation location <-> re-runnable command, tabular with a requirement-map marker).",
  "Artifact freshness and reference anchoring: the artifacts the checks ran against must be built from HEAD — where the build layout exposes them, verify freshness (no source newer than its artifact; Agents/selfcheck.py may carry the check), and a green from a stale binary is void; when a reference implementation exists (upstream/prior art), check suspect behavior against its behavior layer first — an unexplained divergence is a finding; every finding states its layer/component with discriminating evidence.",
  "Every verification command runs in a pinned environment: output locale pinned, system-level configuration isolated (credential helpers and global git config bypassed, not trusted), credential state reset between scenarios, no persistence assumed for temp directories; the per-conclusion verification-layering statement follows the coverage requirement of each verdict.",
  "Every finding carries reproduction evidence (command + output); after a fix, re-run the original failing check to confirm closure; arbitrate rebuttals on evidence only; mark blocker honestly when the build system cannot even run or the requirement contradicts itself.",
].join("\n");

const requirement = String(args.requirement ?? "");
const roundsArg = typeof args.rounds === "number" ? args.rounds : 0;
const remoteArg = typeof args.remote === "string" && args.remote !== "" ? args.remote : "gitcoffer";
const profile = typeof args.profile === "string" ? args.profile : "";
const focus = typeof args.focus === "string" ? args.focus : "";
const PROFILE_LINE = profile ? "\nProject constraints (mandatory, override defaults): " + profile : "";

/** Model tiering: tiered = strong/cheap split (GLM-5.3 / GLM-5.3-Flash here); uniform = session model for all */
const tiered = String(args.models ?? "tiered").toLowerCase() !== "uniform";
const STRONG = model("GLM-5.3");
const CHEAP = model("GLM-5.3-Flash");
const persona = (system: string, m: ModelRef): { system: string; model?: ModelRef } =>
  tiered ? { system, model: m } : { system };

/** Resolve the agreed push target: returns {target (name or URL, "" = skip pushes), note} */
async function resolvePushTarget(): Promise<{ target: string; note: string }> {
  if (remoteArg.toLowerCase() === "none") return { target: "", note: "boss set remote=none: no pushes this run" };
  let remotes: string[] = [];
  try {
    const r = await world.run("git", ["remote"], { timeoutMs: 60000 });
    remotes = (r.stdout || "").split("\n").map((s) => s.trim()).filter((s) => s !== "");
  } catch {
    remotes = [];
  }
  if (/^(\w+@|https?:\/\/|file:\/\/|[A-Za-z]:|\/|\\\\)/.test(remoteArg)) return { target: remoteArg, note: "" };
  if (remotes.includes(remoteArg)) return { target: remoteArg, note: "" };
  if (remoteArg.toLowerCase() === "gitcoffer") {
    const hit = remotes.find((r) => /gitcoffer/i.test(r));
    if (hit) return { target: hit, note: "" };
    return { target: "", note: "no gitcoffer remote found (GitCoffer not configured): pushes skipped and reported — never redirected elsewhere" };
  }
  return { target: "", note: "remote arg \"" + remoteArg + "\" is not in git remote list (" + (remotes.join(", ") || "none") + "): pushes skipped and reported" };
}

const HEAD0 = async (): Promise<string> => {
  try {
    const l = await git.log(1);
    return l[0]?.hash ?? "";
  } catch {
    return "";
  }
};

const CHIEF_BLOCK_NOTE = "\n(For a major issue, fill blocked and stop issuing cards: write docs/interrupt_report.md — leading with the explanation (what happened and why), then the completed rounds and artifacts, the points needing the boss's decision, and suggested options with their trade-offs — then commit locally.)";

artifact.table("rounds", {
  title: "Engineering rounds",
  columns: [
    { field: "round", label: "Round" },
    { field: "task", label: "Task" },
    { field: "dev", label: "Build" },
    { field: "test", label: "Cold-start gate" },
    { field: "findings", label: "Findings/rebuttals/escalations" },
    { field: "push", label: "Push" },
    { field: "next", label: "Next" },
  ],
  key: "round",
});

phase("Chief: requirement ledger & master plan");
const chief = agent("Chief Engineer", persona(CHIEF_EN + PROFILE_LINE, STRONG)); // strong tier: analysis and planning
let ledger = "";
try {
  ledger = await files.read("Agents/ledger.md");
} catch {
  ledger = "";
}
let legacyLayout = false; // pre-v0.3.3 layouts kept working files under docs/workflow/ — migrate before resuming
if (ledger === "") {
  try {
    ledger = await files.read("docs/workflow/ledger.md");
    legacyLayout = ledger !== "";
  } catch {
    ledger = "";
  }
}
if (legacyLayout) log("Legacy-layout ledger found (docs/workflow/ledger.md): migrate before working — ledger/requirements/map/selfcheck.py into Agents/, directives, brief and the final report into docs/");
try {
  const st = await world.run("git", ["status", "--porcelain"], { timeoutMs: 60000 });
  if ((st.stdout || "").trim() !== "") log("Warning: working tree not clean — start from a clean tree; recorded honestly in the ledger");
} catch {
  /* no git or not checkable: skip */
}
const push0 = await resolvePushTarget();
if (push0.note !== "") log("Push target: " + push0.note);
let repoRoot = "";
try {
  const tr = await world.run("git", ["rev-parse", "--show-toplevel"], { timeoutMs: 60000 });
  repoRoot = (tr.stdout || "").trim();
} catch {
  repoRoot = "";
}
// Startup repo check: the loop assumes the working directory is the repository root — say it loudly when it is not, instead of silently skipping pushes
let repoWarn = "";
try {
  const wt = await world.run("git", ["rev-parse", "--is-inside-work-tree"], { timeoutMs: 60000 });
  const inside = (wt.stdout || "").trim() === "true";
  const cd = inside ? await world.run("git", ["rev-parse", "--show-cdup"], { timeoutMs: 60000 }) : null;
  const cdup = cd ? (cd.stdout || "").trim() : "";
  if (!inside) {
    repoWarn = "the working directory is not a git repository (or git is unavailable): commit verification and pushes will not work — run this workflow from the root of the repository under development";
  } else if (cdup !== "" && repoRoot !== "") {
    repoWarn = "the working directory is a subdirectory of the repository (repo root " + repoRoot + ", " + cdup + " up): Agents/ and docs/ will be written under this directory, not the repo root — running from the repo root is recommended";
  }
} catch {
  repoWarn = "repository check failed (git unavailable): commit verification and pushes will not work";
}
if (repoWarn !== "") log("Warning: " + repoWarn + "; recorded honestly in the ledger");
let bossDirectives0 = "";
try {
  bossDirectives0 = (await files.read("docs/boss_directives.md")).trim();
} catch {
  bossDirectives0 = "";
}
if (bossDirectives0 === "") {
  try {
    bossDirectives0 = (await files.read("docs/workflow/boss_directives.md")).trim(); // legacy-layout fallback: the boss may still write the old path
  } catch {
    bossDirectives0 = "";
  }
}
const commit0 = await chief.ask<Commitment>(
  "Boss's requirement (verbatim): " + requirement + "\n" + (focus ? "Boss focus: " + focus + "\n" : "") +
  (bossDirectives0 ? "[Boss directives file docs/boss_directives.md] (instructions the boss issued — apply each one):\n" + bossDirectives0 + "\n" : "") +
  (repoRoot ? "Repo root: " + repoRoot + " (flag it honestly if the ledger records a different root).\n" : "") +
  (repoWarn !== "" ? "[Environment warning] " + repoWarn + " — proceed anyway, but pushes/commit verification may be unavailable; record it in the ledger.\n" : "") +
  (legacyLayout ? "[Migration] Legacy layout detected: first move docs/workflow/{ledger,requirements,requirement_map}.md and the root selfcheck.py into Agents/, and {boss_directives,brief,final_report}.md into docs/, git add -A && git commit, then resume.\n" : "") +
  (ledger ? "Existing ledger (head index + tail detail; the resume basis):\n" + (ledger.length > 6000 ? ledger.slice(0, 1600) + "\n... (middle omitted) ...\n" + ledger.slice(-3200) : ledger) + "\nIf it shows N rounds already completed for this requirement, resumeFrom = N (continue at round N+1, never redo); otherwise 0.\n" : "No ledger: resumeFrom = 0.\n") +
  "Before round 1, four things: 1) create Agents/requirements.md — headed by one authority line (Agents/requirements.md = requirement record; Agents/requirement_map.md = verification record; Agents/ledger.md = history record); four mandatory sections: sentence inventory (each message split sentence by sentence, marked registered-Rn / not-applicable / needs-clarification), the boss's words verbatim numbered (R1/R2...) with interpretation and machine-checkable acceptance criteria, the artifact spec table (axis / domain / resolution / colour encoding / pass criteria), and open questions (every interrogative sentence logged); if a scope-changing ambiguity exists, raise it in blocked.question first (the only pre-start question); 2) commit to roundsTotal with a one-line scope per round in roundsOutline" +
  (roundsArg > 0 ? " (the boss locked rounds=" + roundsArg + " — adopt it, no adding or dropping)" : " (planned by you; once fixed, no extension except via interrupt)") +
  "; 3) write the opening brief docs/brief.md (at most one page: what you deliver / how each item passes / at most 3 unsure points — unsure points quote the boss's words verbatim, never a guessed paraphrase); 4) commit the ledger and the brief locally. Start working immediately after committing — never idle waiting for the boss to look, except for a contradictory or infeasible requirement (fill blocked). Return Commitment." + CHIEF_BLOCK_NOTE,
);
let roundsTotal = roundsArg > 0 ? roundsArg : Math.round(commit0.roundsTotal);
if (!(roundsTotal >= 1)) roundsTotal = 3;
if (roundsTotal !== (roundsArg > 0 ? roundsArg : commit0.roundsTotal)) {
  log("Rounds total " + commit0.roundsTotal + " invalid; using " + roundsTotal + " (recorded honestly)");
}
if (commit0.blocked) {
  phase("Major issue interrupt");
  const ir = await chief.ask<string>(
    "Interrupted per blocked. Complete docs/interrupt_report.md (problem, completed rounds and artifacts, points needing the boss's decision, suggested options), git add -A && git commit, and return a one-sentence summary for the boss.",
  );
  await artifact.markdown("interrupt", "# Interrupt Report\n\n" + ir + "\n\n---\nAfter the boss decides, rerun this workflow with the decision note (the ledger holds the checkpoint).\n", { title: "Interrupt Report", description: "Major issue: awaiting the boss's decision" });
  return { conclusion: "Interrupted: " + commit0.blocked.reason, question: commit0.blocked.question, rounds_completed: 0, next_action: "Rerun after the boss decides (resume from the ledger)" };
}
log("Round commitment: " + roundsTotal + " rounds; outline: " + String(commit0.roundsOutline || "").replace(/\n/g, "; "));
const startRound = Math.max(1, Math.min(roundsTotal + 1, Math.round(commit0.resumeFrom) + 1));
if (startRound > 1) log("Ledger shows " + (startRound - 1) + " round(s) done; resuming at round " + startRound);

const algo = agent("Algorithm Engineer", persona(ALGO_EN + PROFILE_LINE, CHEAP)); // cheap tier: junior engineer
const senior = agent("Senior Engineer", persona(ALGO_EN + SENIOR_EN + PROFILE_LINE, STRONG)); // strong tier: destructive-operation authority (escalation rework runs as one-shot instances)

/** Destructive-operation review: the executor only declares; an independent strong tier rules (junior -> Senior Engineer; escalation-phase Senior -> Chief) — the ruler is never the declarer, never the boss */
async function adjudicateDanger(reqs: DangerRequest[], requester: string, requesterTier: string, byChief: boolean): Promise<DangerReview> {
  const askText =
    "Destructive-operation review. Requester: " + requester + " (" + requesterTier + "). Rule on each request:\n" + JSON.stringify(reqs) +
    "\nJudge by: is the blast radius precisely bounded, is it reversible, is there a narrower safe equivalent (scoped path, dry-run first, back up first, list affected files first)? Reject by default; use approve-with-change with a safeForm when a safer equivalent exists; approve only when necessary and safe. Approval carries conditions: back up first so it is reversible, stop on failure; if bounded retries (2-3) still fail, park and report rather than switching to a larger-blast-radius alternative. " +
    "Never hand the decision back to the user: only when the round cannot proceed at all without the operation, say so and recommend an interrupt. Return DangerReview (decisions map one-to-one to the requests).";
  const raw = byChief
    ? await chief.ask<DangerReview>(askText)
    : await senior.ask<DangerReview>(askText);
  let decisions = raw.decisions ?? [];
  if (decisions.length !== reqs.length) {
    log("Destructive ruling incomplete (" + decisions.length + "/" + reqs.length + ") — treating all as rejected, recorded honestly");
    decisions = reqs.map((r) => ({ command: r.command, decision: "reject" as const, safeForm: "", reason: "Incomplete ruling; rejected wholesale for safety" }));
  }
  return { summary: raw.summary, decisions };
}

/** Have the executor run exactly the approved form, amended into the round commit */
function dangerExecAsk(approved: DangerDecision[]): string {
  return "Run the approved destructive operations, exactly as approved (use safeForm when non-empty); do not widen the scope, do not add unapproved commands:\n" +
    approved.map((d, i) => (i + 1) + ". " + (d.safeForm || d.command) + " (approved because: " + d.reason + ")").join("\n") +
    "\nThen git add -A && git commit --amend --no-edit into the round commit (plain commit if the round has none yet) and return one sentence.";
}
// Intake completeness check (mechanical): did the three sections and the brief actually reach the files? Repair once, then record honestly — this is the mechanical counterpart of "5 of 7 requirements never registered"
const intakeMarkers = ["sentence inventory", "spec table", "open question"];
let intakeMissing: string[] = [];
const checkIntake = async (): Promise<void> => {
  let rt = "";
  try {
    rt = await files.read("Agents/requirements.md");
  } catch {
    rt = "";
  }
  let bt = "";
  try {
    bt = await files.read("docs/brief.md");
  } catch {
    bt = "";
  }
  intakeMissing = [];
  const low = rt.toLowerCase();
  if (rt === "") {
    intakeMissing.push("requirements.md missing");
  } else {
    for (const mk of intakeMarkers) if (!low.includes(mk)) intakeMissing.push("requirements.md lacks the \"" + mk + "\" section");
  }
  if (bt === "") intakeMissing.push("brief.md missing");
};
await checkIntake();
if (intakeMissing.length > 0) {
  await chief.ask<string>(
    "Intake completeness check failed: " + intakeMissing.join("; ") + ". Complete them and git add -A && git commit (section headings fixed as \"Sentence inventory\" / \"Requirements and acceptance criteria\" / \"Artifact spec table\" / \"Open questions\"; brief.md in three parts: what you deliver / how each item passes / at most 3 unsure points), return one sentence.",
  );
  await checkIntake();
  log(intakeMissing.length === 0 ? "Intake completeness: passed after repair" : "Intake completeness still missing: " + intakeMissing.join("; ") + " — recorded honestly, continuing");
}

const rows: RoundRow[] = [];
let lastPushed = ""; // last round's pushed SHA (for the next round's remote-CI check)
let plan = String(commit0.roundsOutline || "");
let finalVerdict: FinalReport | null = null;
let interrupted = false;
let ungatedHead = false; // an interrupt with a red gate leaves an un-gated commit at HEAD — the final report must not push
let branch = "main";
try {
  const b = await world.run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { timeoutMs: 60000 });
  branch = (b.stdout || "").trim() || "main";
} catch {
  branch = "main";
}

for (let round = startRound; round <= roundsTotal && !interrupted; round++) {
  const baseline = await HEAD0();
  let bossNote = "";
  try {
    bossNote = (await files.read("docs/boss_directives.md")).trim();
  } catch {
    bossNote = "";
  }
  if (bossNote === "") {
    try {
      bossNote = (await files.read("docs/workflow/boss_directives.md")).trim(); // legacy-layout fallback
    } catch {
      bossNote = "";
    }
  }
  phase("Chief issues cards");
  const cards = await chief.ask<RoundCards>(
    "Round " + round + "/" + roundsTotal + ". Requirements live in Agents/requirements.md; planning basis:\n" + String(plan).slice(0, 4000) + "\n" +
    (lastPushed ? "Last round pushed " + lastPushed.slice(0, 7) + ": first check its remote CI status on (" + (push0.target || "not configured") + ") via gh run list/view; if uncheckable, say so honestly; failures go into remoteCiIssues as mandatory fix items.\n" : "") +
    (bossNote ? "[Boss directives file (read this round)] apply each item, log application in the ledger:\n" + bossNote + "\n" : "") +
    "Before issuing cards, check the open questions in requirements.md: with unanswered items, the first card is the answer (including the artifact's form: raw or derived, whether a writer exists).\n" +
    "Issue this round's work cards: one sentence each, traceable to requirement entries; dispose of last round's findings, rebuttals and leftovers one by one. Set done=true only if every requirement is closed and the gate is green." + CHIEF_BLOCK_NOTE,
  );
  if (cards.blocked) {
    const ir = await chief.ask<string>(
      "Interrupted per blocked (before round " + round + " started). Complete docs/interrupt_report.md, git add -A && git commit, return a one-sentence summary.",
    );
    if (push0.target !== "") {
      // The interrupt-report commit is pushed by the orchestrator (the tree holds only gated work plus this docs commit)
      try {
        const pi = await world.run("git", ["push", push0.target, "HEAD:" + branch], { timeoutMs: 300000 });
        if (pi.exitCode !== 0) log("Interrupt-report push exit code " + pi.exitCode + " — recorded honestly");
      } catch {
        log("Interrupt-report push failed to launch (recorded honestly)");
      }
    }
    await artifact.markdown("interrupt", "# Interrupt Report (round " + round + ")\n\n" + ir + "\n\n---\nAfter the boss decides, rerun this workflow with the decision note (the ledger holds the checkpoint).\n", { title: "Interrupt Report", description: "Major issue: awaiting the boss's decision" });
    finalVerdict = { verdict: "interrupted", requirementOutcomes: [], deviations: [], state: ir, decisionList: [cards.blocked.question], advice: "Interrupted on a major issue; awaiting the boss" };
    interrupted = true;
    break;
  }
  if (cards.done === true) {
    log("Chief declares every requirement closed: finishing early (recorded honestly)");
    break;
  }
  if (cards.cards.length === 0) {
    log("Round " + round + " issued zero cards without declaring done — treated as an interrupt (recorded honestly)");
    const ir0 = await chief.ask<string>("Zero work cards and not done is a planning anomaly: write the reason to Agents/ledger.md and git add -A && git commit; return one sentence.");
    finalVerdict = { verdict: "interrupted", requirementOutcomes: [], deviations: [], state: ir0, decisionList: ["Chief could not issue round-" + round + " cards"], advice: "Planning anomaly; boss attention needed" };
    interrupted = true;
    break;
  }
  log("Round " + round + " task: " + cards.title + (cards.remoteCiIssues.length > 0 ? "; remote-CI carryover: " + cards.remoteCiIssues.length + " mandatory item(s)" : ""));

  phase("Engineer builds & commits");
  let dev = await algo.ask<DevReport>(
    "Round " + round + " work cards:\n" + cards.cards.map((c, i) => (i + 1) + ". " + c).join("\n") +
    (cards.remoteCiIssues.length > 0 ? "\nMandatory remote-CI fixes from last round:\n" + cards.remoteCiIssues.map((s) => "- " + s).join("\n") : "") +
    "\nDevelop and update docs, then git add -A && git commit (one commit this round, one-sentence message). Return DevReport (requirementCoverage names the requirement ids each card covered).",
  );
  let headA = await HEAD0();
  if (headA === "" || headA === baseline) {
    dev = await algo.ask<DevReport>("This round's commit did not land (HEAD did not advance). Run git add -A && git commit now and return DevReport.");
    headA = await HEAD0();
  }
  const commitOk = headA !== "" && headA !== baseline;
  log("Round " + round + " commit " + (commitOk ? "landed (" + headA.slice(0, 7) + ", baseline " + (baseline || "empty tree").slice(0, 7) + ")" : "still missing — recorded honestly; the tester faces uncommitted changes"));

  // Destructive operations: the junior declares, the strong tier rules execute / safe form / skip
  let dangerLog = "none";
  let approvedDanger: string[] = [];
  const dangerTrail: { declared: string; ruled: string; executed: string }[] = []; // consistency evidence: declared -> ruled -> executed must all line up
  if ((dev.dangerRequests || []).length > 0) {
    phase("Destructive-operation review");
    const review = await adjudicateDanger(dev.dangerRequests, "Algorithm Engineer", "cheap tier", false);
    dangerLog = review.decisions.map((d) => d.command + " -> " + d.decision + (d.safeForm ? " (as: " + d.safeForm + ")" : "") + ": " + d.reason).join("; ");
    log("Round " + round + " destructive-operation ruling: " + dangerLog.slice(0, 300));
    const ok = review.decisions.filter((d) => d.decision !== "reject");
    approvedDanger = ok.map((d) => d.safeForm || d.command);
    for (const d of ok) dangerTrail.push({ declared: d.command, ruled: d.decision + (d.safeForm ? "|" + d.safeForm : ""), executed: "pending confirmation" });
    if (ok.length > 0) {
      phase("Run the approved destructive operations");
      const execReport = await algo.ask<string>(dangerExecAsk(ok));
      for (const e of dangerTrail) {
        if (e.executed !== "pending confirmation") continue;
        const form = e.ruled.split("|")[1] || e.declared;
        e.executed = execReport.includes(form) ? form : "unconfirmed: executor report lacks the approved form";
        if (!execReport.includes(form)) log("Dangerous-operation execution unconfirmed: " + e.declared + " — recorded honestly and counted by the gate");
      }
      headA = await HEAD0();
    } else {
      log("All destructive requests rejected: nothing runs, no workarounds");
    }
  }

  phase("Test Engineer cold-start gate");
  const diffHint = baseline ? "git diff " + baseline + "..HEAD" : "git show HEAD (the repository's first commit)";
  // Coverage-statement aid: the orchestrator only measures and reports the diff size — no threshold line; the deep-vs-skim tradeoff is declared by the tester and reconciled later
  let diffLines = -1;
  if (baseline) {
    try {
      const df = await world.run("git", ["diff", "--numstat", baseline + "..HEAD"], { timeoutMs: 120000 });
      diffLines = (df.stdout || "").split("\n").reduce((a, l) => { const p2 = l.trim().split("\t"); return a + (Number(p2[0]) || 0) + (Number(p2[1]) || 0); }, 0);
    } catch {
      diffLines = -1;
    }
  }
  const sizeNote = diffLines < 0 ? "(diff size unknown: numstat unavailable, assess yourself)" : "(this round's diff is about " + diffLines + " lines" + (diffLines > 800 ? " — large: inventory the changes first, then deep-read the high-risk areas" : "") + ")";
  let verdict: TestVerdict = { summary: "not started", passed: false, findings: [] , coverage: "not started: no review yet" };
  let gate = "";
  let canary = false;
  let mapOk = false;
  let findingsCount = 0;
  let rebuttedCount = 0;
  let escalations = 0; // fix attempts escalated to the Senior Engineer (strong tier)
  let interpIsPy3 = false;
  let lastFix: FixOutcome | null = null;
  let imageFiles: string[] = []; // this round's image artifacts (the ledger and the visual note read it across attempts)
  let visualNote = "no visual review this round";

  for (let attempt = 1; attempt <= 10; attempt++) {
    const tester = agent("Test Engineer-R" + round + "-A" + attempt, persona(TEST_EN + PROFILE_LINE, CHEAP)); // one-shot instance: bounded context, evidence travels in the task card
    verdict = await tester.ask<TestVerdict>(
      (attempt === 1
        ? "Cold start. Baseline commit: " + (baseline || "(empty tree — this repo's first commit)") + ". Diff size this round: " + sizeNote + ". First read the four sections of Agents/requirements.md (sentence inventory / requirements and acceptance criteria / artifact spec table / open questions) and brief.md, then review " + diffHint + " and the repository itself: diff review, robustness tests, Agents/selfcheck.py (strict build / full tests + robustness / local CI equivalent + canary marker + content assertions derived from the spec table), and update the verification column of Agents/requirement_map.md; amend the test-fixture changes (Agents/selfcheck.py, robustness cases, requirement_map.md) into the round commit with git add -A && git commit --amend --no-edit — the test suite is part of this round's delivery."
        : (lastFix
            ? "The engineer has reworked (amended into the round commit); their fix report (a reconciliation lead only — your verdict rests on the checks you re-run): " + JSON.stringify(lastFix) + "\n"
            : "The failed mechanical items (Agents/selfcheck.py/requirement_map.md) were sent back to you to fix; no rework from the engineer side.\n") +
      "Re-verify one by one: re-run the original failing check for each fix to confirm closure; arbitrate each rebuttal on evidence only — withdraw the finding if the rebuttal stands, keep it with an explanation if not.") +
      (cards.remoteCiIssues.length > 0 ? "\nAlso: the mandatory remote-CI items were handled by the engineer: " + cards.remoteCiIssues.join("; ") : "") +
      (approvedDanger.length > 0
        ? "\nDestructive operations approved by ruling this round — only these forms are allowed: " + approvedDanger.join("; ")
        : "\nNo destructive operation was approved this round: data files or whole directories vanishing, history below the baseline rewritten, a force push, or existing artifacts overwritten in the diff or history is an unapproved destructive operation — mark it blocker (source-file deletions in an ordinary refactor excepted).") +
      " Return TestVerdict (every finding needs reproduction evidence). The verdict must carry a coverage statement: which files/areas you reviewed deeply (logic changes, gate-relevant, danger-operation sites) and which you only skimmed (skims only outside this round's diff; deep-read files carry line anchors file:line), plus the means of verification for each conclusion (a real-device test, a CI run, or a specialist cold review standing in where no device exists — worded as such, never as hands-on) — it is written before you know where the problems are; any later problem in a skimmed or substituted area is reconciled against it. List this round's delivered artifact paths in the artifacts field (images included; list gitignored artifacts too).",
    );
    findingsCount = verdict.findings.length;
    try {
      canary = (await files.grep("canary", "Agents/selfcheck.py")).length > 0;
    } catch {
      canary = false;
    }
    try {
      const map = await files.read("Agents/requirement_map.md");
      mapOk = map.includes("requirement-map") && map.split("\n").filter((l) => l.trim().startsWith("|")).length >= 2;
    } catch {
      mapOk = false;
    }
    let exitCode = -1;
    let output = "";
    if (canary) {
      try {
        const r = interpIsPy3
          ? await world.run("python3", ["Agents/selfcheck.py"], { timeoutMs: 3600000 })
          : await world.run("python", ["Agents/selfcheck.py"], { timeoutMs: 3600000 });
        exitCode = r.exitCode;
        output = (r.stderr || r.stdout || "(no output)").slice(0, 1500);
      } catch {
        if (!interpIsPy3) {
          interpIsPy3 = true;
          try {
            const r = await world.run("python3", ["Agents/selfcheck.py"], { timeoutMs: 3600000 });
            exitCode = r.exitCode;
            output = (r.stderr || r.stdout || "(no output)").slice(0, 1500);
          } catch {
            output = "neither python nor python3 could launch Agents/selfcheck.py";
          }
        } else {
          output = "Agents/selfcheck.py failed to launch or timed out";
        }
      }
    } else {
      output = "Agents/selfcheck.py lacks the canary marker (a must-fail control case)";
    }
    // Mechanical check: every approved dangerous operation must be declared, ruled on, and executed exactly in the approved form
    const dangerConsistent = dangerTrail.every((e) => e.executed !== "pending confirmation" && !e.executed.startsWith("unconfirmed") && approvedDanger.includes(e.executed));
    const mechGreen = verdict.passed && exitCode === 0 && canary && mapOk && dangerConsistent;
    // Image-artifact detection (mechanical): artifacts the tester declares ∪ images added/modified by the diff ∪ untracked images — if there are images, a human-grade eye must look
    const isImg = (p: string): boolean => /\.(png|jpe?g|svg|webp|gif)$/i.test(p);
    imageFiles = (verdict.artifacts || []).filter((p) => isImg(p));
    if (mechGreen && imageFiles.length === 0) {
      try {
        const st2 = await world.run("git", ["status", "--porcelain"], { timeoutMs: 60000 });
        for (const line of (st2.stdout || "").split("\n")) {
          const t2 = line.trim();
          if (t2.length < 4) continue;
          const p2 = t2.slice(3).trim();
          if (isImg(p2) && imageFiles.indexOf(p2) < 0) imageFiles.push(p2);
        }
        if (baseline) {
          const df2 = await world.run("git", ["diff", "--name-only", baseline + "..HEAD"], { timeoutMs: 60000 });
          for (const p3 of (df2.stdout || "").split("\n").map((s) => s.trim())) {
            if (p3 !== "" && isImg(p3) && imageFiles.indexOf(p3) < 0) imageFiles.push(p3);
          }
        }
      } catch {
        /* detection failed: treat as no images and say so in the visual note */
      }
    }
    let visualOk = imageFiles.length === 0;
    visualNote = imageFiles.length === 0 ? "no image artifacts this round: not applicable" : "not reviewed yet";
    if (mechGreen && imageFiles.length > 0) {
      phase("Visual review of image artifacts");
      const vv = await agent("Visual review-R" + round + "-A" + attempt, persona(VISUAL_EN + PROFILE_LINE, STRONG)).ask<VisualVerdict>(
        "This round's task: " + cards.title + ". Spec: the artifact spec table in Agents/requirements.md. Open and review each image (workspace-relative paths):\n" + imageFiles.join("\n") +
        "\nThree questions: does the data fill the domain it should (large blanks / only a handful of points); are axes, ticks and legend readable and consistent with the spec; can this image support the conclusion this round claims. Return VisualVerdict (name the file and what you saw).",
      );
      visualNote = vv.summary + ((vv.issues || []).length > 0 ? " | issues: " + (vv.issues || []).join("; ") : "");
      visualOk = (vv.issues || []).length === 0;
      if (!visualOk) log("Visual review not passed: " + visualNote.slice(0, 300));
    }
    if (mechGreen && visualOk) {
      gate = "pass (attempt " + attempt + (interpIsPy3 ? ", python3" : "") + (imageFiles.length > 0 ? ", incl. visual review" : "") + ")";
      break;
    }
    if (attempt === 10) {
      gate = (verdict.passed ? "" : "test verdict not passed; ") + (canary ? "" : "no canary; ") + (mapOk ? "" : "requirement map missing; ") + (dangerConsistent ? "" : "dangerous-operation declared/ruled/executed mismatch; ") + (visualOk ? "" : "visual review not passed; ") + (exitCode === 0 ? "" : "selfcheck exit " + exitCode);
      break;
    }
    if (verdict.findings.length === 0) {
      // Purely mechanical failure (no findings): Agents/selfcheck.py and the map are the tester's own fixtures — send them back to their owner, not through the engineer escalation path
      lastFix = null;
      await tester.ask<string>(
        "The mechanical gate is not satisfied (canary=" + (canary ? "present" : "missing") + "; requirement_map=" + (mapOk ? "valid" : "missing") + "; selfcheck exit=" + (canary ? exitCode : "not run") + ") while your verdict carries no findings. Agents/selfcheck.py and requirement_map.md are yours: fix or complete them and amend the changes into the round commit (git add -A && git commit --amend --no-edit); if selfcheck exposes an implementation defect, file it as a finding (with reproduction evidence) in your next verdict. Return one sentence.",
      );
      headA = await HEAD0();
      continue;
    }
    const juniorAsk = attempt <= 3; // 3 failed junior attempts -> escalate to the Senior Engineer (strong tier)
    if (!juniorAsk) escalations++;
    const fixer = juniorAsk
      ? agent("Rework-R" + round + "-A" + attempt, persona(ALGO_EN + PROFILE_LINE, CHEAP))
      : agent("Senior-rework-R" + round + "-A" + attempt, persona(ALGO_EN + SENIOR_EN + PROFILE_LINE, STRONG)); // one-shot instances: evidence travels in the task card, context stays bounded
    const fix = await fixer.ask<FixOutcome>(
      (juniorAsk ? "" : "[Escalation] The junior engineer could not solve the following in 3 attempts. You are the Senior Engineer (strong tier): find the root cause and fix it in one pass; amend into the same round commit.\n") +
      "Gate attempt " + attempt + " failed: " + (verdict.passed ? "(self-report green but selfcheck/map not satisfied)" : JSON.stringify(verdict.findings)) +
      "\nMechanical state: canary=" + (canary ? "present" : "missing") + "; requirement_map=" + (mapOk ? "valid" : "missing") + "; danger declared/ruled/executed aligned=" + (dangerConsistent ? "yes" : "no") + "; selfcheck exit=" + (canary ? exitCode : "not run") +
      (imageFiles.length > 0 ? "; image artifacts: " + imageFiles.join(", ") + "; visual review=" + (visualOk ? "passed" : "failed — " + visualNote) : "") +
      "\nOutput excerpt:\n" + output +
      "\nReproduce every finding first: confirmed -> fix; misdiagnosis -> evidence rebuttal (FixOutcome.rebutted); a stale entry (older line numbers, already fixed, not reproducible on this round's code) is discarded and marked \"stale\" — never code against it. Then git add -A && git commit --amend --no-edit into the round commit. Never rewrite history below the baseline.",
    );
    lastFix = fix;
    if ((fix.dangerRequests || []).length > 0) {
      phase("Destructive-operation review");
      const dr = await adjudicateDanger(fix.dangerRequests, juniorAsk ? "Algorithm Engineer" : "Senior Engineer", juniorAsk ? "cheap tier" : "strong tier", !juniorAsk);
      const ok2 = dr.decisions.filter((d) => d.decision !== "reject");
      approvedDanger = approvedDanger.concat(ok2.map((d) => d.safeForm || d.command));
      for (const d of ok2) dangerTrail.push({ declared: d.command, ruled: d.decision + (d.safeForm ? "|" + d.safeForm : ""), executed: "pending confirmation" });
      dangerLog = (dangerLog === "none" ? "" : dangerLog + "; ") + dr.decisions.map((d) => d.command + " -> " + d.decision + (d.safeForm ? " (as: " + d.safeForm + ")" : "") + ": " + d.reason).join("; ");
      if (ok2.length > 0) {
        phase("Run the approved destructive operations");
        const execReport2 = await fixer.ask<string>(dangerExecAsk(ok2));
        for (const e of dangerTrail) {
          if (e.executed !== "pending confirmation") continue;
          const form = e.ruled.split("|")[1] || e.declared;
          e.executed = execReport2.includes(form) ? form : "unconfirmed: executor report lacks the approved form";
          if (!execReport2.includes(form)) log("Dangerous-operation execution unconfirmed: " + e.declared + " — recorded honestly and counted by the gate");
        }
      } else {
        log("Every destructive request in the rework was rejected: no workaround allowed");
      }
    }
    const headFix = await HEAD0();
    let log2: { hash?: string }[] = [];
    try {
      log2 = await git.log(2);
    } catch {
      log2 = [];
    }
    const baselineStable = baseline === "" ? true : (log2[1]?.hash ?? "") === baseline;
    if (headFix === "" || headFix === headA || !baselineStable) {
      await fixer.ask<string>(
        "Amend-discipline check failed (HEAD=" + (headFix || "none").slice(0, 7) + ", baseline stable=" + baselineStable + "). Fixes must be amended into the round commit without touching history below the baseline; run git add -A && git commit --amend --no-edit (after fixing anything uncommitted) and return one sentence.",
      );
    }
    headA = headFix;
    rebuttedCount += fix.rebutted.length;
  }

  if (gate === "" || !gate.startsWith("pass")) {
    phase("Gate re-check limit reached, interrupt");
    const ir = await chief.ask<string>(
      "Round " + round + " gate is still not green after 10 gate re-checks (" + gate + "). Major issue: write docs/interrupt_report.md (current state, failure evidence, fixes attempted, points needing the boss's decision), git add -A && git commit (do not push the un-gated commit unless the boss agreed otherwise), return a one-sentence summary.",
    );
    await artifact.markdown("interrupt", "# Interrupt Report (round " + round + " gate)\n\n" + ir + "\n\n---\nGate: " + gate + "\nAwaiting the boss's decision.\n", { title: "Interrupt Report", description: "Gate still red after 10 re-checks" });
    finalVerdict = { verdict: "interrupted", requirementOutcomes: [], deviations: [], state: ir, decisionList: ["Round " + round + " gate not passed: " + gate], advice: "Gate persistently red; boss attention needed" };
    interrupted = true;
    ungatedHead = true;
    break;
  }
  headA = await HEAD0();

  phase("Push to the agreed remote");
  let pushState = "not pushed";
  if (push0.target !== "") {
    // Pre-push check: the remote HEAD should be this round's baseline (pushed and verified last round) — a mismatch means an agent likely pushed inside its session; record loudly
    try {
      const pre = await world.run("git", ["ls-remote", push0.target, "refs/heads/" + branch], { timeoutMs: 120000 });
      const preHead = ((pre.stdout || "").split("\t")[0] || "").trim();
      if (preHead !== "" && preHead !== baseline && preHead !== lastPushed) {
        log("Pre-push check anomaly: remote HEAD=" + preHead.slice(0, 7) + ", expected baseline=" + (baseline || "empty tree").slice(0, 7) + " — a session-internal push is suspected; recorded honestly");
      }
    } catch {
      /* ls-remote unreachable: the push outcome itself is recorded honestly */
    }
    // The orchestrator pushes and verifies directly (literal git command, target in args): no agent paraphrase involved; failures are recorded honestly
    let pushExit = -1;
    for (let t = 0; t < 2 && pushExit !== 0; t++) {
      try {
        const p = await world.run("git", ["push", push0.target, "HEAD:" + branch], { timeoutMs: 300000 });
        pushExit = p.exitCode;
        if (pushExit !== 0) log("Push attempt " + (t + 1) + " exit code " + pushExit + ": " + (p.stderr || p.stdout || "").slice(0, 200));
      } catch {
        log("Push attempt " + (t + 1) + " failed to launch (recorded honestly)");
      }
    }
    try {
      const ls = await world.run("git", ["ls-remote", push0.target, "refs/heads/" + branch], { timeoutMs: 120000 });
      const remoteHead = ((ls.stdout || "").split("\t")[0] || "").trim();
      if (remoteHead === headA && headA !== "") {
        pushState = "pushed & verified (" + headA.slice(0, 7) + "@" + push0.target + "/" + branch + ")";
        lastPushed = headA;
      } else {
        pushState = "push verification failed (reported honestly: remote=" + remoteHead.slice(0, 7) + ")";
      }
    } catch {
      pushState = "push verification failed (ls-remote unreachable; reported honestly)";
    }
  } else {
    pushState = "push skipped: " + push0.note;
  }
  log("Round " + round + " push: " + pushState);

  phase("Chief archives the ledger");
  const archived = await chief.ask<string>(
    "Record round " + round + " in Agents/ledger.md (head carries the repository identity line" + (repoRoot ? ": " + repoRoot : "") + " and the one-line-per-round index: update this round's index line first, then append the detail): cards, dev summary, destructive-operation ruling (" + dangerLog + "), test verdict (findings " + findingsCount + " / rebuttals " + rebuttedCount + " / escalated " + escalations + "), coverage statement (" + (verdict.coverage || "").slice(0, 300) + "), visual review (" + visualNote.slice(0, 200) + "), gate " + gate + ", baseline " + (baseline || "empty tree").slice(0, 7) + ", push " + pushState + ", deferred/declined sections (with reasons, “none” when empty), next direction. Then git add -A && git commit (the small ledger commit); return one sentence.",
  );
  const headLedger = await HEAD0();
  if (push0.target !== "" && headLedger !== "") {
    // The ledger commit is pushed and verified by the orchestrator as well: no agent paraphrase anywhere
    try {
      const pl = await world.run("git", ["push", push0.target, "HEAD:" + branch], { timeoutMs: 300000 });
      if (pl.exitCode !== 0) log("Ledger-commit push exit code " + pl.exitCode + ": " + (pl.stderr || "").slice(0, 200) + " — recorded honestly");
    } catch {
      log("Ledger-commit push failed to launch (recorded honestly)");
    }
  }
  log("Round " + round + " ledger " + (headLedger !== "" && headLedger !== headA ? "landed (" + headLedger.slice(0, 7) + ")" : "needs manual check"));
  if (push0.target !== "" && headLedger !== "") {
    try {
      const ls3 = await world.run("git", ["ls-remote", push0.target, "refs/heads/" + branch], { timeoutMs: 120000 });
      const rh3 = ((ls3.stdout || "").split("\t")[0] || "").trim();
      if (rh3 === headLedger) {
        lastPushed = headLedger;
        if (!pushState.startsWith("pushed")) log("The work commit failed push verification earlier, but the ledger push carried it to the remote — recorded honestly");
      } else {
        log("Ledger commit not verified on the remote (remote=" + rh3.slice(0, 7) + ", local=" + headLedger.slice(0, 7) + ") — recorded honestly; next round's remote-CI check re-examines it");
      }
    } catch {
      log("Ledger commit remote verification failed (ls-remote unreachable) — recorded honestly");
    }
  }
  rows.push({
    round,
    task: cards.title,
    dev: dev.summary,
    test: gate,
    findings: findingsCount + " findings / " + rebuttedCount + " rebuttals" + (escalations > 0 ? " / " + escalations + " escalated" : ""),
    push: pushState,
    next: archived.slice(0, 200),
  });
  report(rows[rows.length - 1], "rounds");
  plan = "Round " + (round + 1) + " planning basis: test verdict \u201c" + verdict.summary + "\u201d; dev leftovers \u201c" + dev.leftover + "\u201d; latest ledger entry.";
}

phase("Final report");
// Reconcile every requirement even after an interrupt: mark done vs not done, never drop an entry
const interruptNote = finalVerdict
  ? "This run was interrupted. Current state: " + finalVerdict.state + "; points awaiting the boss: " + finalVerdict.decisionList.join("; ") + ". Still reconcile every requirement: done ones carry outcome and evidence, undone ones say 'not done: reason' — no entry may be omitted. verdict must be interrupted."
  : "";
let reported = await chief.ask<FinalReport>(
    interruptNote + (interrupted ? "" : roundsTotal + " rounds complete — hard stop (or finished early).") +
    " Using Agents/requirements.md and the ledger as the only basis, write the Final Report to docs/final_report.md: every requirement (verbatim) -> outcome -> evidence (requirementOutcomes; a requirement without an entry is not done); deviations from the boss's requirements explained one by one (deviations); final state (commits/pushes/CI/tests/known limitations); decisions only the boss can make (decisionList); open questions answered one by one (questionAnswers: question text -> direct answer -> where the evidence is; when asked where something lives, answer the form too — raw or derived, whether a writer exists); the autonomous-decision list (autonomousDecisions: decision -> reason -> consequence if rejected -> Occam self-assessment \"adds complexity vs simplifies\"; any complexity-increasing decision must be here, never only in the ledger); two fixed sections — deferred and declined, each with its reason (a recorded deferral is a decision, not an omission; a declined idea is not re-proposed next run); fill the deferred/declined/processLessons fields faithfully (empty arrays when none); a process-lessons section — how the loop itself failed or nearly failed, distilled into checklist entries (each = rule + why + scope); adopted lessons persist and load with the next run (a disproven lesson is marked superseded, never left contradictory; re-validate against the current repo on load); one line of advice. This is a decision-layer document: no process narrative (which attempt went green, how many rebuttals, how many reworks — that is the ledger), gloss jargon on first use, one conclusion sentence at the top of each section, each requirement stated once, no code paths in the body (collect evidence pointers in one section), aiming at two pages or less (over that, keep only open items and key numbers and point to the ledger). At closing, also tidy the delivery: the repo root and docs/ keep only the artifacts the boss's words name plus what answering the boss requires; all working scaffolding (ledger, maps, Agents/selfcheck.py, test and debug scripts, falsified history) goes under Agents/ — Occam's razor at delivery. git add -A && git commit, return FinalReport.",
);
// Question guard (mechanical): questions in the boss's words with no answer in the report count as a missed requirement — answer once, then record honestly
const askedQ = ((requirement + " " + focus).match(/？|\?/g) || []).length;
if (askedQ > 0 && (!reported.questionAnswers || reported.questionAnswers.length === 0)) {
  reported = await chief.ask<FinalReport>(
    "The boss's words contain " + askedQ + " question mark(s) but FinalReport.questionAnswers is empty — a question evaporating at intake is a missed requirement. Answer each one (question text -> direct answer, including the form: raw or derived, whether a writer exists -> where the evidence is; write \"cannot answer: reason\" where you truly cannot), write it back to docs/final_report.md and git add -A && git commit --amend --no-edit, then return the full FinalReport.",
  );
  if (!reported.questionAnswers || reported.questionAnswers.length === 0) log("Report still lacks answered questions (recorded honestly; the boss's words contain " + askedQ + " question mark(s))");
}
// The final-report commit is pushed and verified by the orchestrator (the closing ask no longer instructs a push; never push with an un-gated commit at HEAD)
let finalPush = push0.target === "" ? "push skipped: " + push0.note : (ungatedHead ? "not pushed: an un-gated commit is at HEAD (recorded honestly)" : "not pushed");
if (push0.target !== "") {
  if (!ungatedHead) {
    const headFinal = await HEAD0();
    try {
      const pf = await world.run("git", ["push", push0.target, "HEAD:" + branch], { timeoutMs: 300000 });
      if (pf.exitCode === 0) {
        try {
          const lf = await world.run("git", ["ls-remote", push0.target, "refs/heads/" + branch], { timeoutMs: 120000 });
          const rhf = ((lf.stdout || "").split("\t")[0] || "").trim();
          finalPush = rhf === headFinal && headFinal !== "" ? "pushed & verified (" + headFinal.slice(0, 7) + ")" : "push verification failed (reported honestly: remote=" + rhf.slice(0, 7) + ")";
        } catch {
          finalPush = "push executed, verification unavailable (recorded honestly)";
        }
      } else {
        finalPush = "push exit code " + pf.exitCode + " (recorded honestly: " + (pf.stderr || "").slice(0, 200) + ")";
      }
    } catch {
      finalPush = "push failed to launch (recorded honestly)";
    }
  }
  log("Final-report push: " + finalPush);
}
const md = [
  "# Final Report",
  "",
  "Boss's requirement (verbatim): " + requirement,
  "",
  "## Requirement reconciliation",
  ...reported.requirementOutcomes.map((o) => "- **" + o.id + "** \u201c" + o.verbatim + "\u201d -> " + o.outcome + " (evidence: " + o.evidence + ")"),
  "",
  "## Deviations",
  reported.deviations.length > 0 ? reported.deviations.map((d) => "- " + d) : "- None: no deviation from the boss's requirements occurred",
  "",
  "## Final state",
  reported.state,
  "",
  "## Awaiting the boss",
  ...reported.decisionList.map((d) => "- " + d),
  "",
  "## Your questions, answered",
  (reported.questionAnswers && reported.questionAnswers.length > 0) ? reported.questionAnswers.map((x) => "- \u201c" + x.q + "\u201d -> " + x.a + " (evidence: " + x.evidence + ")") : ["- none (no questions in this run's requirement)"],
  "",
  "## Autonomous decisions (please confirm or overturn)",
  (reported.autonomousDecisions && reported.autonomousDecisions.length > 0) ? reported.autonomousDecisions.map((x) => "- " + x.decision + " | why: " + x.reason + " | if rejected: " + x.ifRejected + " | Occam: " + x.occam) : ["- none"],
  "",
  "## Deferred",
  (reported.deferred && reported.deferred.length > 0) ? reported.deferred.map((d) => "- " + d.item + " (reason: " + d.reason + ")") : ["- none"],
  "",
  "## Declined",
  (reported.declined && reported.declined.length > 0) ? reported.declined.map((d) => "- " + d.item + " (reason: " + d.reason + ")") : ["- none"],
  "",
  "## Process lessons",
  (reported.processLessons && reported.processLessons.length > 0) ? reported.processLessons.map((d) => "- " + d) : ["- none"],
  "",
  "## Advice",
  reported.advice,
  "",
  "---",
  "Verdict: " + reported.verdict + "; rounds executed: " + rows.length + ".",
].join("\n");
await artifact.markdown("report", md, { title: "Final Report", description: "Requirement reconciliation + deviations + decision list", primary: true });

return {
  conclusion: reported.advice,
  verdict: reported.verdict,
  rounds_completed: rows.length,
  requirement_coverage: reported.requirementOutcomes.length,
  deviations: reported.deviations.length,
  next_action: reported.decisionList.length > 0 ? "Awaiting the boss: " + reported.decisionList[0] : "Delivery complete; awaiting the boss's acceptance",
};
