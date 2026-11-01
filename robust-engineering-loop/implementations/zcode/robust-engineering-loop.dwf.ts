/* zcode-workflow
description: 鲁棒工程循环（v0.2.0）：总工程师先建"要求台账"（老板原话逐字+内涵+验收标准）并承诺 N 轮规划（老板可用 rounds 锁定）→ 每轮：算法工程师开发+文档（文档即交付物：专业、美观、简洁、无冗余重复）+单笔本地提交 → 测试工程师冷启动上岗（全新代理上下文，只见 diff 与代码，绝不见开发自报）：diff 审查（含文档质量）+鲁棒性测试+canary+本地 CI 全绿+警告即错误构建+核查上一轮 remote CI 结转 → 不过则算法工程师先复现（确认→修复 / 误诊→证据反驳，测试工程师仲裁）→ amend 并入本轮提交 → 复检（≤10 次仍红即打断上报老板）→ 全绿才推送约定 remote（默认 GitCoffer 自动探测，append-only 永不 force）→ 总工账本小提交；N 轮硬停出《最终汇报》：逐条要求→结果→证据+偏离说明；账本断点续跑。
args:
  requirement:
    type: string
    required: true
    description: 老板的开发要求，原话逐字（将进入要求台账并在最终汇报中逐条对账）
  rounds:
    type: number
    default: 0
    description: 总轮数；0 = 由总工程师规划并承诺（老板给定则锁定，硬停）
  remote:
    type: string
    default: "gitcoffer"
    description: 约定推送目标：自动探测 gitcoffer remote，或任意 remote 名/URL；none = 不推送
  profile:
    type: string
    default: ""
    description: 项目级约束（构建/测试/lint 命令及严格开关、CI 类型与本地等价命令、禁用做法；可为空）
  focus:
    type: string
    default: ""
    description: 老板本次运行的特别关注点（可为空）
*/

interface Commitment {
  /** 承诺的总轮数 N（第 1 轮前定死；老板用 rounds 锁定时以老板为准） */
  roundsTotal: number;
  /** 每轮一句话范围的规划（每轮一行） */
  roundsOutline: string;
  /** 账本显示已完成的轮数；全新为 0（据此从下一轮续跑） */
  resumeFrom: number;
  /** 重大问题才填：打断循环、写中断报告并提前返回 */
  blocked?: { reason: string; question: string };
}

interface RoundCards {
  /** 本轮主题一句话 */
  title: string;
  /** 任务卡清单，每卡一句话指令且可追溯到要求条目（R1/R2…） */
  cards: string[];
  /** 上一轮推送在 remote 上的 CI 问题（gh run 等核查所得；不可核查则如实注明），将列为本轮必修项 */
  remoteCiIssues: string[];
  /** 所有要求已闭环且门禁全绿时可置 true：提前完工，跳过剩余轮 */
  done?: boolean;
  /** 重大问题才填：打断循环并上报老板 */
  blocked?: { reason: string; question: string };
}

interface DevReport {
  /** 一句话：完成了什么 */
  summary: string;
  /** 产物文件路径 */
  artifacts: string[];
  /** 本轮各任务卡对应的要求覆盖（如 "R1: 接口完成（卡1）"）；只交给总工程师，绝不给测试工程师 */
  requirementCoverage: string[];
  /** 遗留事项，没有则写"无" */
  leftover: string;
}

interface Finding {
  /** 问题编号（F1/F2…），返修与反驳都以编号对账 */
  id: string;
  severity: "minor" | "major" | "blocker";
  /** 复现证据：命令 + 输出摘录（没有证据的问题不许提） */
  evidence: string;
}

interface TestVerdict {
  /** 一句话总评 */
  summary: string;
  /** 门禁是否全绿 */
  passed: boolean;
  /** 问题清单，每条附复现证据 */
  findings: Finding[];
}

interface FixOutcome {
  /** 一句话：返修情况 */
  summary: string;
  /** 确认属实并已修复（amend 并入本轮提交）的问题编号 */
  fixed: string[];
  /** 判为误诊并反驳的问题：编号 + 证据（命令输出/规格引用） */
  rebutted: { id: string; evidence: string }[];
}

interface RoundRow {
  round: number;
  task: string;
  dev: string;
  test: string;
  /** 问题与反驳计数（如 "3 问题 / 1 反驳"） */
  findings: string;
  push: string;
  next: string;
}

interface FinalReport {
  /** 完工判定 */
  verdict: "done" | "interrupted" | "incomplete";
  /** 逐条对账：老板原话 → 结果 → 证据（没有条目的要求不算完成） */
  requirementOutcomes: { id: string; verbatim: string; outcome: string; evidence: string }[];
  /** 与老板要求相悖的偏离，逐条附原因与替代选择；没有则空数组 */
  deviations: string[];
  /** 最终状态一句话：提交/推送/CI/测试/已知局限 */
  state: string;
  /** 只有老板能做的决策清单 */
  decisionList: string[];
  /** 给老板的一句建议 */
  advice: string;
}

const CHIEF_ZH = [
  "你是总工程师。使命：把老板（用户）的开发要求在承诺的有限轮数内变成高质量交付——每一轮都必须经过冷启动验证、全绿门禁、零警告编译，才允许推送。",
  "老板要求保真是最高纪律：第 1 轮开工前建 docs/workflow/requirements.md——老板原话逐字、内涵解释、验收标准，一条不落；执行中不得与老板要求相悖，不得不偏离时必须在《最终汇报》中逐条说明原因与替代选择，绝不悄悄违背。",
  "打断策略：重大问题（要求不可行、需要破坏性操作、会改变范围的歧义、需要加轮、门禁 10 次修复后仍红）→ 立即打断循环并写 docs/workflow/interrupt_report.md 向老板说明；小问题（范围内的实现细节、工具选择、顺序调整）→ 你自行决断并在账本记录。范围、进度、质量标准、预算这类老板级取舍不许被你降级成小问题。",
  "轮次规划：第 1 轮前承诺总轮数 N 与每轮一句话范围（老板用 rounds 参数锁定时以老板为准，不得增减）；每轮开始依据账本重新安排本轮任务卡——上一轮判决、问题与反驳、remote CI 结转、遗留事项都要处置；每张任务卡必须可追溯到要求条目（R1/R2…）。",
  "误诊仲裁：算法工程师与测试工程师就某条问题争执时，你只依据证据仲裁；仍不能定 → 重大问题，打断上报老板。",
  "接手先读账本（docs/workflow/ledger.md）：断点续跑，不重做已完成轮；账本同时记录每轮 baseline 哈希与已推送 SHA。",
  "诚实第一：汇报只引用命令输出与退出码；说不知道；矛盾上报而不是绕过。",
].join("\n");

const ALGO_ZH = [
  "你是算法工程师：实现本轮任务卡；每轮只做一笔本地提交（本轮提交），提交信息一句话概括本轮。文档即交付物：专业、美观、简洁——同一信息只在一处维护，杜绝冗余与重复；代码改动必须随附文档改动，纳入同一笔提交。",
  "测试工程师验证期间工作树冻结：不修改被测实现。",
  "返修纪律：拿到问题清单先逐条复现——确认属实的修复；复现不了或与事实不符的以证据反驳（命令输出、规格引用），绝不盲目\"修复\"不存在的问题——瞎改代码不是进度。",
  "修复一律 git add -A && git commit --amend --no-edit 并入本轮提交：绝不改写已推送历史，绝不 amend baseline 之下的提交。",
  "你的开发报告（含每张卡的要求覆盖）只交给总工程师做规划；测试工程师永远看不到它——冷启动是设计使能，不是疏漏。",
  "把失败当失败报告；矛盾上报。绝不造假、绝不绕过门禁、绝不 force 推送。",
].join("\n");

const TEST_ZH = [
  "你是测试工程师，冷启动上岗：你只依据 diff（baseline..HEAD）与代码库本身工作，绝不依赖作者的自述；没有人会给你开发报告，作者叙述会锚定验证者，这是设计使能。",
  "diff 审查：看实际改了什么，而不是声称改了什么；新代码、被改动的行为、文档与实现是否一致；文档质量（专业、美观、简洁、无冗余重复）不合格同样算问题。",
  "编写并维护鲁棒性测试：边界与对抗输入、适用的扰动场景；并在仓库根创建/维护 selfcheck.py，按项目 profile 聚合三件事——严格模式构建（警告即错误：-Werror / /WX / -D warnings / deny(warnings) 等按语言取）、全量测试+鲁棒性用例、本地 CI 等价执行（仓库配了 CI 就必须本地等价跑通）。",
  "selfcheck.py 必须含一个必须失败的金丝雀用例并带 canary 标记（编排器按标记搜索核验）——不会变红的测试套件证明不了任何事。",
  "核查上一轮推送在 remote 上的 CI：GitHub remote 且 gh 可用时用 gh run list / gh run view；不可核查则如实写\"无法核查\"，绝不默认通过；失败项列入本轮必修。",
  "独立性绝对：绝不修改被测实现。你只写 selfcheck.py、鲁棒性用例，以及 docs/workflow/requirement_map.md（要求↔实现位置↔可重跑验证命令，表格式并带 requirement-map 标记）的验证列。",
  "每条问题附复现证据（命令+输出）；修复后必须复跑原始失败检查确认关闭；对工程师的反驳只依据证据仲裁；构建系统都跑不起来、要求自相矛盾这类问题如实标 blocker。",
].join("\n");

const requirement = String(args.requirement ?? "");
const roundsArg = typeof args.rounds === "number" ? args.rounds : 0;
const remoteArg = typeof args.remote === "string" && args.remote !== "" ? args.remote : "gitcoffer";
const profile = typeof args.profile === "string" ? args.profile : "";
const focus = typeof args.focus === "string" ? args.focus : "";
const PROFILE_LINE = profile ? "\n项目约束（强制，覆盖默认）：" + profile : "";

/** 解析约定推送目标：返回 {target(名字或URL，空=跳过推送), note} */
async function resolvePushTarget(): Promise<{ target: string; note: string }> {
  if (remoteArg.toLowerCase() === "none") return { target: "", note: "老板已设 remote=none：全程不推送" };
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
    return { target: "", note: "未发现 gitcoffer remote（GitCoffer 未配置）：跳过推送并如实上报，绝不擅自改推别处" };
  }
  return { target: "", note: "remote 参数 \"" + remoteArg + "\" 不在 git remote 列表（" + (remotes.join(", ") || "无") + "）：跳过推送并如实上报" };
}

const HEAD0 = async (): Promise<string> => {
  try {
    const l = await git.log(1);
    return l[0]?.hash ?? "";
  } catch {
    return "";
  }
};

const CHIEF_BLOCK_NOTE = "\n（若为重大问题，填 blocked 并停止发卡：写 docs/workflow/interrupt_report.md——问题、已完成轮次与产物、需要老板决策的点、建议选项——然后本地提交。）";

artifact.table("rounds", {
  title: "工程开发轮次",
  columns: [
    { field: "round", label: "轮次" },
    { field: "task", label: "任务" },
    { field: "dev", label: "开发" },
    { field: "test", label: "冷启动门禁" },
    { field: "findings", label: "问题/反驳" },
    { field: "push", label: "推送" },
    { field: "next", label: "下一步" },
  ],
  key: "round",
});

phase("总工：要求入账与总体规划");
const chief = agent("总工程师", { system: CHIEF_ZH + PROFILE_LINE });
let ledger = "";
try {
  ledger = await files.read("docs/workflow/ledger.md");
} catch {
  ledger = "";
}
try {
  const st = await world.run("git", ["status", "--porcelain"], { timeoutMs: 60000 });
  if ((st.stdout || "").trim() !== "") log("警告：工作树不干净——请从干净工作树开始；已如实记入账本");
} catch {
  /* 无 git 或无法检查：跳过 */
}
const push0 = await resolvePushTarget();
if (push0.note !== "") log("推送目标：" + push0.note);
const commit0 = await chief.ask<Commitment>(
  "老板的开发要求（原话逐字）：" + requirement + "\n" + (focus ? "老板本次关注点：" + focus + "\n" : "") +
  (ledger ? "已有账本（末尾摘录，续跑依据）：\n" + ledger.slice(-4000) + "\n若显示本要求已完成 N 轮，resumeFrom = N（从第 N+1 轮续跑，不重做）；否则 0。\n" : "无账本：resumeFrom = 0。\n") +
  "第 1 轮开工前完成三件事：1) 建 docs/workflow/requirements.md 要求台账——老板原话逐字编号（R1/R2…）+ 内涵解释 + 验收标准，一条不落；若存在会改变范围的歧义，先在 blocked.question 里向老板提出（这是唯一的开工前提问）；2) 承诺总轮数 roundsTotal 与每轮一句话范围 roundsOutline" +
  (roundsArg > 0 ? "（老板已锁定 rounds=" + roundsArg + "，必须采用，不得增减）" : "（由你规划，定死即不得再加，除非打断上报）") +
  "；3) 本地提交该台账。返回 Commitment。" + CHIEF_BLOCK_NOTE,
);
let roundsTotal = roundsArg > 0 ? roundsArg : Math.round(commit0.roundsTotal);
if (!(roundsTotal >= 1)) roundsTotal = 3;
if (roundsTotal !== (roundsArg > 0 ? roundsArg : commit0.roundsTotal)) {
  log("总轮数 " + commit0.roundsTotal + " 无效，已按 " + roundsTotal + " 处理（如实记录）");
}
if (commit0.blocked) {
  phase("重大问题打断");
  const ir = await chief.ask<string>(
    "已按 blocked 打断。补全 docs/workflow/interrupt_report.md（问题、已完成轮次与产物、需要老板决策的问题、建议选项），git add -A && git commit，返回一句话摘要供老板速览。",
  );
  await artifact.markdown("interrupt", "# 中断报告\n\n" + ir + "\n\n---\n待老板决策后，携带补充说明重跑本工作流（账本已记录断点）。\n", { title: "中断报告", description: "重大问题：等待老板决策" });
  return { conclusion: "已打断：" + commit0.blocked.reason, question: commit0.blocked.question, rounds_completed: 0, next_action: "老板决策后重跑（从账本续跑）" };
}
log("总轮数承诺：" + roundsTotal + " 轮；规划：" + String(commit0.roundsOutline || "").replace(/\n/g, "；"));
const startRound = Math.max(1, Math.min(roundsTotal + 1, Math.round(commit0.resumeFrom) + 1));
if (startRound > 1) log("账本显示已完成 " + (startRound - 1) + " 轮，从第 " + startRound + " 轮续跑");

const algo = agent("算法工程师", { system: ALGO_ZH + PROFILE_LINE });
const rows: RoundRow[] = [];
let lastPushed = ""; // 上一轮推送的 SHA（供下一轮 remote CI 核查）
let plan = String(commit0.roundsOutline || "");
let finalVerdict: FinalReport | null = null;
let interrupted = false;

for (let round = startRound; round <= roundsTotal && !interrupted; round++) {
  const baseline = await HEAD0();
  phase("总工发卡");
  const cards = await chief.ask<RoundCards>(
    "第 " + round + "/" + roundsTotal + " 轮。老板要求见 docs/workflow/requirements.md；本轮规划依据：\n" + String(plan).slice(0, 4000) + "\n" +
    (lastPushed ? "上一轮已推送 " + lastPushed.slice(0, 7) + "：先核查其在 remote（" + (push0.target || "未配置") + "）上的 CI 状态（gh run list/view；不可核查则如实注明），失败项列入 remoteCiIssues 作为本轮必修。\n" : "") +
    "发本轮任务卡：每卡一句话且可追溯到要求条目；上一轮的问题、反驳、遗留逐条处置。所有要求已闭环且门禁全绿可置 done=true 提前完工。" + CHIEF_BLOCK_NOTE,
  );
  if (cards.blocked) {
    const ir = await chief.ask<string>(
      "已按 blocked 打断（第 " + round + " 轮开工前）。补全 docs/workflow/interrupt_report.md，git add -A && git commit（并推送 " + (push0.target || "无约定 remote") + "，不 force），返回一句话摘要。",
    );
    await artifact.markdown("interrupt", "# 中断报告（第 " + round + " 轮）\n\n" + ir + "\n\n---\n待老板决策后，携带补充说明重跑本工作流（账本已记录断点）。\n", { title: "中断报告", description: "重大问题：等待老板决策" });
    finalVerdict = { verdict: "interrupted", requirementOutcomes: [], deviations: [], state: ir, decisionList: [cards.blocked.question], advice: "重大问题已打断，等待老板决策" };
    interrupted = true;
    break;
  }
  if (cards.done === true) {
    log("总工判定所有要求已闭环，提前完工（如实记录）");
    break;
  }
  if (cards.cards.length === 0) {
    log("第 " + round + " 轮任务卡为空且未声明完工——按打断处理（如实记录）");
    const ir0 = await chief.ask<string>("任务卡为空又未完工，属规划异常：写明原因到 docs/workflow/ledger.md 并 git add -A && git commit，返回一句话。");
    finalVerdict = { verdict: "interrupted", requirementOutcomes: [], deviations: [], state: ir0, decisionList: ["总工未能在第 " + round + " 轮发出任务卡"], advice: "规划异常，请老板介入" };
    interrupted = true;
    break;
  }
  log("第 " + round + " 轮任务：" + cards.title + (cards.remoteCiIssues.length > 0 ? "；remote CI 结转必修：" + cards.remoteCiIssues.length + " 项" : ""));

  phase("算法工程师开发与提交");
  let dev = await algo.ask<DevReport>(
    "第 " + round + " 轮任务卡：\n" + cards.cards.map((c, i) => (i + 1) + ". " + c).join("\n") +
    (cards.remoteCiIssues.length > 0 ? "\n上一轮 remote CI 必修项：\n" + cards.remoteCiIssues.map((s) => "- " + s).join("\n") : "") +
    "\n开发并更新相关文档，然后 git add -A && git commit（本轮一笔提交，信息一句话）。返回 DevReport（requirementCoverage 标注每张卡覆盖的要求编号）。",
  );
  let headA = await HEAD0();
  if (headA === "" || headA === baseline) {
    await algo.ask<DevReport>("本轮提交未落地（HEAD 未前进）。现在执行 git add -A && git commit 并返回 DevReport。");
    headA = await HEAD0();
  }
  const commitOk = headA !== "" && headA !== baseline;
  log("第 " + round + " 轮提交 " + (commitOk ? "已落地（" + headA.slice(0, 7) + "，baseline " + (baseline || "空树").slice(0, 7) + "）" : "仍未落地——如实记录，测试将面对未提交改动"));

  phase("测试工程师冷启动门禁");
  const tester = agent("测试工程师-R" + round, { system: TEST_ZH + PROFILE_LINE }); // 每轮全新实例：冷启动
  const diffHint = baseline ? "git diff " + baseline + "..HEAD" : "git show HEAD（整仓首提交）";
  let verdict: TestVerdict = { summary: "未开始", passed: false, findings: [] };
  let gate = "";
  let canary = false;
  let mapOk = false;
  let findingsCount = 0;
  let rebuttedCount = 0;
  let interpIsPy3 = false;
  let lastFix: FixOutcome | null = null;

  for (let attempt = 1; attempt <= 10; attempt++) {
    verdict = await tester.ask<TestVerdict>(
      (attempt === 1
        ? "冷启动上岗。baseline 提交：" + (baseline || "（空树，本仓库首提交）") + "。审查 " + diffHint + " 与代码库本身：diff 审查、鲁棒性测试、selfcheck.py（严格构建/全量测试+鲁棒性/本地 CI 等价 + canary 标记）、更新 docs/workflow/requirement_map.md 验证列。"
        : "算法工程师已返修（amend 并入本轮提交），其返修申报（只作对账线索，结论仍以你重跑的检查为准）：" + JSON.stringify(lastFix) + "\n逐条复检：修复项重跑原始失败检查确认关闭；反驳项只依据证据仲裁——反驳成立则撤回问题，不成立则保留并说明。") +
      (cards.remoteCiIssues.length > 0 ? "\n另：上一轮 remote CI 必修项已由算法工程师处理：" + cards.remoteCiIssues.join("; ") : "") +
      "返回 TestVerdict（问题必须有复现证据）。",
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
            output = "python 与 python3 均无法启动 selfcheck.py";
          }
        } else {
          output = "selfcheck.py 启动失败或超时";
        }
      }
    } else {
      output = "selfcheck.py 缺少 canary 标记（必须失败的金丝雀用例）";
    }
    if (verdict.passed && exitCode === 0 && canary && mapOk) {
      gate = "pass（第 " + attempt + " 次尝试" + (interpIsPy3 ? "，python3" : "") + "）";
      break;
    }
    if (attempt === 10) {
      gate = (verdict.passed ? "" : "测试未过；") + (canary ? "" : "缺 canary；") + (mapOk ? "" : "要求映射表缺失；") + (exitCode === 0 ? "" : "selfcheck exit " + exitCode);
      break;
    }
    const fix = await algo.ask<FixOutcome>(
      "第 " + attempt + " 次门禁未过：" + (verdict.passed ? "（自检通过但 selfcheck/映射表未达标）" : JSON.stringify(verdict.findings)) +
      "\n机械状态：canary=" + (canary ? "有" : "无") + "；requirement_map=" + (mapOk ? "有效" : "缺失") + "；selfcheck exit=" + (canary ? exitCode : "未运行") +
      "\n输出摘录：\n" + output +
      "\n先逐条复现：确认→修复；误诊→证据反驳（FixOutcome.rebutted）。然后 git add -A && git commit --amend --no-edit 并入本轮提交。绝不改写 baseline 之下的历史。",
    );
    lastFix = fix;
    const headFix = await HEAD0();
    let log2: { hash?: string }[] = [];
    try {
      log2 = await git.log(2);
    } catch {
      log2 = [];
    }
    const baselineStable = baseline === "" ? true : (log2[1]?.hash ?? "") === baseline;
    if (headFix === "" || headFix === headA || !baselineStable) {
      await algo.ask<string>(
        "amend 纪律核验未过（HEAD=" + (headFix || "无").slice(0, 7) + "，baseline 稳定=" + baselineStable + "）。请检查：修复必须 amend 进本轮提交且不动 baseline 之下的历史；执行 git add -A && git commit --amend --no-edit（或先修复漏提交的改动），返回一句话。",
      );
    }
    headA = headFix;
    rebuttedCount += fix.rebutted.length;
  }

  if (gate === "" || !gate.startsWith("pass")) {
    phase("门禁 10 次仍红，打断上报");
    const ir = await chief.ask<string>(
      "第 " + round + " 轮门禁 10 次修复后仍未全绿（" + gate + "）。属重大问题：写 docs/workflow/interrupt_report.md（当前状态、失败证据、已尝试的修复、需要老板决策的点），git add -A && git commit（不推送未过门禁的提交，除非老板此前另有约定），返回一句话摘要。",
    );
    await artifact.markdown("interrupt", "# 中断报告（第 " + round + " 轮门禁）\n\n" + ir + "\n\n---\n门禁：" + gate + "\n待老板决策。\n", { title: "中断报告", description: "门禁 10 次仍红" });
    finalVerdict = { verdict: "interrupted", requirementOutcomes: [], deviations: [], state: ir, decisionList: ["第 " + round + " 轮门禁未过：" + gate], advice: "门禁持续未过，请老板介入" };
    interrupted = true;
    break;
  }
  headA = await HEAD0();

  phase("推送约定 remote");
  let pushState = "未推送";
  if (push0.target !== "") {
    let branch = "main";
    try {
      const b = await world.run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { timeoutMs: 60000 });
      branch = (b.stdout || "").trim() || "main";
    } catch {
      branch = "main";
    }
    await algo.ask<string>("门禁已全绿。推送本轮提交到约定 remote：git push " + push0.target + " HEAD:" + branch + "（绝不 --force）。返回一句话。");
    try {
      const ls = await world.run("git", ["ls-remote", push0.target, "refs/heads/" + branch], { timeoutMs: 120000 });
      const remoteHead = ((ls.stdout || "").split("\t")[0] || "").trim();
      if (remoteHead === headA && headA !== "") {
        pushState = "已推送并核验（" + headA.slice(0, 7) + "@" + push0.target + "/" + branch + "）";
        lastPushed = headA;
      } else {
        await algo.ask<string>("推送核验失败（remote HEAD=" + remoteHead.slice(0, 7) + " ≠ 本地 " + headA.slice(0, 7) + "）。重推一次 git push " + push0.target + " HEAD:" + branch + "（不 force），返回一句话。");
        try {
          const ls2 = await world.run("git", ["ls-remote", push0.target, "refs/heads/" + branch], { timeoutMs: 120000 });
          const rh2 = ((ls2.stdout || "").split("\t")[0] || "").trim();
          if (rh2 === headA && headA !== "") {
            pushState = "已推送并核验（重试后）";
            lastPushed = headA;
          } else {
            pushState = "推送核验失败（如实上报：remote=" + rh2.slice(0, 7) + "）";
          }
        } catch {
          pushState = "推送核验失败（ls-remote 不可用，如实上报）";
        }
      }
    } catch {
      pushState = "推送核验失败（ls-remote 不可达，如实上报）";
    }
  } else {
    pushState = "跳过推送：" + push0.note;
  }
  log("第 " + round + " 轮推送：" + pushState);

  phase("总工记账");
  const archived = await chief.ask<string>(
    "把第 " + round + " 轮追加到 docs/workflow/ledger.md：任务卡、开发摘要、测试判决（问题 " + findingsCount + " / 反驳 " + rebuttedCount + "）、门禁 " + gate + "、baseline " + (baseline || "空树").slice(0, 7) + "、推送 " + pushState + "、下一轮方向。然后 git add -A && git commit（账本小提交）" +
    (push0.target !== "" ? "并推送（git push " + push0.target + "，不 force）" : "") + "，返回一句话。",
  );
  const headLedger = await HEAD0();
  log("第 " + round + " 轮记账 " + (headLedger !== "" && headLedger !== headA ? "已落地（" + headLedger.slice(0, 7) + "）" : "需人工复核"));
  rows.push({
    round,
    task: cards.title,
    dev: dev.summary,
    test: gate,
    findings: findingsCount + " 问题 / " + rebuttedCount + " 反驳",
    push: pushState,
    next: archived.slice(0, 200),
  });
  report(rows[rows.length - 1], "rounds");
  plan = "第 " + (round + 1) + " 轮规划依据：测试总评「" + verdict.summary + "」；开发遗留「" + dev.leftover + "」；账本最新一轮记录。";
}

phase("最终汇报");
if (!finalVerdict) {
  finalVerdict = await chief.ask<FinalReport>(
    (interrupted ? "（运行被打断，汇报现状）" : roundsTotal + " 轮硬停（或提前完工）。") +
    "以 docs/workflow/requirements.md 与账本为唯一依据，写《最终汇报》到 docs/workflow/final_report.md：逐条要求（原话逐字）→结果→证据（requirementOutcomes，没有条目的要求不算完成）；与老板要求相悖的偏离逐条说明（deviations）；最终状态（提交/推送/CI/测试/已知局限）；只有老板能做的决策清单（decisionList）；一句建议。git add -A && git commit" +
      (push0.target !== "" ? "并推送约定 remote（不 force）" : "") + "。返回 FinalReport。",
  );
}
const md = [
  "# 最终汇报",
  "",
  "老板要求（原话）：" + requirement,
  "",
  "## 逐条对账",
  ...finalVerdict.requirementOutcomes.map((o) => "- **" + o.id + "** 「" + o.verbatim + "」→ " + o.outcome + "（证据：" + o.evidence + "）"),
  "",
  "## 偏离说明",
  finalVerdict.deviations.length > 0 ? finalVerdict.deviations.map((d) => "- " + d) : "- 无：未发生与老板要求相悖的偏离",
  "",
  "## 最终状态",
  finalVerdict.state,
  "",
  "## 待老板决策",
  ...finalVerdict.decisionList.map((d) => "- " + d),
  "",
  "## 建议",
  finalVerdict.advice,
  "",
  "---",
  "判定：" + finalVerdict.verdict + "；已执行轮数：" + rows.length + "。",
].join("\n");
await artifact.markdown("report", md, { title: "最终汇报", description: "要求逐条对账 + 偏离说明 + 待决策清单", primary: true });

return {
  conclusion: finalVerdict.advice,
  verdict: finalVerdict.verdict,
  rounds_completed: rows.length,
  requirement_coverage: finalVerdict.requirementOutcomes.length,
  deviations: finalVerdict.deviations.length,
  next_action: finalVerdict.decisionList.length > 0 ? "待老板决策：" + finalVerdict.decisionList[0] : "交付完成，等待老板验收",
};
