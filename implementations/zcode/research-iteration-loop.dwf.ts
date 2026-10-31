/* zcode-workflow
description: 科研迭代循环（SPEC v0.5）：从一个初步想法出发自我迭代——总工程师调研立项 → 算法工程师开发 → 测试工程师独立验证与 canary 门禁 → 修复补充 → 研究员修订/创建文稿 → 编辑邀请审稿 → 审稿+迭代建议 → 本地存档；N 轮后硬停，产出《初步评估报告》。支持账本断点续跑。
args:
  idea:
    type: string
    required: true
    description: 待迭代的初步想法（一段话描述）
  rounds:
    type: number
    default: 3
    description: 硬停前执行的总轮数（配合账本可续跑）
  focus:
    type: string
    default: ""
    description: 老板当轮特别关注点（可为空）
  profile:
    type: string
    default: ""
    description: 项目级约束（如硬件内存上限、数据只读规则、禁用做法、备份方式；可为空）
*/

interface SurveyResult {
  /** 调研结论两三句 */
  summary: string;
  /** 拿不到原文的论文清单（题名+出处），供老板代取；非阻塞，先降置信度推进 */
  paperRequests: string[];
  /** 选定的方案（数量由总工依据调研在 ≤3 内决定） */
  proposals: string[];
  /** 选定复现的竞品（≤3，各附一句选择理由） */
  competitors: string[];
  /** 账本显示本想法已完成的轮数；全新为 0（据此从下一轮续跑） */
  resumeFrom: number;
}

interface WorkCards {
  /** 本轮主题一句话 */
  title: string;
  /** 任务卡清单，每卡一句话指令 */
  cards: string[];
}

interface DevReport {
  /** 一句话：完成了什么 */
  summary: string;
  /** 产物文件路径 */
  artifacts: string[];
  /** 端到端真实跑出的数字，每条注明口径（数据、窗口、单位、每个累加器含义）——只允许 FULL 级实验的数字 */
  numbers: string[];
  /** 本轮实验死亡率：尝试数/跑通数（含死在调试阶段的，如实统计） */
  experiments: string;
  /** 遗留事项，没有则写"无" */
  leftover: string;
}

interface TestVerdict {
  /** 一句话总评 */
  summary: string;
  /** 问题清单（代码/泛化/可靠性），每条附证据 */
  issues: string[];
}

interface Invite {
  /** 编辑决定的审稿人数（1–3） */
  count: number;
  /** 提炼的关键词 */
  keywords: string[];
  /** 收紧的审稿简报：稿件+证据映射表+定向问题（不含全仓库） */
  brief: string;
}

interface Review {
  /** 一句话总评 */
  summary: string;
  /** 尖锐质询，每条附证据出处（稿件章节/文件:行/文献） */
  issues: string[];
  /** 下一轮迭代建议 */
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
  /** 总判断 */
  verdict: "继续" | "转向" | "停止";
  /** 预期成功率：定性判断的数值化表达，非校准概率（须注明这一点与推理依据） */
  successOdds: string;
  /** 创新性评估 */
  novelty: string;
  /** 影响力评估 */
  impact: string;
  /** 继续做要注意的点 */
  risks: string[];
  /** 逐字引用每位审稿人的结论，不得改写 */
  reviewerQuotes: string[];
  /** 给老板的一句建议 */
  advice: string;
}

const CHIEF_ZH = [
  "你是总工程师。使命：在有限轮数内判断 args.idea 是否值得深挖，并把它迭代推进——不是把它做完美。",
  "接手先读账本（docs/workflow/ledger.md）：若本想法已有记录，从断点轮继续，不重做已完成轮。",
  "调研（网络检索+本地论文库）：拿不到原文的论文列入 paperRequests 供老板代取——非阻塞，先降置信度推进，绝不空等。",
  "方案数（≤3）与竞品复现数（≤3）由你依据调研在循环内决定，上限不可突破。",
  "方案 Portfolio 是每轮动态的：每轮开始时你依据最新审稿意见重新选定 1–3 个方案（可新增、移除、替换；有得选时选满 3 个，不足时 1–2 个，至少 1 个）与竞品集合；本轮选中的每个方案都必须得到充分验证，禁止用最小对比冒充验证——最小对比会带偏结论。",
  "新颖性处理：若文献读者报告该想法已被做过，不要终止——把范围重定界到该方向上尚未解决的缺口，重新选定方案，跑满全部轮次。",
  "诚实第一：数字必须可溯源到存档工件；不确定就说不确定；指令矛盾时如实升级提问。",
  "全程中文。",
].join("\n");

const ALGO_ZH = [
  "你是算法工程师：实现方案/复现竞品。端到端真实跑，每个数字注明口径（数据、窗口、单位、每个累加器含义）。",
  "竞品复现必须保真：与原文发表数字对照，偏差逐条记录——你不能既造自己的方法又给竞品打分。",
  "测试冻结规则：测试工程师验证期间，你不修改被测实现（否则测试对象在漂移，结论无效）。此时你只做两件事：准备可复现包（环境/命令/随机种子/数据窗口），响应门禁失败。测试报告返回后再按裁决修复。",
  "长任务安全（硬约束）：逐批次/逐场景用独立子进程运行，结果立即落盘后退出释放内存；脚本内置内存护栏（超约物理内存 70–80% 主动终止并保存现场）；每步有超时与失败出口；数据集与既有产物只读，不删除不覆盖。",
  "实验三级执行纪律：每个新实验先 MINI_PILOT（冒烟，验证代码能跑通与内存量级）→ PILOT（小数据核对正确性）→ FULL（正式协议的完整对比）。调试只看 PILOT 及以前；所有入档数字与主张只来自 FULL——禁止拿最小对比的结果冒充验证结论。报告 experimentsAttempted/experimentsPassed 时如实统计（含死在调试阶段的）。",
  "如实报告失败；指令矛盾则升级提问，不造假不绕过。全程中文。",
].join("\n");

const TEST_ZH = [
  "你是测试工程师：代码审查、正确性 roundtrip（含对抗输入）、跨场景泛化、扰动稳定性。",
  "独立性铁律：只读被测实现，绝不修改它——你动手修，验证就变成自我服务、不再独立。你只写自检与映射表。",
  "你拥有 claim→evidence 映射表（docs/workflow/claim_map.md）：稿件每个数字 ↔ 存档工件 + 可重跑的检查命令；先写检查，再做主张。文件首行须含 claim-map 标记，正文用表格。",
  "你负责在仓库根目录建立/维护 selfcheck.py：必须含至少一个故意埋坏、必须 FAIL 的金丝雀用例（代码中带 canary 标记，供编排器检索核对）——不会变红的测试套件证明不了任何事。",
  "每条裁决附证据。全程中文。",
].join("\n");

const RESEARCHER_ZH = [
  "你是研究员：每轮唯一一次修订时机（开发后、审稿前），实事求是修订 docs/paper_draft.md；若该文件尚不存在，按实验结果与写作规范创建初稿。",
  "只写 claim→evidence 映射表里有的数字，缺口留显式 [TODO]；遵循获奖论文写作规范：具体开头、条件化 gap、组件递进、消融对应论断、Limitations 独立成节、禁 AI 腔。全程中文。",
].join("\n");

const EDITOR_ZH = [
  "你是编辑：从稿件提炼关键词；决定邀请几位审稿人（1–3，由你在循环内决定）+ 1 位通读全部参考文献的资深读者。",
  "审稿人领域选择：与研究方向相关但不重叠的相邻领域。",
  "盲审纪律：审稿简报必须匿名化——剥离作者、单位、项目身份特征（身份披露会显著偏移审稿结论）；各审稿人互不可见对方意见，独立完成后由编排器汇总；引擎允许时审稿角色使用与开发角色不同的模型，以降低两者错误模式的相关性。",
  "审稿简报必须收紧：稿件 + claim→evidence 映射表 + 定向问题——不含全仓库。全程中文。",
].join("\n");

const READER_ZH = [
  "你是通读本项目全部参考文献的资深读者：核对稿件引用与叙事是否与文献事实一致、查新最新论文、就文献覆盖提问。",
  "每轮必答的新颖性核查：给出与该想法最相近的 3 篇已有工作（题名+出处+一句话说明各自做了什么），并判断本想法与它们的实质差异在哪个维度（问题设定/方法机制/结论范围）——这是评估报告创新性一栏的证据，不是终止信号。",
  "只读，不改任何文件。审稿须同时给出质询与下一轮迭代建议。全程中文。",
].join("\n");

const idea = String(args.idea ?? "");
const rounds = typeof args.rounds === "number" ? args.rounds : 3;
const focus = typeof args.focus === "string" ? args.focus : "";
const profile = typeof args.profile === "string" ? args.profile : "";
const PROFILE_LINE = profile ? "\n项目级约束（必须遵守，高于默认做法）：" + profile : "";

artifact.table("rounds", {
  title: "验证轮次看板",
  columns: [
    { field: "round", label: "轮次" },
    { field: "task", label: "任务" },
    { field: "dev", label: "开发" },
    { field: "experiments", label: "实验死亡率" },
    { field: "test", label: "测试门禁" },
    { field: "review", label: "最严重审稿意见" },
    { field: "next", label: "下轮方向" },
  ],
  key: "round",
});

phase("总工程师调研立项");
const chief = agent("总工程师", { system: CHIEF_ZH + PROFILE_LINE });
let ledger = "";
try {
  ledger = await files.read("docs/workflow/ledger.md");
} catch {
  ledger = "";
}
const survey = await chief.ask<SurveyResult>(
  "待迭代的初步想法：" + idea + "\n" + (focus ? "老板特别关注：" + focus + "\n" : "") +
  (ledger
    ? "已有账本（末尾节选，断点续跑依据）：\n" + ledger.slice(-4000) + "\n若账本显示本想法已完成 N 轮，resumeFrom 填 N（从第 N+1 轮继续，勿重做已完成轮）；否则填 0。\n"
    : "本仓库无既有账本：resumeFrom 填 0。\n") +
  "请完成调研（网络检索 + 本地论文库，如 docs/refs/），返回 SurveyResult。" +
  "约束：方案与竞品数量由你在 ≤3 内依据证据决定；第一轮结束前必须规划出至少一个最小端到端对比的落地路径。",
);
if (survey.paperRequests.length > 0) {
  log("求论文清单（非阻塞，供老板代取）：" + survey.paperRequests.join("；"));
}
const startRound = Math.max(1, Math.min(rounds + 1, Math.round(survey.resumeFrom) + 1));
if (startRound > 1) log("账本显示已完成 " + (startRound - 1) + " 轮，从第 " + startRound + " 轮续跑");

const algo = agent("算法工程师", { system: ALGO_ZH + PROFILE_LINE });
const tester = agent("测试工程师", { system: TEST_ZH + PROFILE_LINE });
const researcher = agent("研究员", { system: RESEARCHER_ZH + PROFILE_LINE });
const editor = agent("编辑", { system: EDITOR_ZH + PROFILE_LINE });
const reader = agent("文献资深读者", { system: READER_ZH + PROFILE_LINE });

const rows: RoundRow[] = [];
let plan = "第 " + startRound + " 轮：按调研结论执行（方案：" + survey.proposals.join("、") + "；竞品：" + survey.competitors.join("、") + "）";

for (let round = startRound; round <= rounds; round++) {
  phase("布置本轮任务卡");
  const cards = await chief.ask<WorkCards>(
    "第 " + round + "/" + rounds + " 轮。idea：" + idea + "\n" +
  (round === 1 ? "调研结论：" + survey.summary : "上一轮审稿意见与你的规划：" + plan) + "\n" +
  "注意：方案 Portfolio 每轮由你重新选定（可新增/移除/替换，≤3 且 ≥1）；本轮选中的每个方案都要充分验证。\n" +
  "把本轮工作转成任务卡（复现竞品 X / 尝试方案 Y…）。老板关注：" + (focus || "无"),
  );
  log("第 " + round + " 轮任务：" + cards.title);

  phase("算法工程师开发自测");
  const dev = await algo.ask<DevReport>(
    "本轮任务卡：" + cards.cards.join("；") + "\n" +
    "开发并自测。纪律：端到端真实跑、数字注明口径、竞品保真对照；本轮选中的每个方案都必须得到充分验证（三级执行：MINI_PILOT/PILOT 只用于调试，主张只来自 FULL）；第 1 轮结束时必须已有至少一个来自完整对比的端到端数字。如实报告 experiments（尝试数/跑通数）。",
  );

  phase("测试工程师审查测试");
  const verdict = await tester.ask<TestVerdict>(
    "审查开发产出：" + JSON.stringify(dev) + "\n" +
    "职责：代码审查/roundtrip（含对抗输入）/泛化/扰动稳定性；更新 claim→evidence 映射表（docs/workflow/claim_map.md）；" +
    "建立或更新仓库根目录 selfcheck.py，必须含必须失败的金丝雀用例。返回 TestVerdict。",
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
      "docs/workflow/claim_map.md 缺失或不合格（需含 claim-map 标记 + 表格行）。请建立：每行 = 稿件数字 | 存档工件 | 可重跑的检查命令。",
    );
    try {
      const map = await files.read("docs/workflow/claim_map.md");
      claimMapOk = map.includes("claim-map") && map.split("\n").filter((l) => l.trim().startsWith("|")).length >= 2;
    } catch {
      claimMapOk = false;
    }
  }
  const mapNote = claimMapOk ? "" : "映射表未建立（数字溯源不完整）；";
  let canary = false;
  try {
    canary = (await files.grep("canary", "selfcheck.py")).length > 0;
  } catch {
    canary = false;
  }
  if (!canary) log("门禁缺少 canary 标记（自检须含必须失败的对照用例）");
  let gate = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const check = await world.run("python", ["selfcheck.py"], { timeoutMs: 3600000 });
    if (check.exitCode === 0 && canary) {
      gate = mapNote + "通过（第 " + attempt + " 次尝试）";
      break;
    }
    if (attempt === 3) {
      gate = mapNote + (canary ? "3 次修复后仍失败" : "门禁未就绪（自检缺少 canary 对照用例）");
      break;
    }
    canary = true;
    try {
      canary = (await files.grep("canary", "selfcheck.py")).length > 0;
    } catch {
      canary = false;
    }
    await algo.ask<DevReport>(
      "selfcheck.py 门禁未通过（exit " + check.exitCode + (canary ? "" : "，且缺少 canary 对照用例") + "）。请修复后重跑。输出摘要：\n" +
      (check.stderr || check.stdout || "(无输出)").slice(0, 1500) + "\n返回 DevReport，summary 注明修复内容；前提不成立则升级提问。",
    );
  }

  phase("修复与补充实验");
  let fixDev: DevReport = dev;
  const fixes = await chief.ask<string[]>(
    "测试结论：" + JSON.stringify(verdict) + "\n门禁：" + gate + "\n把测试问题转成修复/补充实验指令（可为空数组=无需修复）。",
  );
  if (fixes.length > 0) {
    fixDev = await algo.ask<DevReport>("执行修复与补充实验：" + fixes.join("；") + "\n返回 DevReport。");
  }

  phase("研究员修订文稿");
  const paper = await researcher.ask<string>(
    "开发与测试已完成，这是你本轮唯一修订时机。开发报告：" + JSON.stringify(dev) +
    "\n修复与补充实验报告（其中的新数字同样可入稿）：" + JSON.stringify(fixDev) + "\n测试结论：" + verdict.summary +
    "\n实事求是修订 docs/paper_draft.md：只写映射表里有的数字，缺口留 [TODO]。返回一段修订摘要。",
  );

  phase("编辑邀请审稿人");
  const invite = await editor.ask<Invite>(
    "稿件已更新（docs/paper_draft.md，摘要：" + paper.slice(0, 500) + "）。\n" +
    "提炼关键词，决定邀请几位审稿人（1–3），并撰写收紧的审稿简报（稿件+映射表+定向问题，不含全仓库）。返回 Invite。",
  );
  const n = Math.max(1, Math.min(3, Math.round(invite.count)));

  phase("审稿团评审");
  const settled = await Promise.allSettled(
    Array.from({ length: n }, (_, i) =>
      agent("审稿人" + (i + 1)).ask<Review>(
        invite.brief + "\n\n你是相邻领域（与本研究方向相关但不重叠）的独立审稿人，只读：对稿件与证据映射提出尖锐质询（附证据出处），并给出下一轮迭代建议，给 severity。如无法判断，如实说明。",
      ),
    ),
  );
  const readerRev = await reader.ask<Review>(
    "通读文献后审稿（只读）。稿件摘要：" + paper.slice(0, 500) + "\n核对引用与叙事、查新、提问，并给出迭代建议。",
  );
  const reviews: Review[] = settled.map((s) =>
    s.status === "fulfilled" ? s.value : { summary: "该审稿人未完成", issues: [], iteration: [], severity: "minor" },
  );
  reviews.push(readerRev);
  const digest = reviews
    .map((r, i) => "【" + (i < n ? "审稿人" + (i + 1) : "文献读者") + "｜" + r.severity + "】" + r.summary +
      "\n- 质询：" + (r.issues.join("；") || "无") + "\n- 迭代建议：" + (r.iteration.join("；") || "无"))
    .join("\n\n");

  phase("本轮存档");
  const archived = await chief.ask<string>(
    "把本轮（任务/产出/测试/审稿/下轮方向）追加到 docs/workflow/ledger.md，然后 git add -A && git commit。提交后仅推送到本地加密备份 remote（如 GitCoffer 构建的 coffer remote，若存在）；**绝不 push 到云端 remote（origin 等），除非老板在 focus 中明确要求**。返回一句话。",
  );

  const worst = reviews.reduce((a, b) => (({ minor: 1, major: 2, blocker: 3 } as Record<string, number>)[b.severity] >
    ({ minor: 1, major: 2, blocker: 3 } as Record<string, number>)[a.severity] ? b : a));
  const nextDirection = reviews.flatMap((r) => r.iteration).slice(0, 3).join("；");
  rows.push({
    round,
    task: cards.title,
    dev: dev.summary + (fixDev !== dev ? "（含修复补充）" : ""),
    experiments: [dev.experiments, fixDev !== dev ? fixDev.experiments : ""].filter((s) => s && s !== "无").join("；") || "未报告",
    test: gate,
    review: "【" + worst.severity + "】" + worst.summary,
    next: nextDirection.slice(0, 200),
  });
  report(rows[rows.length - 1], "rounds");
  plan = digest;
}

phase("初步评估报告");
const resumeNote = rows.length === 0 ? "账本显示全部轮次已完成，本次运行直接从账本与存档产物出评估报告。" : "";
const evalResult = await chief.ask<EvalReport>(
  resumeNote + rounds + " 轮已完成，硬停。全部审稿意见：\n" + plan.slice(0, 6000) + "\n" +
  "轮次记录（含每轮实验死亡率 experiments 字段）：" + JSON.stringify(rows) + "\n" +
  "撰写《初步评估报告》：verdict（继续/转向/停止）、预期成功率（推理依据必须引用实验死亡率趋势与文献读者的新颖性核查结论；并明确标注『这是定性判断的数值化表达，非校准概率』）、创新性（引用最相近 3 篇工作与实质差异维度）、影响力、继续做要注意的点、" +
  "reviewerQuotes（逐字引用每位审稿人结论，不得改写）、给老板的建议。写入 docs/workflow/evaluation_report.md。",
);
const md = [
  "# 初步评估报告",
  "",
  "idea：" + idea,
  "",
  "## 总判断：" + evalResult.verdict,
  "",
  "- 预期成功率：" + evalResult.successOdds,
  "- 创新性：" + evalResult.novelty,
  "- 影响力：" + evalResult.impact,
  "",
  "## 继续做要注意的点",
  ...evalResult.risks.map((r) => "- " + r),
  "",
  "## 审稿人原话",
  ...evalResult.reviewerQuotes.map((q) => "> " + q),
  "",
  "## 给老板的建议",
  evalResult.advice,
  "",
  "---",
  "说明：预期成功率是定性判断的数值化表达，非校准概率；审稿人原话未经改写，可能与总判断不一致。",
].join("\n");
await artifact.markdown("report", md, { title: "初步评估报告", description: "三轮硬停后的 go/no-go 评估", primary: true });

return {
  conclusion: evalResult.advice,
  verdict: evalResult.verdict,
  rounds_completed: rows.length,
  paper_requests: survey.paperRequests,
  next_action: "等待老板决策：再次运行本工作流并传 focus 参数反馈（继续/转向/停止）",
};
