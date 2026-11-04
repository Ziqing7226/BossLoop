/* zcode-workflow
description: Research Iteration Loop (v0.3.3), English UI. Start from a rough idea and decide in N bounded rounds whether it deserves more. Each round the Chief re-selects the proposal portfolio (1-3) from the latest reviews; the Engineer runs staged experiments (numbers only from FULL end-to-end runs); the Tester verifies independently (claim-to-evidence map + a mechanical selfcheck gate with a canary, owning the test fixtures); fixes land; the Researcher revises the manuscript; the Editor runs blind review (adjacent-field reviewers + a full-reference reader; per-round novelty check and experiment mortality archived). Hard stop after N rounds yields the Preliminary Evaluation Report; resumes from the ledger; destructive operations are declared and ruled by the strong-tier Chief, never handed to the boss; model tiering tiered/uniform.
args:
  idea:
    type: string
    required: true
    description: The rough idea to iterate on (one paragraph)
  rounds:
    type: number
    default: 3
    description: Total rounds before the hard stop (ledger allows resuming)
  focus:
    type: string
    default: ""
    description: The boss's focus note for this run (optional)
  profile:
    type: string
    default: ""
    description: Project-level constraints (hardware/memory limits, read-only data rules, forbidden practices, backup policy; optional)
  models:
    type: string
    default: "tiered"
    description: Model tiering; tiered = analysis roles (chief/editor/reviewers/reader) on the strong model and hands-on roles (engineer/tester/researcher) on the cheap one (GLM-5.3 vs GLM-5.3-Flash here), uniform = every role on the session model
*/

interface SurveyResult {
  /** Survey conclusion in 2-3 sentences */
  summary: string;
  /** Papers you cannot access (title + venue), for the boss to fetch; non-blocking — proceed with lower confidence */
  paperRequests: string[];
  /** Chosen proposals (count decided by the Chief, ≤3) */
  proposals: string[];
  /** Competitors to reproduce (≤3, one-line reason each) */
  competitors: string[];
  /** Rounds already completed per the ledger; 0 for a fresh start (drives the resume point) */
  resumeFrom: number;
}

interface WorkCards {
  /** This round's theme in one sentence */
  title: string;
  /** Proposals selected this round (1-3, mechanically checked) */
  proposals: string[];
  /** Work cards, one instruction each */
  cards: string[];
}

interface DevReport {
  /** One sentence: what was done */
  summary: string;
  /** Artifact paths */
  artifacts: string[];
  /** End-to-end numbers actually run, each with its exact definition (data, window, units, per-accumulator meaning) - FULL-stage runs only */
  numbers: string[];
  /** Experiment mortality this round: attempted/passed (honestly counting debug-stage deaths) */
  experiments: string;
  /** Destructive operations needed (delete datasets / overwrite artifacts / rewrite history): declare only, never run them; empty when none */
  dangerRequests: DangerRequest[];
  /** Leftovers, or "none" */
  leftover: string;
}

interface TestVerdict {
  /** One-sentence verdict */
  summary: string;
  /** Issues (code / generalization / reliability), each with evidence */
  issues: string[];
  /** Coverage statement: areas reviewed deeply vs only skimmed (written before the verdict, reconciled later) */
  coverage: string;
  /** Artifact paths produced this round (images/figures included; list gitignored ones too so the visual review can find them); empty when none */
  artifacts?: string[];
}

interface VisualVerdict {
  /** One-sentence verdict */
  summary: string;
  /** Per-image issues (file name + one sentence + what was seen); empty when clean */
  issues: string[];
}

interface Invite {
  /** Reviewer count decided by the Editor (1-3) */
  count: number;
  /** Extracted keywords */
  keywords: string[];
  /** Tight reviewer brief: manuscript + evidence map + targeted questions (never the whole repo) */
  brief: string;
}

interface Review {
  /** One-sentence verdict */
  summary: string;
  /** Sharp issues, each with evidence (manuscript section / file:line / reference) */
  issues: string[];
  /** Next-round iteration proposals */
  iteration: string[];
  /** Closest existing works and the difference dimension (mandatory for the Reference Reader; optional for others) */
  nearestWorks?: string[];
  severity: "minor" | "major" | "blocker";
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
  /** Safe form when approve-with-change; empty on a plain approve */
  safeForm: string;
  reason: string;
}

interface DangerReview {
  summary: string;
  decisions: DangerDecision[];
}

interface RoundRow {
  round: number;
  task: string;
  /** Proposals selected this round */
  portfolio: string;
  dev: string;
  experiments: string;
  test: string;
  review: string;
  next: string;
}

interface EvalReport {
  verdict: "continue" | "pivot" | "stop";
  /** Expected success: a qualitative judgement expressed as a number, not a calibrated probability; must cite the experiment-mortality trend and the novelty check (say so) */
  successOdds: string;
  novelty: string;
  impact: string;
  risks: string[];
  /** Verbatim quotes of every reviewer's verdict — never paraphrased */
  reviewerQuotes: string[];
  /** Questions in the boss's own words -> direct answer (including the artifact's form) -> where the evidence is */
  questionAnswers?: { q: string; a: string; evidence: string }[];
  /** Autonomous decisions: decision, reason, consequence if rejected, Occam self-assessment (adds complexity vs simplifies) */
  autonomousDecisions?: { decision: string; reason: string; ifRejected: string; occam: string }[];
  /** One-sentence advice to the boss */
  advice: string;
}

const CHIEF_EN = [
  "You are the Chief Engineer. Mission: decide within a bounded number of rounds whether args.idea deserves deep investment, and drive it forward — not perfect it.",
  "Take over by reading the ledger (Agents/ledger.md): if this idea already has a record, resume from that round instead of redoing finished rounds.",
  "Opening brief docs/brief.md (after scoping, before round 1 starts; at most one page, three mandatory sections): (1) sentence inventory — every sentence of the boss's words (idea, focus, boss_directives) split and marked fulfilled-as-Rn / not-applicable-with-reason / needs-clarification; (2) artifact spec table — for each deliverable this round (figure, table, report, manuscript section) its axis, domain, units and pass criteria (machine-checkable), with every number and format word in the boss's words landing on a row; (3) open questions — every interrogative sentence logged (text, when logged, answer status). Then start working immediately — never idle waiting for the boss to look at it.",
  "The reading of the boss's words must be self-consistent and capture the gist; what you cannot pin down, never guess — carry the boss's words verbatim (quoted, marked unsure) in the brief; the engineers may resolve them during development or testing. Verbatim fidelity is not semantic fidelity: copying the words while misreading the meaning is the most dangerous failure; when the boss's words cannot be filled into the spec table (e.g. a number reads either as bin width or as axis range), do not pick one literal reading.",
  "Before planning each round, check the open questions: with unanswered items, the first card is the answer (a cheap answer that directly shapes the boss's judgement).",
  "Occam's razor: autonomous decisions lean toward adding things (modules, proposals, metrics) — every complexity-increasing decision must state the value it buys, or it is not taken; such a decision never lives only in the ledger — it goes into the Preliminary Evaluation Report's autonomous-decision list.",
  "Two file classes (delivery discipline), bounded by location: everything not under Agents/ is boss-facing — the artifacts the boss's words name, the manuscript, docs/brief.md, docs/boss_directives.md (written by the boss) and the evaluation report; everything under Agents/ is working scaffolding — the ledger, maps, Agents/selfcheck.py, test and debug scripts, falsified history, agent-facing docs. Tidying means git mv-ing scaffolding into Agents/, never deleting a file — deletion is the boss's move; the boss reads everything outside Agents/; if the boss has to open Agents/, the loop has failed.",
  "The proposal portfolio is re-selected every round: at the start of each round pick 1-3 proposals from the latest reviews (add, drop or replace; fill up to 3 when choices exist, 1-2 otherwise, never 0) and the competitor set; every proposal selected this round must be fully validated - a minimal comparison passed off as validation is forbidden because it biases conclusions.",
  "Round planning: dispose of every review issue - either turn it into a work card or rebut it on archived artifacts; never ignore one verbally.",
  "Novelty handling: if the reference reader reports the idea has already been done, do NOT stop - re-scope toward the unsolved gap inside that direction, re-select proposals, and run all remaining rounds.",
  "Survey (web + local paper library): papers you cannot access go to paperRequests for the boss to fetch — non-blocking; proceed with lower confidence, never stall.",
  "How many proposals (≤3) and competitors (≤3) is your in-loop call from survey evidence; the caps are hard.",
  "Each round, turn last round's review issues into work cards (or explicit rebuttals-on-artifacts); let them shape your planning.",
  "Git write scope: run only the git add/commit an ask names; pushes are limited to the local encrypted backup remote that the ledger ask names — never push otherwise, and never run reset/rebase/tag or other repository-writing git operations.",
  "Boss directives file: the orchestrator attaches the current content of docs/boss_directives.md to every round's cards ask (instructions the boss issues mid-run; may be empty) — turn each into this round's work and log its application in the ledger; when it disagrees with earlier requirements, the latest boss instruction wins and is recorded honestly.",
  "Honesty first: every number traces to an archived artifact; say what you don't know; escalate contradictions instead of working around them.",
].join("\n");

const ALGO_EN = [
  "You are the Algorithm Engineer: build proposals / reproduce competitors. End-to-end real runs only; every number carries its exact definition (data, window, units, per-accumulator meaning); before comparing against prior work, record a caliber table (each competitor's raw convention, dataset, metric definition) and report headline numbers in convention-independent units. Test and debug scripts and process artifacts go under Agents/; only boss-facing files go in the repo root and docs/ — explore freely while researching, Occam's razor at delivery.",
  "Competitor reproductions must be faithful: checked against the published numbers, deviations documented — you must not grade the competitors while building your own method.",
  "Test freeze: while the Test Engineer verifies, you do not modify the implementation under test (a moving target makes the verdict void). You only prepare the reproducibility package (env/commands/seeds/data window) and respond to gate failures; fix per the verdict once the report lands.",
  "Context discipline: redirect long command output to a file and take summaries via tail/grep — never page through it; read only relevant excerpts of reference material; take only decision-relevant excerpts of oversized tool output.",
  "Git write scope: run only the git add/commit an ask names; never push yourself, and never run reset/rebase/tag or other repository-writing git operations.",
  "Destructive-operation rule: deleting datasets, overwriting existing artifacts, git reset --hard, git clean -fdx, force push or rewriting pushed history are declared, never executed unilaterally — put them in dangerRequests (command, reason, blast radius) and run exactly what the Chief approves.",
  "Long-run safety (hard constraint): one subprocess per batch/scene, results written to disk immediately then exit to free memory; a memory guardrail in code (terminate and preserve evidence past ~70-80% of physical memory); timeouts and failure exits on every step; run every new experiment in three stages (MINI_PILOT smoke / PILOT small-data correctness / FULL full-protocol comparison) - stages before FULL are for debugging only, all archived numbers and claims come from FULL runs; datasets and existing artifacts read-only — never delete or overwrite; treat generated code as untrusted and prefer containerized or network-restricted execution where available (containment is risk reduction, not a guarantee).",
  "Report failures as failures; escalate contradictions. Never fake or bypass.",
].join("\n");

const VISUAL_EN = [
  "You are the Visual Reviewer: you look at images only — not the code, and never at anyone's self-report. Open each given image and answer three questions: (1) does the data fill the domain it should (large blank regions, only a handful of points); (2) are axes, ticks, units and legend readable and consistent with the spec table; (3) can this image support the conclusion this round claims.",
  "Judge against the artifact spec table in docs/brief.md — what it should look like — not against what looks pretty. Read-only, change nothing; say plainly which images you could not open.",
].join("\n");

const TEST_EN = [
  "You are the Test Engineer: code review, correctness roundtrip (incl. adversarial inputs), cross-scene generalization, perturbation stability.",
  "Independence is absolute: read the implementation under test, never modify it — a verifier who fixes makes the verification self-serving. You only write the self-check and the map.",
  "Read docs/brief.md first (sentence inventory / artifact spec table / open questions): verify against the spec table's pass criteria, not structure alone (a file exists, a plot is non-empty, colours follow the rule).",
  "Test expectations may only derive from the spec table or a registered requirement, never from the current implementation; every assertion's comment names its source. Writing a misreading into a must-pass test is the worst moat of all.",
  "Number-hallucination warning: a good-looking number is not a good outcome — scrutinize whether what the number means is really as simple as it appears; the theory behind it may itself be wrong, and the flattering number then reinforces that theoretical illusion. Understanding a number presupposes solid knowledge of the theory beneath it: for every headline number ask — what theory or mechanism does it rest on, and what would it still show if that theory were wrong?",
  "You own the claim→evidence map (Agents/claim_map.md): every manuscript number ↔ an archived artifact + a re-runnable check; write the check before the claim. The file must carry a claim-map marker and be tabular.",
  "You create/maintain Agents/selfcheck.py under Agents/ (test and debug scripts always live under Agents/ — only boss-facing files go in the repo root and docs/): it must contain at least one deliberately-broken canary case that must FAIL, marked `canary` so the orchestrator can verify it by search — a suite that cannot go red proves nothing.",
  "Long-context discipline: when the diff or review surface is large, inventory the changes first, then deep-read the high-risk areas (logic changes, gate-relevant, danger-operation sites); the verdict's coverage field must state what was reviewed deeply and what was only skimmed — it is written before you know where the problems are, and any later problem in a skimmed area is reconciled against it.",
  "Every verdict carries evidence.",
  "Full-read duty: every file touched by this round's diff must be read in full (including the context around the changes) — never conclude from a few paragraphs; skims live only outside this round's diff and are declared in coverage; redirect long command output to a file and take summaries via tail/grep.",
  "Git write scope: run only the git add/commit an ask names; never push yourself, and never run other repository-writing git operations.",
  "Destructive-operation criterion: beyond the declared-and-ruled list — datasets or existing artifacts deleted or overwritten, history rewritten, force traces — is a serious finding; demand the Chief's ruling record. Ordinary iteration replacing experiment artifacts is not in this class.",
].join("\n");

const RESEARCHER_EN = [
  "You are the Researcher: your single revision window per round (after engineering, before review) — revise docs/paper_draft.md truthfully; if it does not exist yet, create the first draft from the experimental results and the writing rules.",
  "Only numbers present in the claim→evidence map; gaps stay explicit [TODO]. Follow award-paper writing rules: concrete openings, conditional gap statements, progressive components, ablations mapped to claims, a standalone Limitations section, no AI-style tells.",
].join("\n");

const EDITOR_EN = [
  "You are the Editor: extract keywords; decide how many reviewers to invite (1-3, your in-loop call) plus 1 reference reader who has read every citation.",
  "Pick reviewers from adjacent, non-overlapping fields related to the research direction.",
  "Blind-review discipline: briefs must be anonymized — strip author, affiliation and project identity (identity disclosure alone measurably shifts review verdicts); reviewers never see each other's opinions; the orchestrator aggregates; where the engine allows it, reviewers run on a different model than the builders so their error modes do not coincide.",
  "Reviewer briefs stay tight: manuscript + claim→evidence map + targeted questions — never the whole repo.",
].join("\n");

const READER_EN = [
  "You are the senior reader who has read every reference: verify the manuscript's citations and narrative against the literature, check for missed recent work, and ask questions; verify what each cited competitor actually does, not how surveys classify it.",
  "Per-round novelty check (mandatory): name the 3 closest existing works (title + venue + one line on what each did) and state in which dimension the idea substantially differs (problem setting / mechanism / scope of conclusions) - this is the evidence behind the report's novelty section, not a stop signal.",
  "Read-only; edit nothing. Reviews must contain both issues and next-round iteration proposals.",
].join("\n");

const idea = String(args.idea ?? "");
const rounds = typeof args.rounds === "number" ? args.rounds : 3;
const focus = typeof args.focus === "string" ? args.focus : "";
const profile = typeof args.profile === "string" ? args.profile : "";
const PROFILE_LINE = profile ? "\nProject constraints (mandatory, override defaults): " + profile : "";

/** Model tiering: tiered = strong/cheap split (GLM-5.3 / GLM-5.3-Flash here); uniform = session model for all */
const tiered = String(args.models ?? "tiered").toLowerCase() !== "uniform";
const STRONG = model("GLM-5.3");
const CHEAP = model("GLM-5.3-Flash");
const persona = (system: string, m: ModelRef): { system: string; model?: ModelRef } =>
  tiered ? { system, model: m } : { system };

artifact.table("rounds", {
  title: "Validation rounds",
  columns: [
    { field: "round", label: "Round" },
    { field: "task", label: "Task" },
    { field: "portfolio", label: "Portfolio" },
    { field: "dev", label: "Build" },
    { field: "experiments", label: "Experiment mortality" },
    { field: "test", label: "Test gate" },
    { field: "review", label: "Worst review" },
    { field: "next", label: "Next direction" },
  ],
  key: "round",
});

phase("Chief: survey & scope");
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
if (legacyLayout) log("Legacy-layout ledger found (docs/workflow/ledger.md): migrate before working (git mv only, never delete) — ledger/map/selfcheck.py into Agents/, directives, brief and the evaluation report into docs/");
let repoRoot = "";
try {
  const tr = await world.run("git", ["rev-parse", "--show-toplevel"], { timeoutMs: 60000 });
  repoRoot = (tr.stdout || "").trim();
} catch {
  repoRoot = "";
}
// Startup repo check: the loop assumes the working directory is the repository root — say it loudly when it is not
let repoWarn = "";
try {
  const wt = await world.run("git", ["rev-parse", "--is-inside-work-tree"], { timeoutMs: 60000 });
  const inside = (wt.stdout || "").trim() === "true";
  const cd = inside ? await world.run("git", ["rev-parse", "--show-cdup"], { timeoutMs: 60000 }) : null;
  const cdup = cd ? (cd.stdout || "").trim() : "";
  if (!inside) {
    repoWarn = "the working directory is not a git repository (or git is unavailable): backup pushes will not work — run this workflow from the root of the research repository";
  } else if (cdup !== "" && repoRoot !== "") {
    repoWarn = "the working directory is a subdirectory of the repository (repo root " + repoRoot + ", " + cdup + " up): Agents/ and docs/ will be written under this directory, not the repo root — running from the repo root is recommended";
  }
} catch {
  repoWarn = "repository check failed (git unavailable): backup pushes will not work";
}
if (repoWarn !== "") log("Warning: " + repoWarn + "; recorded honestly in the ledger");
const survey = await chief.ask<SurveyResult>(
  "Rough idea to iterate on: " + idea + "\n" + (focus ? "Boss focus: " + focus + "\n" : "") +
  (repoRoot ? "Repo root: " + repoRoot + " (flag it honestly if the ledger records a different root).\n" : "") +
  (repoWarn !== "" ? "[Environment warning] " + repoWarn + " — proceed anyway; record it in the ledger.\n" : "") +
  (legacyLayout ? "[Migration] Legacy layout detected: git mv docs/workflow/{ledger,claim_map}.md and the root selfcheck.py into Agents/, and {boss_directives,brief,evaluation_report}.md into docs/, git add -A && git commit, then resume.\n" : "") +
  (ledger
    ? "Existing ledger (head index + tail detail; the resume basis):\n" + (ledger.length > 6000 ? ledger.slice(0, 1600) + "\n... (middle omitted) ...\n" + ledger.slice(-3200) : ledger) + "\nIf it shows N rounds already completed for this idea, set resumeFrom = N (continue at round N+1; never redo finished rounds); otherwise 0.\n"
    : "No ledger in this repo: set resumeFrom = 0.\n") +
  "Survey (web + local paper library, e.g. docs/refs/) and return SurveyResult. " +
  "Constraints: proposal/competitor counts are your call within ≤3; plan a path to at least one properly powered end-to-end comparison before round 1 closes (staged pilots are for debugging; claims come from FULL runs)." +
  "\nAfter scoping and before round 1 starts, write docs/brief.md (at most one page; section headings fixed as \"Sentence inventory\", \"Artifact spec table\", \"Open questions\"): the inventory covers every sentence of the boss's words (idea, focus, boss_directives); the spec table covers this round's deliverables (figures/tables/reports: axis, domain, units, pass criteria); the questions section covers every interrogative sentence; make the reading of the boss's words self-consistent and capture the gist — what you cannot pin down, quote verbatim and mark unsure (the engineers may resolve it during development or testing). Then start working — never idle waiting for approval.",
);
if (survey.paperRequests.length > 0) {
  log("Paper fetch requests (non-blocking, for the boss): " + survey.paperRequests.join("; "));
}
const startRound = Math.max(1, Math.min(rounds + 1, Math.round(survey.resumeFrom) + 1));
if (startRound > 1) log("Ledger shows " + (startRound - 1) + " round(s) done; resuming at round " + startRound);

const algo = agent("Algorithm Engineer", persona(ALGO_EN + PROFILE_LINE, CHEAP)); // cheap tier
const tester = agent("Test Engineer", persona(TEST_EN + PROFILE_LINE, CHEAP)); // cheap tier
const researcher = agent("Researcher", persona(RESEARCHER_EN + PROFILE_LINE, CHEAP)); // cheap tier
const editor = agent("Editor", persona(EDITOR_EN + PROFILE_LINE, STRONG)); // strong tier
const reader = agent("Reference Reader", persona(READER_EN + PROFILE_LINE, STRONG)); // strong tier

const rows: RoundRow[] = [];
let plan = "Round " + startRound + ": follow the survey (proposals: " + survey.proposals.join(", ") + "; competitors: " + survey.competitors.join(", ") + ")";

/** Destructive operations: declare -> strong-tier Chief rules -> run exactly as approved; returns the ruling log for the ledger. Covers the initial build AND the fix paths. */
async function dangerFlow(reqs: DangerRequest[]): Promise<string> {
  phase("Destructive-operation review");
  const raw = await chief.ask<DangerReview>(
    "Destructive-operation review (you are the strong-tier authority; this ruling is never handed to the boss). Requester: Algorithm Engineer (cheap tier). Rule on each request: " + JSON.stringify(reqs) +
    ". Judge by: is the blast radius bounded, is it reversible, is there a narrower safe equivalent (scoped path, dry-run first, back up first, list affected files first)? Reject by default; use approve-with-change with safeForm when a safer equivalent exists; approve only when necessary and safe. Approval carries conditions: back up first so it is reversible, stop on failure; if bounded retries still fail, park it (recorded in the ledger and surfaced in the Preliminary Evaluation Report, no further attempts) rather than switching to a larger-blast-radius alternative. Only when the experiment cannot proceed at all without the operation, say so in reason as 'experiment blocked' — it surfaces in the Preliminary Evaluation Report (this loop has no interrupt mechanism). Return DangerReview (decisions map one-to-one to the requests).",
  );
  let decisions = raw.decisions ?? [];
  if (decisions.length !== reqs.length) {
    log("Destructive ruling incomplete (" + decisions.length + "/" + reqs.length + ") — treating all as rejected, recorded honestly");
    decisions = reqs.map((r) => ({ command: r.command, decision: "reject" as const, safeForm: "", reason: "Incomplete ruling; rejected wholesale for safety" }));
  }
  let entry = decisions.map((d) => d.command + " -> " + d.decision + (d.safeForm ? " (as: " + d.safeForm + ")" : "") + ": " + d.reason).join("; ");
  const ok = decisions.filter((d) => d.decision !== "reject");
  if (ok.length > 0) {
    phase("Run the approved destructive operations");
    const execReport = await algo.ask<string>(
      "Run the Chief-approved destructive operations, exactly as approved (use safeForm when non-empty); do not widen the scope: " + ok.map((d, i) => (i + 1) + ". " + (d.safeForm || d.command)).join("; ") + ". Then git add -A && git commit and return one sentence (listing the commands actually executed).",
    );
    for (const d of ok) {
      const form = d.safeForm || d.command;
      if (!execReport.includes(form)) log("Dangerous-operation execution unconfirmed: " + d.command + " — recorded honestly, flagged in the ledger");
    }
    entry += "; execution confirmation: " + (ok.every((d) => execReport.includes(d.safeForm || d.command)) ? "all match the approved forms" : "some unconfirmed (see log)");
  } else {
    log("All destructive requests rejected: no workaround allowed");
  }
  return entry;
}

for (let round = startRound; round <= rounds; round++) {
  let dangerLog = "none"; // this round's destructive-operation rulings (into the ledger)
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
  phase("Issue work cards");
  let cards = await chief.ask<WorkCards>(
    "Round " + round + "/" + rounds + ". Idea: " + idea + "\n" +
    (round === 1 ? "Survey conclusion: " + survey.summary : "Last round's reviews and your planning: " + plan) + "\n" +
    "The proposal portfolio is re-selected by you every round (add/drop/replace, ≤3 and ≥1); every proposal selected this round must be fully validated; list the 1-3 selected proposal names in the proposals field.\n" +
    (bossNote ? "[Boss directives file (read this round)] apply each item, log application in the ledger:\n" + bossNote + "\n" : "") +
    "Turn this round's work into cards (reproduce competitor X / try proposal Y...). Boss focus: " + (focus || "none"),
  );
  if (cards.proposals.length < 1 || cards.proposals.length > 3) {
    cards = await chief.ask<WorkCards>(
      "proposals must contain 1-3 proposal names (currently " + cards.proposals.length + "). Return WorkCards again.",
    );
  }
  if (cards.proposals.length < 1 || cards.proposals.length > 3) {
    log("Round " + round + " portfolio still invalid (" + cards.proposals.length + " entries); recorded honestly and continuing");
  }
  log("Round " + round + " task: " + cards.title + "; portfolio: " + cards.proposals.join(", "));

  phase("Engineer: build & self-test");
  let dev = await algo.ask<DevReport>(
    "This round's cards: " + cards.cards.join("; ") + "\n" +
    "Build and self-test. Discipline: end-to-end real runs, numbers with exact definitions, faithful competitor reproduction; every proposal selected this round must be fully validated (three stages: MINI_PILOT/PILOT are for debugging only, claims come from FULL); by the end of round 1 there must be at least one end-to-end number from a complete comparison. Before comparing against prior work, record a caliber table (each competitor's raw convention, dataset, metric definition); bound representation/preprocessing assumptions with zero-cost standard-tool anchor experiments before building the full method; run at least one boundary experiment per round (where the approach breaks, parameter sensitivity) and state each claim's evidence scope (datasets and conditions). Report experiments (attempted/passed) honestly; archive null results with a mechanism explanation.",
  );
  if (round === 1 && dev.numbers.length === 0) {
    dev = await algo.ask<DevReport>(
      "Round 1 must end with at least one end-to-end number from a complete (FULL-stage) comparison; a minimal comparison is not a substitute. Run it now and return DevReport (numbers carries the value and its exact definition); if genuinely impossible, say so and leave numbers empty.",
    );
    if (dev.numbers.length === 0) log("Round 1 has no end-to-end number (still missing after remediation) - recorded honestly; the manuscript must not claim validation");
  }
  // Destructive operations: the cheap tier declares, the strong-tier Chief rules execute / safe form / skip
  if ((dev.dangerRequests || []).length > 0) {
    dangerLog = await dangerFlow(dev.dangerRequests);
  }

  phase("Test Engineer: review & gate");
  let verdict = await tester.ask<TestVerdict>(
    "Review the build: " + JSON.stringify(dev) + "\n" +
    "Read docs/brief.md's artifact spec table first: verify against its pass criteria, not structure alone. " +
    "Duties: code review / roundtrip (incl. adversarial inputs) / generalization / perturbation stability; update the claim→evidence map (Agents/claim_map.md); " +
    "create or update Agents/selfcheck.py with a must-fail canary case, and expectations derived from the spec table or a registered requirement (comment the source), never from the current implementation. For headline numbers that enter claims or go/no-go decisions and involve multi-step aggregation, recompute them via a second path from archived intermediates (a different grouping or formula — a second implementation is not required); archive the intermediates that make this a minutes-long check, not a rerun. A mismatch freezes the number pending audit — never wave it off as a rounding note. Single-source direct measurements are exempt (roundtrip and canary already cover them). When a number is retracted, sweep the whole repo for documents repeating it (ledger history, READMEs, figures) and list the corrections for this round. Return TestVerdict (the artifacts field lists this round's figures/tables, including gitignored ones).",
  );
  // Image artifacts -> visual review (mechanically triggered); its issues join this round's fix list and ride the existing fix flow — no images, no cost
  const isImgR = (p: string): boolean => /\.(png|jpe?g|svg|webp|gif)$/i.test(p);
  let imageFilesR: string[] = (verdict.artifacts || []).filter((p) => isImgR(p));
  try {
    const stR = await world.run("git", ["status", "--porcelain"], { timeoutMs: 60000 });
    for (const line of (stR.stdout || "").split("\n")) {
      const tR = line.trim();
      if (tR.length < 4) continue;
      const pR = tR.slice(3).trim();
      if (isImgR(pR) && imageFilesR.indexOf(pR) < 0) imageFilesR.push(pR);
    }
  } catch {
    /* detection failed: treat as no images, recorded honestly in the ledger */
  }
  let visualNoteR = imageFilesR.length === 0 ? "no image artifacts this round: not applicable" : "not reviewed yet";
  if (imageFilesR.length > 0) {
    phase("Visual review of image artifacts");
    const vvR = await agent("Visual review-R" + round, persona(VISUAL_EN + PROFILE_LINE, STRONG)).ask<VisualVerdict>(
      "This round's task: " + cards.title + ". Spec: the artifact spec table in docs/brief.md. Open and review each image (workspace-relative paths):\n" + imageFilesR.join("\n") +
      "\nThree questions: does the data fill the domain it should; are axes, ticks, units and legend readable and consistent with the spec; can this image support the conclusion this round claims. Return VisualVerdict (name the file and what you saw).",
    );
    visualNoteR = vvR.summary + ((vvR.issues || []).length > 0 ? " | issues: " + (vvR.issues || []).join("; ") : "");
    if ((vvR.issues || []).length > 0) {
      verdict.issues = verdict.issues.concat((vvR.issues || []).map((x) => "[visual] " + x));
      log("Visual review raised issues; merged into this round's fix list: " + visualNoteR.slice(0, 300));
    }
  }
  let claimMapOk = false;
  try {
    const map = await files.read("Agents/claim_map.md");
    claimMapOk = map.includes("claim-map") && map.split("\n").filter((l) => l.trim().startsWith("|")).length >= 2;
  } catch {
    claimMapOk = false;
  }
  if (!claimMapOk) {
    await tester.ask<string>(
      "Agents/claim_map.md is missing or invalid (needs a claim-map marker plus table rows). Build it: each row = manuscript number | archived artifact | re-runnable check command.",
    );
    try {
      const map = await files.read("Agents/claim_map.md");
      claimMapOk = map.includes("claim-map") && map.split("\n").filter((l) => l.trim().startsWith("|")).length >= 2;
    } catch {
      claimMapOk = false;
    }
  }
  let canary = false;
  try {
    canary = (await files.grep("canary", "Agents/selfcheck.py")).length > 0;
  } catch {
    canary = false;
  }
  if (!canary) log("Gate has no canary marker (a must-fail control case is required)");
  let gate = "";
  let interpIsPy3 = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let exitCode = -1;
    let output = "";
    let launchErr = "";
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
          launchErr = "neither python nor python3 could be launched (check the interpreter)";
        }
      } else {
        launchErr = "Agents/selfcheck.py failed to launch or timed out";
      }
    }
    if (launchErr === "" && exitCode === 0 && canary && claimMapOk) {
      gate = "pass (attempt " + attempt + (interpIsPy3 ? ", python3" : "") + ")";
      break;
    }
    if (attempt === 3) {
      gate = launchErr !== ""
        ? launchErr
        : (claimMapOk ? "" : "claim map missing; ") + (canary ? "still failing after 3 fix attempts" : "gate not ready (no canary control case)");
      break;
    }
    try {
      canary = (await files.grep("canary", "Agents/selfcheck.py")).length > 0;
    } catch {
      canary = false;
    }
    const reason = launchErr !== ""
      ? launchErr
      : "exit " + exitCode + (canary ? "" : ", and no canary control case") + (claimMapOk ? "" : ", and the claim map is missing");
    const triage = await tester.ask<string>(
      "Gate not passing (" + reason + "). You own Agents/selfcheck.py and the claim map: if the problem is in the test infrastructure (script/cases/map), fix it directly; if it is in the implementation under test, return an explicit fix instruction list for the Algorithm Engineer (do not edit the implementation yourself); if you cannot tell, say so. Output excerpt:\n" + output,
    );
    const t = triage.trim();
    if (t !== "" && t.toLowerCase() !== "none") {
      const triageDev = await algo.ask<DevReport>(
        "Fix instructions ruled by the Test Engineer (you must not edit Agents/selfcheck.py or claim_map.md):\n" + t.slice(0, 2000) + "\nExecute and return DevReport.",
      );
      if ((triageDev.dangerRequests || []).length > 0) {
        dangerLog = (dangerLog === "none" ? "" : dangerLog + "; ") + await dangerFlow(triageDev.dangerRequests);
      }
    }
  }

  phase("Fixes & extra experiments");
  let fixDev: DevReport = dev;
  const fixes = await chief.ask<string[]>(
    "Test verdict: " + JSON.stringify(verdict) + "\nGate: " + gate + "\nTurn test issues into fix / extra-experiment instructions (empty array if none).",
  );
  if (fixes.length > 0) {
    fixDev = await algo.ask<DevReport>("Execute fixes and extra experiments: " + fixes.join("; ") + "\nReproduce each one on this round's code first: a stale entry (older line numbers, already fixed, not reproducible now) is discarded with a note — never code against it. Return DevReport.");
    if ((fixDev.dangerRequests || []).length > 0) {
      dangerLog = (dangerLog === "none" ? "" : dangerLog + "; ") + await dangerFlow(fixDev.dangerRequests);
    }
  }

  phase("Researcher: revise manuscript");
  const paper = await researcher.ask<string>(
    "Engineering and testing are done; this is your only revision window this round. Dev report: " + JSON.stringify(dev) +
    "\nFix / extra-experiment report (its new numbers are equally citable): " + JSON.stringify(fixDev) + "\nTest verdict: " + verdict.summary +
    "\nRevise docs/paper_draft.md truthfully: only mapped numbers, [TODO] for gaps. Return a short revision summary.",
  );

  phase("Editor: invite reviewers");
  const invite = await editor.ask<Invite>(
    "Manuscript updated (docs/paper_draft.md, summary: " + paper.slice(0, 500) + ").\n" +
    "Extract keywords, decide reviewer count (1-3), and write the tight brief (manuscript + evidence map + targeted questions, never the whole repo). Return Invite.",
  );
  const n = Math.max(1, Math.min(3, Math.round(invite.count)));

  phase("Review panel");
  const settled = await Promise.allSettled(
    Array.from({ length: n }, (_, i) =>
      agent("Reviewer-r" + round + "-" + (i + 1), tiered ? { model: STRONG } : undefined).ask<Review>(
        invite.brief + "\n\nYou are an independent reviewer from an adjacent (related but non-overlapping) field. Review only from the brief and the materials it points to — do not open other repo content, git history or the ledger (blind-review discipline); read-only, change nothing: raise sharp issues against the manuscript and evidence map (with evidence), propose next-round iterations, and give a severity. Beware number hallucination: a good-looking number is not a good outcome — scrutinize whether what a manuscript number means is really as simple as it appears; the theory behind it may itself be wrong, and the flattering number reinforces that illusion. Say so if you cannot judge something.",
      ),
    ),
  );
  const readerRev = await reader.ask<Review>(
    "Review after reading the references (materials: the manuscript summary, the cited references including the docs/refs/ paper library, and web search — not the ledger, git history or other workspace content). Manuscript summary: " + paper.slice(0, 500) + "\nVerify citations and narrative, check for missed recent work, ask questions, propose iterations. Beware number hallucination: a good-looking number is not a good outcome — scrutinize whether what a manuscript number means is really as simple as it appears; the theory behind it may itself be wrong, and the flattering number reinforces that illusion. nearestWorks is mandatory: the 3 closest works and the difference dimension.",
  );
  const reviews: Review[] = settled.map((s) =>
    s.status === "fulfilled" ? s.value : { summary: "reviewer did not finish", issues: [], iteration: [], severity: "minor" },
  );
  reviews.push(readerRev);
  const digest = reviews
    .map((r, i) => "[" + (i < n ? "Reviewer-" + (i + 1) : "Reference Reader") + " | " + r.severity + "] " + r.summary +
      "\n- Issues: " + (r.issues.join("; ") || "none") + "\n- Iteration: " + (r.iteration.join("; ") || "none") +
      (r.nearestWorks && r.nearestWorks.length > 0 ? "\n- Closest works: " + r.nearestWorks.join("; ") : ""))
    .join("\n\n");

  phase("Archive round");
  let head0 = "";
  try {
    const l0 = await git.log(1);
    head0 = l0[0]?.hash ?? "";
  } catch {
    head0 = "";
  }
  const archived = await chief.ask<string>(
    "Record this round in Agents/ledger.md (head carries the repository identity line" + (repoRoot ? ": " + repoRoot : "") + " and a one-line-per-round index: update this round's index line first, then append the detail) — task/build/destructive-operation ruling (" + dangerLog + ")/test (coverage statement: " + (verdict.coverage || "").slice(0, 300) + "; visual review: " + visualNoteR.slice(0, 200) + ")/reviews/next direction. Then git add -A && git commit. If exactly one remote whose name contains gitcoffer exists (the boss's agreed encrypted local backup — build one with GitCoffer, so agent-caused deletions are always recoverable), push to it; when it cannot be identified uniquely (none or several), do not push and record that honestly — never push to any other remote on your own (publishing to the cloud is always the boss's explicit action). Return one sentence.",
  );
  let head1 = "";
  try {
    const l1 = await git.log(1);
    head1 = l1[0]?.hash ?? "";
  } catch {
    head1 = "";
  }
  const commitOk = head1 !== "" && head1 !== head0;
  if (!commitOk) {
    await chief.ask<string>(
      "This round's commit did not land (HEAD unchanged). Run git add -A && git commit now (plus the local backup remote if configured) and return the hash.",
    );
  }
  log("Round " + round + " archive " + (commitOk ? "verified (HEAD=" + head1.slice(0, 7) + ")" : "needs manual check after remediation"));

  const rank: Record<string, number> = { minor: 1, major: 2, blocker: 3 };
  const worst = reviews.reduce((a, b) => (rank[b.severity] > rank[a.severity] ? b : a));
  const nextDirection = reviews.flatMap((r) => r.iteration).slice(0, 3).join("; ");
  rows.push({
    round,
    task: cards.title,
    portfolio: cards.proposals.join(", "),
    dev: dev.summary + (fixDev !== dev ? " (incl. fixes)" : ""),
    experiments: [dev.experiments, fixDev !== dev ? fixDev.experiments : ""].filter((s) => s && s !== "none").join("; ") || "not reported",
    test: gate,
    review: "[" + worst.severity + "] " + worst.summary,
    next: nextDirection.slice(0, 200),
  });
  report(rows[rows.length - 1], "rounds");
  plan = digest;
}

phase("Preliminary evaluation report");
const resumeNote = rows.length === 0 ? "The ledger shows all rounds already complete; produce the evaluation report directly from the ledger and archived artifacts. " : "";
let evalResult = await chief.ask<EvalReport>(
  resumeNote + rounds + " rounds complete — hard stop. All reviews:\n" + plan.slice(0, 6000) + "\n" +
  "Round records: " + JSON.stringify(rows) + "\n" +
  "Write the Preliminary Evaluation Report: verdict (continue/pivot/stop), expected success with reasoning that cites the experiment-mortality trend and the reader's novelty check, plus an explicit note that it is a qualitative judgement expressed numerically rather than a calibrated probability, novelty grounded in the 3 closest works, impact, points to watch if continued (each annotated with the evidence scope of the claim it concerns — datasets and conditions), " +
  "questionAnswers (question text -> direct answer -> where the evidence is; when asked where something lives, answer the form too — raw or derived, whether a writer exists), autonomousDecisions (decision -> reason -> consequence if rejected -> Occam self-assessment \"adds complexity vs simplifies\"; any complexity-increasing decision must be here, never only in the ledger), " +
  "reviewerQuotes (verbatim, never paraphrased), and one line of advice including a decision list of things only the boss can do (accounts, data, resources). " +
  "This is a decision-layer document: no process narrative (which attempt went green, how many reworks, how many review comments — that is the ledger), gloss jargon on first use, one conclusion sentence at the top of each section, each item stated once, no code paths in the body, aiming at two pages or less. At closing, also tidy the delivery: git mv every non-boss-facing file into Agents/ (never delete — deleting files is the boss's move; files the boss wrote or supplied, such as docs/boss_directives.md and the docs/refs/ paper library, stay as they are), so the repo root and docs/ hold only boss-facing files — the artifacts the boss's words name, the manuscript, docs/brief.md, the evaluation report — plus what answering the boss requires; working scaffolding (ledger, maps, Agents/selfcheck.py, test and debug scripts, falsified history) all lives under Agents/. Occam's razor at delivery. Write it to docs/evaluation_report.md, git add -A && git commit.",
);
// Question guard (mechanical): questions in the boss's words with no answer in the report count as a missed requirement — answer once, then record honestly
const askedQ = ((idea + " " + focus).match(/？|\?/g) || []).length;
if (askedQ > 0 && (!evalResult.questionAnswers || evalResult.questionAnswers.length === 0)) {
  evalResult = await chief.ask<EvalReport>(
    "The boss's words contain " + askedQ + " question mark(s) but questionAnswers is empty — a question evaporating at intake is a missed requirement. Answer each one (question text -> direct answer, including the form -> where the evidence is; write \"cannot answer: reason\" where you truly cannot), write it back to docs/evaluation_report.md and git add -A && git commit --amend --no-edit, then return the full EvalReport.",
  );
  if (!evalResult.questionAnswers || evalResult.questionAnswers.length === 0) log("Report still lacks answered questions (recorded honestly; the boss's words contain " + askedQ + " question mark(s))");
}
const md = [
  "# Preliminary Evaluation Report",
  "",
  "Idea: " + idea,
  "",
  "## Verdict: " + evalResult.verdict,
  "",
  "- Success odds: " + evalResult.successOdds,
  "- Novelty: " + evalResult.novelty,
  "- Impact: " + evalResult.impact,
  "",
  "## If continued, watch for",
  ...evalResult.risks.map((r) => "- " + r),
  "",
  "## Your questions, answered",
  (evalResult.questionAnswers && evalResult.questionAnswers.length > 0) ? evalResult.questionAnswers.map((x) => "- \u201c" + x.q + "\u201d -> " + x.a + " (evidence: " + x.evidence + ")") : ["- none (no questions this run)"],
  "",
  "## Autonomous decisions (please confirm or overturn)",
  (evalResult.autonomousDecisions && evalResult.autonomousDecisions.length > 0) ? evalResult.autonomousDecisions.map((x) => "- " + x.decision + " | why: " + x.reason + " | if rejected: " + x.ifRejected + " | Occam: " + x.occam) : ["- none"],
  "",
  "## Reviewer verdicts, verbatim",
  ...evalResult.reviewerQuotes.map((q) => "> " + q),
  "",
  "## Advice",
  evalResult.advice,
  "",
  "---",
  "Note: the success figure is a qualitative judgement expressed numerically, not a calibrated probability; reviewer verdicts are quoted unedited and may disagree with the overall verdict.",
].join("\n");
await artifact.markdown("report", md, { title: "Preliminary Evaluation Report", description: "Go/no-go after the hard stop", primary: true });

return {
  conclusion: evalResult.advice,
  verdict: evalResult.verdict,
  rounds_completed: rows.length,
  paper_requests: survey.paperRequests,
  next_action: "Awaiting the boss's decision: rerun this workflow with the focus argument (continue / pivot / stop)",
};
