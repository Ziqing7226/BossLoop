/* zcode-workflow
description: Research iteration loop (SPEC v0.5), English UI variant. Iterate a rough idea through bounded cycles — Chief surveys and scopes -> Engineer builds (implementation frozen during testing) -> Test Engineer independently verifies with a mechanically checked canary gate -> fixes -> Researcher revises/creates the manuscript -> Editor invites reviewers -> review panel with iteration proposals -> local commit. Hard stop after N rounds with a Preliminary Evaluation Report; resumes from the ledger.
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
  /** Leftovers, or "none" */
  leftover: string;
}

interface TestVerdict {
  /** One-sentence verdict */
  summary: string;
  /** Issues (code / generalization / reliability), each with evidence */
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
  severity: "minor" | "major" | "blocker";
}

interface RoundRow {
  round: number;
  task: string;
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
  "Novelty handling: if the reference reader reports the idea has already been done, do NOT stop - re-scope toward the unsolved gap inside that direction, re-select proposals, and run all remaining rounds.",
  "Survey (web + local paper library): papers you cannot access go to paperRequests for the boss to fetch — non-blocking; proceed with lower confidence, never stall.",
  "How many proposals (≤3) and competitors (≤3) is your in-loop call from survey evidence; the caps are hard.",
  "Each round, turn last round's review issues into work cards (or explicit rebuttals-on-artifacts); let them shape your planning.",
  "Honesty first: every number traces to an archived artifact; say what you don't know; escalate contradictions instead of working around them.",
].join("\n");

const ALGO_EN = [
  "You are the Algorithm Engineer: build proposals / reproduce competitors. End-to-end real runs only; every number carries its exact definition (data, window, units, per-accumulator meaning).",
  "Competitor reproductions must be faithful: checked against the published numbers, deviations documented — you must not grade the competitors while building your own method.",
  "Test freeze: while the Test Engineer verifies, you do not modify the implementation under test (a moving target makes the verdict void). You only prepare the reproducibility package (env/commands/seeds/data window) and respond to gate failures; fix per the verdict once the report lands.",
  "Long-run safety (hard constraint): one subprocess per batch/scene, results written to disk immediately then exit to free memory; a memory guardrail in code (terminate and preserve evidence past ~70-80% of physical memory); timeouts and failure exits on every step; run every new experiment in three stages (MINI_PILOT smoke / PILOT small-data correctness / FULL full-protocol comparison) - stages before FULL are for debugging only, all archived numbers and claims come from FULL runs; datasets and existing artifacts read-only — never delete or overwrite.",
  "Report failures as failures; escalate contradictions. Never fake or bypass.",
].join("\n");

const TEST_EN = [
  "You are the Test Engineer: code review, correctness roundtrip (incl. adversarial inputs), cross-scene generalization, perturbation stability.",
  "Independence is absolute: read the implementation under test, never modify it — a verifier who fixes makes the verification self-serving. You only write the self-check and the map.",
  "You own the claim→evidence map (docs/workflow/claim_map.md): every manuscript number ↔ an archived artifact + a re-runnable check; write the check before the claim. The file must carry a claim-map marker and be tabular.",
  "You create/maintain selfcheck.py at the repo root: it must contain at least one deliberately-broken canary case that must FAIL, marked `canary` so the orchestrator can verify it by search — a suite that cannot go red proves nothing.",
  "Every verdict carries evidence.",
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
  "You are the senior reader who has read every reference: verify the manuscript's citations and narrative against the literature, check for missed recent work, and ask questions.",
  "Per-round novelty check (mandatory): name the 3 closest existing works (title + venue + one line on what each did) and state in which dimension the idea substantially differs (problem setting / mechanism / scope of conclusions) - this is the evidence behind the report's novelty section, not a stop signal.",
  "Read-only; edit nothing. Reviews must contain both issues and next-round iteration proposals.",
].join("\n");

const idea = String(args.idea ?? "");
const rounds = typeof args.rounds === "number" ? args.rounds : 3;
const focus = typeof args.focus === "string" ? args.focus : "";
const profile = typeof args.profile === "string" ? args.profile : "";
const PROFILE_LINE = profile ? "\nProject constraints (mandatory, override defaults): " + profile : "";

artifact.table("rounds", {
  title: "Validation rounds",
  columns: [
    { field: "round", label: "Round" },
    { field: "task", label: "Task" },
    { field: "dev", label: "Build" },
    { field: "experiments", label: "Experiment mortality" },
    { field: "test", label: "Test gate" },
    { field: "review", label: "Worst review" },
    { field: "next", label: "Next direction" },
  ],
  key: "round",
});

phase("Chief: survey & scope");
const chief = agent("Chief Engineer", { system: CHIEF_EN + PROFILE_LINE });
let ledger = "";
try {
  ledger = await files.read("docs/workflow/ledger.md");
} catch {
  ledger = "";
}
const survey = await chief.ask<SurveyResult>(
  "Rough idea to iterate on: " + idea + "\n" + (focus ? "Boss focus: " + focus + "\n" : "") +
  (ledger
    ? "Existing ledger (tail excerpt; the resume basis):\n" + ledger.slice(-4000) + "\nIf it shows N rounds already completed for this idea, set resumeFrom = N (continue at round N+1; never redo finished rounds); otherwise 0.\n"
    : "No ledger in this repo: set resumeFrom = 0.\n") +
  "Survey (web + local paper library, e.g. docs/refs/) and return SurveyResult. " +
  "Constraints: proposal/competitor counts are your call within ≤3; plan a path to at least one properly powered end-to-end comparison before round 1 closes (staged pilots are for debugging; claims come from FULL runs).",
);
if (survey.paperRequests.length > 0) {
  log("Paper fetch requests (non-blocking, for the boss): " + survey.paperRequests.join("; "));
}
const startRound = Math.max(1, Math.min(rounds + 1, Math.round(survey.resumeFrom) + 1));
if (startRound > 1) log("Ledger shows " + (startRound - 1) + " round(s) done; resuming at round " + startRound);

const algo = agent("Algorithm Engineer", { system: ALGO_EN + PROFILE_LINE });
const tester = agent("Test Engineer", { system: TEST_EN + PROFILE_LINE });
const researcher = agent("Researcher", { system: RESEARCHER_EN + PROFILE_LINE });
const editor = agent("Editor", { system: EDITOR_EN + PROFILE_LINE });
const reader = agent("Reference Reader", { system: READER_EN + PROFILE_LINE });

const rows: RoundRow[] = [];
let plan = "Round " + startRound + ": follow the survey (proposals: " + survey.proposals.join(", ") + "; competitors: " + survey.competitors.join(", ") + ")";

for (let round = startRound; round <= rounds; round++) {
  phase("Issue work cards");
  const cards = await chief.ask<WorkCards>(
    "Round " + round + "/" + rounds + ". Idea: " + idea + "\n" +
    (round === 1 ? "Survey conclusion: " + survey.summary : "Last round's reviews and your planning: " + plan) + "\n" +
    "The proposal portfolio is re-selected by you every round (add/drop/replace, ≤3 and ≥1); every proposal selected this round must be fully validated.\n" +
    "Turn this round's work into cards (reproduce competitor X / try proposal Y...). Boss focus: " + (focus || "none"),
  );
  log("Round " + round + " task: " + cards.title);

  phase("Engineer: build & self-test");
  const dev = await algo.ask<DevReport>(
    "This round's cards: " + cards.cards.join("; ") + "\n" +
    "Build and self-test. Discipline: end-to-end real runs, numbers with exact definitions, faithful competitor reproduction; every proposal selected this round must be fully validated (three stages: MINI_PILOT/PILOT are for debugging only, claims come from FULL); by the end of round 1 there must be at least one end-to-end number from a complete comparison. Report experiments (attempted/passed) honestly.",
  );

  phase("Test Engineer: review & gate");
  const verdict = await tester.ask<TestVerdict>(
    "Review the build: " + JSON.stringify(dev) + "\n" +
    "Duties: code review / roundtrip (incl. adversarial inputs) / generalization / perturbation stability; update the claim→evidence map (docs/workflow/claim_map.md); " +
    "create or update selfcheck.py at the repo root with a must-fail canary case. Return TestVerdict.",
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
  const mapNote = claimMapOk ? "" : "claim map missing; ";
  let canary = false;
  try {
    canary = (await files.grep("canary", "selfcheck.py")).length > 0;
  } catch {
    canary = false;
  }
  if (!canary) log("Gate has no canary marker (a must-fail control case is required)");
  let gate = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const check = await world.run("python", ["selfcheck.py"], { timeoutMs: 3600000 });
    if (check.exitCode === 0 && canary) {
      gate = mapNote + "pass (attempt " + attempt + ")";
      break;
    }
    if (attempt === 3) {
      gate = mapNote + (canary ? "still failing after 3 fix attempts" : "gate not ready (no canary control case)");
      break;
    }
    try {
      canary = (await files.grep("canary", "selfcheck.py")).length > 0;
    } catch {
      canary = false;
    }
    await algo.ask<DevReport>(
      "selfcheck.py gate not passing (exit " + check.exitCode + (canary ? "" : ", and no canary control case") + "). Fix and rerun. Output excerpt:\n" +
      (check.stderr || check.stdout || "(no output)").slice(0, 1500) + "\nReturn DevReport; escalate if the premise is wrong.",
    );
  }

  phase("Fixes & extra experiments");
  let fixDev: DevReport = dev;
  const fixes = await chief.ask<string[]>(
    "Test verdict: " + JSON.stringify(verdict) + "\nGate: " + gate + "\nTurn test issues into fix / extra-experiment instructions (empty array if none).",
  );
  if (fixes.length > 0) {
    fixDev = await algo.ask<DevReport>("Execute fixes and extra experiments: " + fixes.join("; ") + "\nReturn DevReport.");
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
      agent("Reviewer-" + (i + 1)).ask<Review>(
        invite.brief + "\n\nYou are an independent reviewer from an adjacent (related but non-overlapping) field, read-only: raise sharp issues against the manuscript and evidence map (with evidence), propose next-round iterations, and give a severity. Say so if you cannot judge something.",
      ),
    ),
  );
  const readerRev = await reader.ask<Review>(
    "Review after reading the references (read-only). Manuscript summary: " + paper.slice(0, 500) + "\nVerify citations and narrative, check for missed recent work, ask questions, propose iterations.",
  );
  const reviews: Review[] = settled.map((s) =>
    s.status === "fulfilled" ? s.value : { summary: "reviewer did not finish", issues: [], iteration: [], severity: "minor" },
  );
  reviews.push(readerRev);
  const digest = reviews
    .map((r, i) => "[" + (i < n ? "Reviewer-" + (i + 1) : "Reference Reader") + " | " + r.severity + "] " + r.summary +
      "\n- Issues: " + (r.issues.join("; ") || "none") + "\n- Iteration: " + (r.iteration.join("; ") || "none"))
    .join("\n\n");

  phase("Archive round");
  const archived = await chief.ask<string>(
    "Append this round (task/build/test/reviews/next direction) to docs/workflow/ledger.md, then git add -A && git commit. After committing, push only to an encrypted local backup remote (e.g. a GitCoffer coffer remote, if one exists); **never push to cloud remotes (origin etc.) unless the boss explicitly asks in focus**. Return one sentence.",
  );

  const rank: Record<string, number> = { minor: 1, major: 2, blocker: 3 };
  const worst = reviews.reduce((a, b) => (rank[b.severity] > rank[a.severity] ? b : a));
  const nextDirection = reviews.flatMap((r) => r.iteration).slice(0, 3).join("; ");
  rows.push({
    round,
    task: cards.title,
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
  "Write the Preliminary Evaluation Report: verdict (continue/pivot/stop), expected success with reasoning that cites the experiment-mortality trend and the reader's novelty check, plus an explicit note that it is a qualitative judgement expressed numerically rather than a calibrated probability, novelty grounded in the 3 closest works, impact, points to watch if continued, " +
  "reviewerQuotes (verbatim, never paraphrased), and one line of advice. Write it to docs/workflow/evaluation_report.md.",
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
