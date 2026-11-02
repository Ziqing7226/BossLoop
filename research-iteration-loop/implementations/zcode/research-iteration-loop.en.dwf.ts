/* zcode-workflow
description: Research Iteration Loop (v0.3.1), English UI. Start from a rough idea and decide in N bounded rounds whether it deserves more. Each round the Chief re-selects the proposal portfolio (1-3) from the latest reviews; the Engineer runs staged experiments (numbers only from FULL end-to-end runs); the Tester verifies independently (claim-to-evidence map + a mechanical selfcheck gate with a canary, owning the test fixtures); fixes land; the Researcher revises the manuscript; the Editor runs blind review (adjacent-field reviewers + a full-reference reader; per-round novelty check and experiment mortality archived). Hard stop after N rounds yields the Preliminary Evaluation Report; resumes from the ledger; destructive operations are declared and ruled by the strong-tier Chief, never handed to the boss; model tiering tiered/uniform.
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
  /** One-sentence advice to the boss */
  advice: string;
}

const CHIEF_EN = [
  "You are the Chief Engineer. Mission: decide within a bounded number of rounds whether args.idea deserves deep investment, and drive it forward — not perfect it.",
  "Take over by reading the ledger (docs/workflow/ledger.md): if this idea already has a record, resume from that round instead of redoing finished rounds.",
  "The proposal portfolio is re-selected every round: at the start of each round pick 1-3 proposals from the latest reviews (add, drop or replace; fill up to 3 when choices exist, 1-2 otherwise, never 0) and the competitor set; every proposal selected this round must be fully validated - a minimal comparison passed off as validation is forbidden because it biases conclusions.",
  "Round planning: dispose of every review issue - either turn it into a work card or rebut it on archived artifacts; never ignore one verbally.",
  "Novelty handling: if the reference reader reports the idea has already been done, do NOT stop - re-scope toward the unsolved gap inside that direction, re-select proposals, and run all remaining rounds.",
  "Survey (web + local paper library): papers you cannot access go to paperRequests for the boss to fetch — non-blocking; proceed with lower confidence, never stall.",
  "How many proposals (≤3) and competitors (≤3) is your in-loop call from survey evidence; the caps are hard.",
  "Each round, turn last round's review issues into work cards (or explicit rebuttals-on-artifacts); let them shape your planning.",
  "Honesty first: every number traces to an archived artifact; say what you don't know; escalate contradictions instead of working around them.",
].join("\n");

const ALGO_EN = [
  "You are the Algorithm Engineer: build proposals / reproduce competitors. End-to-end real runs only; every number carries its exact definition (data, window, units, per-accumulator meaning); before comparing against prior work, record a caliber table (each competitor's raw convention, dataset, metric definition) and report headline numbers in convention-independent units.",
  "Competitor reproductions must be faithful: checked against the published numbers, deviations documented — you must not grade the competitors while building your own method.",
  "Test freeze: while the Test Engineer verifies, you do not modify the implementation under test (a moving target makes the verdict void). You only prepare the reproducibility package (env/commands/seeds/data window) and respond to gate failures; fix per the verdict once the report lands.",
  "Destructive-operation rule: deleting datasets, overwriting existing artifacts, git reset --hard, git clean -fdx, force push or rewriting pushed history are declared, never executed unilaterally — put them in dangerRequests (command, reason, blast radius) and run exactly what the Chief approves.",
  "Long-run safety (hard constraint): one subprocess per batch/scene, results written to disk immediately then exit to free memory; a memory guardrail in code (terminate and preserve evidence past ~70-80% of physical memory); timeouts and failure exits on every step; run every new experiment in three stages (MINI_PILOT smoke / PILOT small-data correctness / FULL full-protocol comparison) - stages before FULL are for debugging only, all archived numbers and claims come from FULL runs; datasets and existing artifacts read-only — never delete or overwrite; treat generated code as untrusted and prefer containerized or network-restricted execution where available (containment is risk reduction, not a guarantee).",
  "Report failures as failures; escalate contradictions. Never fake or bypass.",
].join("\n");

const TEST_EN = [
  "You are the Test Engineer: code review, correctness roundtrip (incl. adversarial inputs), cross-scene generalization, perturbation stability.",
  "Independence is absolute: read the implementation under test, never modify it — a verifier who fixes makes the verification self-serving. You only write the self-check and the map.",
  "You own the claim→evidence map (docs/workflow/claim_map.md): every manuscript number ↔ an archived artifact + a re-runnable check; write the check before the claim. The file must carry a claim-map marker and be tabular.",
  "You create/maintain selfcheck.py at the repo root: it must contain at least one deliberately-broken canary case that must FAIL, marked `canary` so the orchestrator can verify it by search — a suite that cannot go red proves nothing.",
  "Long-context discipline: when the diff or review surface is large, inventory the changes first, then deep-read the high-risk areas (logic changes, gate-relevant, danger-operation sites); the verdict's coverage field must state what was reviewed deeply and what was only skimmed — it is written before you know where the problems are, and any later problem in a skimmed area is reconciled against it.",
  "Every verdict carries evidence.",
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
  ledger = await files.read("docs/workflow/ledger.md");
} catch {
  ledger = "";
}
const survey = await chief.ask<SurveyResult>(
  "Rough idea to iterate on: " + idea + "\n" + (focus ? "Boss focus: " + focus + "\n" : "") +
  (ledger
    ? "Existing ledger (head index + tail detail; the resume basis):\n" + (ledger.length > 6000 ? ledger.slice(0, 1600) + "\n... (middle omitted) ...\n" + ledger.slice(-3200) : ledger) + "\nIf it shows N rounds already completed for this idea, set resumeFrom = N (continue at round N+1; never redo finished rounds); otherwise 0.\n"
    : "No ledger in this repo: set resumeFrom = 0.\n") +
  "Survey (web + local paper library, e.g. docs/refs/) and return SurveyResult. " +
  "Constraints: proposal/competitor counts are your call within ≤3; plan a path to at least one properly powered end-to-end comparison before round 1 closes (staged pilots are for debugging; claims come from FULL runs).",
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
    ". Judge by: is the blast radius bounded, is it reversible, is there a narrower safe equivalent (scoped path, dry-run first, back up first, list affected files first)? Reject by default; use approve-with-change with safeForm when a safer equivalent exists; approve only when necessary and safe. Only when the experiment cannot proceed at all without the operation, say so in reason as 'experiment blocked' — it surfaces in the Preliminary Evaluation Report (this loop has no interrupt mechanism). Return DangerReview (decisions map one-to-one to the requests).",
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
  phase("Issue work cards");
  let cards = await chief.ask<WorkCards>(
    "Round " + round + "/" + rounds + ". Idea: " + idea + "\n" +
    (round === 1 ? "Survey conclusion: " + survey.summary : "Last round's reviews and your planning: " + plan) + "\n" +
    "The proposal portfolio is re-selected by you every round (add/drop/replace, ≤3 and ≥1); every proposal selected this round must be fully validated; list the 1-3 selected proposal names in the proposals field.\n" +
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
  const verdict = await tester.ask<TestVerdict>(
    "Review the build: " + JSON.stringify(dev) + "\n" +
    "Duties: code review / roundtrip (incl. adversarial inputs) / generalization / perturbation stability; update the claim→evidence map (docs/workflow/claim_map.md); " +
    "create or update selfcheck.py at the repo root with a must-fail canary case. For headline numbers that enter claims or go/no-go decisions and involve multi-step aggregation, recompute them via a second path from archived intermediates (a different grouping or formula — a second implementation is not required); archive the intermediates that make this a minutes-long check, not a rerun. A mismatch freezes the number pending audit — never wave it off as a rounding note. Single-source direct measurements are exempt (roundtrip and canary already cover them). When a number is retracted, sweep the whole repo for documents repeating it (ledger history, READMEs, figures) and list the corrections for this round. Return TestVerdict.",
  );
  let claimMapOk = false;
  try {
    const map = await files.read("docs/workflow/claim_map.md");
    claimMapOk = map.includes("claim-map") && map.split("\n").filter((l) => l.trim().startsWith("|")).length >= 2;
  } catch {
    claimMapOk = false;
  }
  if (!claimMapOk) {
    await tester.ask<string>(
      "docs/workflow/claim_map.md is missing or invalid (needs a claim-map marker plus table rows). Build it: each row = manuscript number | archived artifact | re-runnable check command.",
    );
    try {
      const map = await files.read("docs/workflow/claim_map.md");
      claimMapOk = map.includes("claim-map") && map.split("\n").filter((l) => l.trim().startsWith("|")).length >= 2;
    } catch {
      claimMapOk = false;
    }
  }
  let canary = false;
  try {
    canary = (await files.grep("canary", "selfcheck.py")).length > 0;
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
          launchErr = "neither python nor python3 could be launched (check the interpreter)";
        }
      } else {
        launchErr = "selfcheck.py failed to launch or timed out";
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
      canary = (await files.grep("canary", "selfcheck.py")).length > 0;
    } catch {
      canary = false;
    }
    const reason = launchErr !== ""
      ? launchErr
      : "exit " + exitCode + (canary ? "" : ", and no canary control case") + (claimMapOk ? "" : ", and the claim map is missing");
    const triage = await tester.ask<string>(
      "Gate not passing (" + reason + "). You own selfcheck.py and the claim map: if the problem is in the test infrastructure (script/cases/map), fix it directly; if it is in the implementation under test, return an explicit fix instruction list for the Algorithm Engineer (do not edit the implementation yourself); if you cannot tell, say so. Output excerpt:\n" + output,
    );
    const t = triage.trim();
    if (t !== "" && t.toLowerCase() !== "none") {
      const triageDev = await algo.ask<DevReport>(
        "Fix instructions ruled by the Test Engineer (you must not edit selfcheck.py or claim_map.md):\n" + t.slice(0, 2000) + "\nExecute and return DevReport.",
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
    fixDev = await algo.ask<DevReport>("Execute fixes and extra experiments: " + fixes.join("; ") + "\nReturn DevReport.");
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
        invite.brief + "\n\nYou are an independent reviewer from an adjacent (related but non-overlapping) field, read-only: raise sharp issues against the manuscript and evidence map (with evidence), propose next-round iterations, and give a severity. Say so if you cannot judge something.",
      ),
    ),
  );
  const readerRev = await reader.ask<Review>(
    "Review after reading the references (read-only). Manuscript summary: " + paper.slice(0, 500) + "\nVerify citations and narrative, check for missed recent work, ask questions, propose iterations; nearestWorks is mandatory: the 3 closest works and the difference dimension.",
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
    "Record this round in docs/workflow/ledger.md (keep a one-line-per-round index at its head: update this round's index line first, then append the detail) — task/build/destructive-operation ruling (" + dangerLog + ")/test (coverage statement: " + (verdict.coverage || "").slice(0, 300) + ")/reviews/next direction. Then git add -A && git commit. If an encrypted local backup remote is configured (recommended: build one with GitCoffer, so agent-caused deletions are always recoverable), also push there; never push to any other remote on your own (publishing to the cloud is always the boss's explicit action). Return one sentence.",
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
const evalResult = await chief.ask<EvalReport>(
  resumeNote + rounds + " rounds complete — hard stop. All reviews:\n" + plan.slice(0, 6000) + "\n" +
  "Round records: " + JSON.stringify(rows) + "\n" +
  "Write the Preliminary Evaluation Report: verdict (continue/pivot/stop), expected success with reasoning that cites the experiment-mortality trend and the reader's novelty check, plus an explicit note that it is a qualitative judgement expressed numerically rather than a calibrated probability, novelty grounded in the 3 closest works, impact, points to watch if continued (each annotated with the evidence scope of the claim it concerns — datasets and conditions), " +
  "reviewerQuotes (verbatim, never paraphrased), and one line of advice including a decision list of things only the boss can do (accounts, data, resources). Write it to docs/workflow/evaluation_report.md.",
);
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
