/* zcode-workflow
description: Robust Engineering Loop (v0.2.7), English UI. Chief records a verbatim requirement ledger and commits to N rounds (boss may lock via rounds) -> each round, the Algorithm Engineer builds + docs (docs are a deliverable — professional, clean, concise, non-redundant) in ONE local commit -> Test Engineer COLD START (fresh agent context; sees only the diff and the code, never the dev self-report) with diff review (incl. doc quality) + robustness suite + canary + local CI green + warnings-as-errors build + remote-CI carryover check of the previous push -> on failure the engineer reproduces first (confirmed -> fix; misdiagnosis -> evidence rebuttal; tester arbitrates) -> amend into the round commit -> re-verify (10 attempts still red -> interrupt and report to the boss) -> only when fully green, push to the agreed remote (GitCoffer auto-detected by default; append-only, never force) -> Chief ledger commit; hard stop after N rounds -> Final Report (requirement -> outcome -> evidence, deviations included); destructive operations are declared, never executed unilaterally — junior declarations ruled on by the Senior Engineer, escalation-phase declarations by the Chief (the ruler is never the declarer) — never handed back to the boss; resumes from the ledger. Model tiering (tiered — Chief and Senior Engineer on GLM-5.3, engineer and tester on GLM-5.3-Flash; a finding the junior cannot solve in 3 fix attempts escalates to the Senior Engineer; models=uniform puts every role on the session model).
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

/** 可发问的裁决者（结构类型：agent() 的返回值天然满足；不引用门面函数本身） */
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
  /** One-sentence advice to the boss */
  advice: string;
}

const CHIEF_EN = [
  "You are the Chief Engineer. Mission: turn the boss's (user's) development requirement into a high-quality delivery within a committed, bounded number of rounds — every round passes cold-start verification, a fully green gate and a zero-warning build before anything is pushed.",
  "Boss fidelity is the top discipline: before round 1 create docs/workflow/requirements.md — the boss's words verbatim, each with interpretation and acceptance criteria, none dropped; never act against the boss's requirements; a deviation you cannot avoid must be explained line by line in the Final Report — never silently.",
  "Interrupt policy: major issues (infeasible requirement, scope-changing ambiguity, extending the round count, gate still red after 10 gate re-checks) -> interrupt the loop immediately; a destructive operation is not itself an interrupt trigger — it goes to the danger-clause ruling (junior declarations -> Senior Engineer; the Senior Engineer's own declarations in the escalation phase -> you), and only when the round still cannot proceed after the ruling do you interrupt and write docs/workflow/interrupt_report.md for the boss; minor issues (in-scope implementation details, tooling choices, ordering) -> decide yourself and log the decision. Scope, schedule, quality bar and budget are boss-level tradeoffs — you may not downgrade them to minor.",
  "Round planning: commit to N rounds with a one-line scope each before round 1 (a boss-locked rounds value is final — no adding or dropping); each round re-plan from the ledger — last round's verdict, findings and rebuttals, remote-CI carryover and leftovers must all be disposed of; every work card traces to a requirement entry (R1/R2...).",
  "Misdiagnosis arbitration: when the engineers dispute a finding, arbitrate on evidence only; if still undecided -> major issue, interrupt and report to the boss.",
  "Take over by reading the ledger (docs/workflow/ledger.md): resume, never redo; the ledger also records each round's baseline hash and pushed SHAs.",
  "Honesty first: reports quote command outputs and exit codes only; say what you don't know; escalate contradictions instead of working around them.",
].join("\n");

const ALGO_EN = [
  "You are the Algorithm Engineer: implement this round's work cards; make exactly ONE local commit per round (the round commit), message in one sentence. Docs are a deliverable: professional, clean and concise — one home per fact, no redundancy or duplication; every code change ships with its doc change in the same commit.",
  "The working tree is frozen while the Test Engineer verifies: do not modify the implementation under test.",
  "Rework discipline: reproduce every finding before touching code — confirmed findings get fixes; findings you cannot reproduce or that contradict the facts get evidence rebuttals (command output, spec citation). Never blindly \"fix\" a non-issue — churn is not progress.",
  "Fixes always land as git add -A && git commit --amend --no-edit into the round commit: never rewrite pushed history, never amend below the baseline.",
  "Your dev report (with per-card requirement coverage) goes to the Chief for planning only; the Test Engineer never sees it — the cold start is by design, not an oversight.",
  "Report failures as failures; escalate contradictions. Never fake, never bypass the gate, never force-push.",
  "Destructive-operation rule: rm -rf / deleting directories or data files / git reset --hard / git clean -fdx / force push / rewriting pushed history / overwriting others' artifacts are declared, never executed unilaterally — put them in dangerRequests (exact command, reason, blast radius) and wait for the Senior Engineer's ruling, then run exactly the approved form; never improvise, never widen the scope.",
  "You run on the cheap tier as the junior engineer: when the same problem survives 3 fix attempts, stop grinding — write up the minimal reproduction and a root-cause hypothesis and hand it to the Senior Engineer (strong model).",
].join("\n");

const SENIOR_EN = [
  "You are the Senior Engineer (escalation path, strong tier): findings the junior could not solve in 3 fix attempts escalate to you. Read the gate output and the ledger first and fix the root cause in one pass rather than papering over symptoms; your fixes amend into the same round commit under the engineer's full discipline. If it is a genuine blocker (contradictory requirements, unusable environment), say so plainly and recommend an interrupt.",
  "You are also one of the authorities on destructive operations: adjudicate each request from the junior engineer — is the blast radius precisely bounded, is it reversible, is there a narrower safe equivalent (scoped path, dry-run first, back up first, list the affected files first)? Reject by default; use approve-with-change with the safe form written into safeForm when a safer equivalent exists; approve only when necessary and safe (in the escalation phase your own declarations are ruled on by the Chief — you never rule on your own).",
  "This ruling is never handed back to the boss: only when the round cannot proceed at all without the operation (an index must be rebuilt, corrupted artifacts must be removed) should you say so and recommend the Chief's interrupt path — routine deletions never block on the user.",
].join("\n");

const TEST_EN = [
  "You are the Test Engineer, cold-started: you work only from the diff (baseline..HEAD) and the repository itself, never from the author's narrative; nobody will hand you the dev report — author claims anchor a verifier, and this is by design.",
  "Diff review: review what actually changed, not what was claimed: new code, changed behavior, docs-vs-implementation consistency — and doc quality (professional, concise, free of redundant or duplicated information) is a finding when lacking.",
  "Write and maintain robustness tests: boundary and adversarial inputs, perturbation scenarios where applicable; create/maintain selfcheck.py at the repo root aggregating, per the project profile: a strict build (warnings are errors: -Werror / /WX / -D warnings / deny(warnings), per language), the full test suite + robustness cases, and the local CI equivalent (if the repo has CI, it must run green locally).",
  "selfcheck.py must contain a deliberately-broken canary case marked `canary` (the orchestrator verifies it by search) — a suite that cannot go red proves nothing.",
  "Check the previous round's push on the remote: on GitHub remotes with gh available use gh run list / gh run view; if uncheckable, say so honestly — an unchecked CI is never reported as passed; failures become mandatory fix items this round.",
  "Destructive-operation criterion (aligned with the declaration duty): beyond the approved list — data files or whole directories vanishing, history below the baseline rewritten, a force push, existing artifacts overwritten — is a blocker; demand the declaration and the ruling record. Source-file deletions in an ordinary refactor are not destructive, but must stay traceable.",
  "Independence is absolute: never edit the implementation under test. You only write selfcheck.py, the robustness cases, and the verification column of docs/workflow/requirement_map.md (requirement <-> implementation location <-> re-runnable command, tabular with a requirement-map marker).",
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

const CHIEF_BLOCK_NOTE = "\n(For a major issue, fill blocked and stop issuing cards: write docs/workflow/interrupt_report.md — problem, completed rounds and artifacts, the points needing the boss's decision, suggested options — then commit locally.)";

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
  ledger = await files.read("docs/workflow/ledger.md");
} catch {
  ledger = "";
}
try {
  const st = await world.run("git", ["status", "--porcelain"], { timeoutMs: 60000 });
  if ((st.stdout || "").trim() !== "") log("Warning: working tree not clean — start from a clean tree; recorded honestly in the ledger");
} catch {
  /* no git or not checkable: skip */
}
const push0 = await resolvePushTarget();
if (push0.note !== "") log("Push target: " + push0.note);
const commit0 = await chief.ask<Commitment>(
  "Boss's requirement (verbatim): " + requirement + "\n" + (focus ? "Boss focus: " + focus + "\n" : "") +
  (ledger ? "Existing ledger (tail excerpt; the resume basis):\n" + ledger.slice(-4000) + "\nIf it shows N rounds already completed for this requirement, resumeFrom = N (continue at round N+1, never redo); otherwise 0.\n" : "No ledger: resumeFrom = 0.\n") +
  "Before round 1, three things: 1) create docs/workflow/requirements.md — the boss's words verbatim, numbered (R1/R2...), each with interpretation and acceptance criteria, none dropped; if a scope-changing ambiguity exists, raise it in blocked.question first (the only pre-start question); 2) commit to roundsTotal with a one-line scope per round in roundsOutline" +
  (roundsArg > 0 ? " (the boss locked rounds=" + roundsArg + " — adopt it, no adding or dropping)" : " (planned by you; once fixed, no extension except via interrupt)") +
  "; 3) commit the ledger locally. Return Commitment." + CHIEF_BLOCK_NOTE,
);
let roundsTotal = roundsArg > 0 ? roundsArg : Math.round(commit0.roundsTotal);
if (!(roundsTotal >= 1)) roundsTotal = 3;
if (roundsTotal !== (roundsArg > 0 ? roundsArg : commit0.roundsTotal)) {
  log("Rounds total " + commit0.roundsTotal + " invalid; using " + roundsTotal + " (recorded honestly)");
}
if (commit0.blocked) {
  phase("Major issue interrupt");
  const ir = await chief.ask<string>(
    "Interrupted per blocked. Complete docs/workflow/interrupt_report.md (problem, completed rounds and artifacts, points needing the boss's decision, suggested options), git add -A && git commit, and return a one-sentence summary for the boss.",
  );
  await artifact.markdown("interrupt", "# Interrupt Report\n\n" + ir + "\n\n---\nAfter the boss decides, rerun this workflow with the decision note (the ledger holds the checkpoint).\n", { title: "Interrupt Report", description: "Major issue: awaiting the boss's decision" });
  return { conclusion: "Interrupted: " + commit0.blocked.reason, question: commit0.blocked.question, rounds_completed: 0, next_action: "Rerun after the boss decides (resume from the ledger)" };
}
log("Round commitment: " + roundsTotal + " rounds; outline: " + String(commit0.roundsOutline || "").replace(/\n/g, "; "));
const startRound = Math.max(1, Math.min(roundsTotal + 1, Math.round(commit0.resumeFrom) + 1));
if (startRound > 1) log("Ledger shows " + (startRound - 1) + " round(s) done; resuming at round " + startRound);

const algo = agent("Algorithm Engineer", persona(ALGO_EN + PROFILE_LINE, CHEAP)); // cheap tier: junior engineer
const senior = agent("Senior Engineer", persona(ALGO_EN + SENIOR_EN + PROFILE_LINE, STRONG)); // strong tier: escalation path + destructive-operation authority

/** Destructive-operation review: the executor only declares; an independent strong tier rules (junior -> Senior Engineer; escalation-phase Senior -> Chief) — the ruler is never the declarer, never the boss */
async function adjudicateDanger(reqs: DangerRequest[], requester: string, requesterTier: string, byChief: boolean): Promise<DangerReview> {
  const askText =
    "Destructive-operation review. Requester: " + requester + " (" + requesterTier + "). Rule on each request:\n" + JSON.stringify(reqs) +
    "\nJudge by: is the blast radius precisely bounded, is it reversible, is there a narrower safe equivalent (scoped path, dry-run first, back up first, list affected files first)? Reject by default; use approve-with-change with a safeForm when a safer equivalent exists; approve only when necessary and safe. " +
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
const rows: RoundRow[] = [];
let lastPushed = ""; // last round's pushed SHA (for the next round's remote-CI check)
let plan = String(commit0.roundsOutline || "");
let finalVerdict: FinalReport | null = null;
let interrupted = false;

for (let round = startRound; round <= roundsTotal && !interrupted; round++) {
  const baseline = await HEAD0();
  phase("Chief issues cards");
  const cards = await chief.ask<RoundCards>(
    "Round " + round + "/" + roundsTotal + ". Requirements live in docs/workflow/requirements.md; planning basis:\n" + String(plan).slice(0, 4000) + "\n" +
    (lastPushed ? "Last round pushed " + lastPushed.slice(0, 7) + ": first check its remote CI status on (" + (push0.target || "not configured") + ") via gh run list/view; if uncheckable, say so honestly; failures go into remoteCiIssues as mandatory fix items.\n" : "") +
    "Issue this round's work cards: one sentence each, traceable to requirement entries; dispose of last round's findings, rebuttals and leftovers one by one. Set done=true only if every requirement is closed and the gate is green." + CHIEF_BLOCK_NOTE,
  );
  if (cards.blocked) {
    const ir = await chief.ask<string>(
      "Interrupted per blocked (before round " + round + " started). Complete docs/workflow/interrupt_report.md, git add -A && git commit (and push to " + (push0.target || "no agreed remote") + ", no force), return a one-sentence summary.",
    );
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
    const ir0 = await chief.ask<string>("Zero work cards and not done is a planning anomaly: write the reason to docs/workflow/ledger.md and git add -A && git commit; return one sentence.");
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
  if ((dev.dangerRequests || []).length > 0) {
    phase("Destructive-operation review");
    const review = await adjudicateDanger(dev.dangerRequests, "Algorithm Engineer", "cheap tier", false);
    dangerLog = review.decisions.map((d) => d.command + " -> " + d.decision + (d.safeForm ? " (as: " + d.safeForm + ")" : "") + ": " + d.reason).join("; ");
    log("Round " + round + " destructive-operation ruling: " + dangerLog.slice(0, 300));
    const ok = review.decisions.filter((d) => d.decision !== "reject");
    approvedDanger = ok.map((d) => d.safeForm || d.command);
    if (ok.length > 0) {
      phase("Run the approved destructive operations");
      await algo.ask<string>(dangerExecAsk(ok));
      headA = await HEAD0();
    } else {
      log("All destructive requests rejected: nothing runs, no workarounds");
    }
  }

  phase("Test Engineer cold-start gate");
  const tester = agent("Test Engineer R" + round, persona(TEST_EN + PROFILE_LINE, CHEAP)); // fresh instance per round: cold start; cheap tier
  const diffHint = baseline ? "git diff " + baseline + "..HEAD" : "git show HEAD (the repository's first commit)";
  let verdict: TestVerdict = { summary: "not started", passed: false, findings: [] };
  let gate = "";
  let canary = false;
  let mapOk = false;
  let findingsCount = 0;
  let rebuttedCount = 0;
  let escalations = 0; // fix attempts escalated to the Senior Engineer (strong tier)
  let interpIsPy3 = false;
  let lastFix: FixOutcome | null = null;

  for (let attempt = 1; attempt <= 10; attempt++) {
    verdict = await tester.ask<TestVerdict>(
      (attempt === 1
        ? "Cold start. Baseline commit: " + (baseline || "(empty tree — this repo's first commit)") + ". Review " + diffHint + " and the repository itself: diff review, robustness tests, selfcheck.py (strict build / full tests + robustness / local CI equivalent + canary marker), and update the verification column of docs/workflow/requirement_map.md."
        : "The engineer has reworked (amended into the round commit); their fix report (a reconciliation lead only — your verdict rests on the checks you re-run): " + JSON.stringify(lastFix) + "\nRe-verify one by one: re-run the original failing check for each fix to confirm closure; arbitrate each rebuttal on evidence only — withdraw the finding if the rebuttal stands, keep it with an explanation if not.") +
      (cards.remoteCiIssues.length > 0 ? "\nAlso: the mandatory remote-CI items were handled by the engineer: " + cards.remoteCiIssues.join("; ") : "") +
      (approvedDanger.length > 0
        ? "\nDestructive operations approved by ruling this round — only these forms are allowed: " + approvedDanger.join("; ")
        : "\nNo destructive operation was approved this round: data files or whole directories vanishing, history below the baseline rewritten, a force push, or existing artifacts overwritten in the diff or history is an unapproved destructive operation — mark it blocker (source-file deletions in an ordinary refactor excepted).") +
      " Return TestVerdict (every finding needs reproduction evidence).",
    );
    findingsCount = verdict.findings.length;
    try {
      canary = (await files.grep("canary", "selfcheck.py")).length > 0;
    } catch {
      canary = false;
    }
    try {
      const map = await files.read("docs/workflow/requirement_map.md");
      mapOk = map.includes("requirement-map") && map.split("\n").filter((l) => l.trim().startsWith("|")).length >= 2;
    } catch {
      mapOk = false;
    }
    let exitCode = -1;
    let output = "";
    if (canary) {
      try {
        const r = interpIsPy3
          ? await world.run("python3", ["selfcheck.py"], { timeoutMs: 3600000 })
          : await world.run("python", ["selfcheck.py"], { timeoutMs: 3600000 });
        exitCode = r.exitCode;
        output = (r.stderr || r.stdout || "(no output)").slice(0, 1500);
      } catch {
        if (!interpIsPy3) {
          interpIsPy3 = true;
          try {
            const r = await world.run("python3", ["selfcheck.py"], { timeoutMs: 3600000 });
            exitCode = r.exitCode;
            output = (r.stderr || r.stdout || "(no output)").slice(0, 1500);
          } catch {
            output = "neither python nor python3 could launch selfcheck.py";
          }
        } else {
          output = "selfcheck.py failed to launch or timed out";
        }
      }
    } else {
      output = "selfcheck.py lacks the canary marker (a must-fail control case)";
    }
    if (verdict.passed && exitCode === 0 && canary && mapOk) {
      gate = "pass (attempt " + attempt + (interpIsPy3 ? ", python3" : "") + ")";
      break;
    }
    if (attempt === 10) {
      gate = (verdict.passed ? "" : "test verdict not passed; ") + (canary ? "" : "no canary; ") + (mapOk ? "" : "requirement map missing; ") + (exitCode === 0 ? "" : "selfcheck exit " + exitCode);
      break;
    }
    const juniorAsk = attempt <= 3; // 3 failed junior attempts -> escalate to the Senior Engineer (strong tier)
    if (!juniorAsk) escalations++;
    const fixer = juniorAsk ? algo : senior;
    const fix = await fixer.ask<FixOutcome>(
      (juniorAsk ? "" : "[Escalation] The junior engineer could not solve the following in 3 attempts. You are the Senior Engineer (strong tier): find the root cause and fix it in one pass; amend into the same round commit.\n") +
      "Gate attempt " + attempt + " failed: " + (verdict.passed ? "(self-report green but selfcheck/map not satisfied)" : JSON.stringify(verdict.findings)) +
      "\nMechanical state: canary=" + (canary ? "present" : "missing") + "; requirement_map=" + (mapOk ? "valid" : "missing") + "; selfcheck exit=" + (canary ? exitCode : "not run") +
      "\nOutput excerpt:\n" + output +
      "\nReproduce every finding first: confirmed -> fix; misdiagnosis -> evidence rebuttal (FixOutcome.rebutted). Then git add -A && git commit --amend --no-edit into the round commit. Never rewrite history below the baseline.",
    );
    lastFix = fix;
    if ((fix.dangerRequests || []).length > 0) {
      phase("Destructive-operation review");
      const dr = await adjudicateDanger(fix.dangerRequests, juniorAsk ? "Algorithm Engineer" : "Senior Engineer", juniorAsk ? "cheap tier" : "strong tier", !juniorAsk);
      const ok2 = dr.decisions.filter((d) => d.decision !== "reject");
      approvedDanger = approvedDanger.concat(ok2.map((d) => d.safeForm || d.command));
      dangerLog = (dangerLog === "none" ? "" : dangerLog + "; ") + dr.decisions.map((d) => d.command + " -> " + d.decision + (d.safeForm ? " (as: " + d.safeForm + ")" : "") + ": " + d.reason).join("; ");
      if (ok2.length > 0) {
        phase("Run the approved destructive operations");
        await fixer.ask<string>(dangerExecAsk(ok2));
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
      "Round " + round + " gate is still not green after 10 gate re-checks (" + gate + "). Major issue: write docs/workflow/interrupt_report.md (current state, failure evidence, fixes attempted, points needing the boss's decision), git add -A && git commit (do not push the un-gated commit unless the boss agreed otherwise), return a one-sentence summary.",
    );
    await artifact.markdown("interrupt", "# Interrupt Report (round " + round + " gate)\n\n" + ir + "\n\n---\nGate: " + gate + "\nAwaiting the boss's decision.\n", { title: "Interrupt Report", description: "Gate still red after 10 re-checks" });
    finalVerdict = { verdict: "interrupted", requirementOutcomes: [], deviations: [], state: ir, decisionList: ["Round " + round + " gate not passed: " + gate], advice: "Gate persistently red; boss attention needed" };
    interrupted = true;
    break;
  }
  headA = await HEAD0();

  phase("Push to the agreed remote");
  let pushState = "not pushed";
  let branch = "main";
  try {
    const b = await world.run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { timeoutMs: 60000 });
    branch = (b.stdout || "").trim() || "main";
  } catch {
    branch = "main";
  }
  if (push0.target !== "") {
    await algo.ask<string>("Gate is green. Push this round's commit to the agreed remote: git push " + push0.target + " HEAD:" + branch + " (never --force). Return one sentence.");
    try {
      const ls = await world.run("git", ["ls-remote", push0.target, "refs/heads/" + branch], { timeoutMs: 120000 });
      const remoteHead = ((ls.stdout || "").split("\t")[0] || "").trim();
      if (remoteHead === headA && headA !== "") {
        pushState = "pushed & verified (" + headA.slice(0, 7) + "@" + push0.target + "/" + branch + ")";
        lastPushed = headA;
      } else {
        await algo.ask<string>("Push verification failed (remote HEAD=" + remoteHead.slice(0, 7) + " != local " + headA.slice(0, 7) + "). Push once more: git push " + push0.target + " HEAD:" + branch + " (no force); return one sentence.");
        try {
          const ls2 = await world.run("git", ["ls-remote", push0.target, "refs/heads/" + branch], { timeoutMs: 120000 });
          const rh2 = ((ls2.stdout || "").split("\t")[0] || "").trim();
          if (rh2 === headA && headA !== "") {
            pushState = "pushed & verified (after retry)";
            lastPushed = headA;
          } else {
            pushState = "push verification failed (reported honestly: remote=" + rh2.slice(0, 7) + ")";
          }
        } catch {
          pushState = "push verification failed (ls-remote unavailable; reported honestly)";
        }
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
    "Append round " + round + " to docs/workflow/ledger.md: cards, dev summary, destructive-operation ruling (" + dangerLog + "), test verdict (findings " + findingsCount + " / rebuttals " + rebuttedCount + " / escalated " + escalations + "), gate " + gate + ", baseline " + (baseline || "empty tree").slice(0, 7) + ", push " + pushState + ", next direction. Then git add -A && git commit (the small ledger commit)" +
    (push0.target !== "" ? " and push it (git push " + push0.target + ", no force)" : "") + "; return one sentence.",
  );
  const headLedger = await HEAD0();
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
const reported = await chief.ask<FinalReport>(
    interruptNote + (interrupted ? "" : roundsTotal + " rounds complete — hard stop (or finished early).") +
    " Using docs/workflow/requirements.md and the ledger as the only basis, write the Final Report to docs/workflow/final_report.md: every requirement (verbatim) -> outcome -> evidence (requirementOutcomes; a requirement without an entry is not done); deviations from the boss's requirements explained one by one (deviations); final state (commits/pushes/CI/tests/known limitations); decisions only the boss can make (decisionList); one line of advice. git add -A && git commit" +
      (push0.target !== "" ? " and push to the agreed remote (no force)" : "") + ". Return FinalReport.",
);
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
