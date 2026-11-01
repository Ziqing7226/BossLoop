/* zcode-workflow
description: 科研迭代循环（v0.2.8）：总工程师每轮重组方案 Portfolio（机械校验 1–3）→ 算法工程师三级执行（FULL 出数、第 1 轮端到端数字机械补验）→ 测试工程师独立验证 + canary/映射表/解释器自动回退三重门禁（修复裁决归测试工程师；头条数字双路径复算，撤回即全库扫描）→ 修复补充 → 研究员修订 → 编辑盲审（审稿人每轮唯一命名）→ 含实验死亡率与新颖性核查的审稿 → 存档（HEAD 落盘核验 + 本地加密备份 remote，绝不推云端）；N 轮硬停出《初步评估报告》，账本断点续跑。模型分档（tiered：总工/编辑/审稿人/文献读者用 GLM-5.3，算法/测试/研究员用 GLM-5.3-Flash；审稿与开发异档即天然满足盲审去相关；models=uniform 全随会话模型）。破坏性操作只申报、由强档总工裁决后按批准执行（开发与修复路径全覆盖），不转交用户。
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
  models:
    type: string
    default: "tiered"
    description: 模型分档；tiered = 分析类角色（总工/编辑/审稿/文献读者）用强模型、实践类角色（算法/测试/研究员）用廉价模型（本参考实现为 GLM-5.3 与 GLM-5.3-Flash），uniform = 全部随会话模型
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
  /** 本轮选定的方案名（1–3 个，机械校验） */
  proposals: string[];
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
  /** 需要执行的破坏性操作（删除数据集/覆盖产物/改写历史）：只申报，绝不自行执行；没有则空数组 */
  dangerRequests: DangerRequest[];
  /** 遗留事项，没有则写"无" */
  leftover: string;
}

interface TestVerdict {
  /** 一句话总评 */
  summary: string;
  /** 问题清单（代码/泛化/可靠性），每条附证据 */
  issues: string[];
  /** 覆盖声明：深审了哪些文件/区域、只略读了哪些（先于判定写出，供日后对账） */
  coverage: string;
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
  /** 与该想法最相近的已有工作及差异维度（文献读者必答；其他审稿人可空） */
  nearestWorks?: string[];
  severity: "minor" | "major" | "blocker";
}

interface DangerRequest {
  /** 拟执行的破坏性命令原文 */
  command: string;
  /** 为什么必须这么做 */
  reason: string;
  /** 影响范围：将删除/覆盖哪些路径或数据、是否可逆 */
  scope: string;
}

interface DangerDecision {
  command: string;
  decision: "approve" | "approve-with-change" | "reject";
  /** approve-with-change 时的安全写法；approve 时为空串 */
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
  /** 本轮方案组合 */
  portfolio: string;
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
  "每轮规划：上一轮审稿意见逐条处置——要么转成本轮任务卡，要么给出基于存档工件的反驳；不许空口忽略。",
  "新颖性处理：若文献读者报告该想法已被做过，不要终止——把范围重定界到该方向上尚未解决的缺口，重新选定方案，跑满全部轮次。",
  "诚实第一：数字必须可溯源到存档工件；不确定就说不确定；指令矛盾时如实升级提问。",
  "全程中文。",
].join("\n");

const ALGO_ZH = [
  "你是算法工程师：实现方案/复现竞品。端到端真实跑，每个数字注明口径（数据、窗口、单位、每个累加器含义）；与已有工作对比前先建口径对照表（各家原始约定/数据集/指标定义），主张数字优先用口径无关单位。",
  "竞品复现必须保真：与原文发表数字对照，偏差逐条记录——你不能既造自己的方法又给竞品打分。",
  "测试冻结规则：测试工程师验证期间，你不修改被测实现（否则测试对象在漂移，结论无效）。此时你只做两件事：准备可复现包（环境/命令/随机种子/数据窗口），响应门禁失败。测试报告返回后再按裁决修复。",
  "长任务安全（硬约束）：逐批次/逐场景用独立子进程运行，结果立即落盘后退出释放内存；脚本内置内存护栏（超约物理内存 70–80% 主动终止并保存现场）；每步有超时与失败出口；数据集与既有产物只读，不删除不覆盖；生成的代码视为不可信，可行时优先在容器/受限网络中执行（containment 是降险不是保证）。",
  "破坏性操作铁律：删除数据集/覆盖既有产物/git reset --hard/git clean -fdx/force push/改写已推送历史，一律只申报不执行——写入 dangerRequests（命令、原因、影响范围），等总工程师裁决后按其批准的写法执行。",
  "实验三级执行纪律：每个新实验先 MINI_PILOT（冒烟，验证代码能跑通与内存量级）→ PILOT（小数据核对正确性）→ FULL（正式协议的完整对比）。调试只看 PILOT 及以前；所有入档数字与主张只来自 FULL——禁止拿最小对比的结果冒充验证结论。在 DevReport.experiments 字段如实统计尝试数/跑通数（含死在调试阶段的）。",
  "如实报告失败；指令矛盾则升级提问，不造假不绕过。全程中文。",
].join("\n");

const TEST_ZH = [
  "你是测试工程师：代码审查、正确性 roundtrip（含对抗输入）、跨场景泛化、扰动稳定性。",
  "独立性铁律：只读被测实现，绝不修改它——你动手修，验证就变成自我服务、不再独立。你只写自检与映射表。",
  "你拥有 claim→evidence 映射表（docs/workflow/claim_map.md）：稿件每个数字 ↔ 存档工件 + 可重跑的检查命令；先写检查，再做主张。文件首行须含 claim-map 标记，正文用表格。",
  "你负责在仓库根目录建立/维护 selfcheck.py：必须含至少一个故意埋坏、必须 FAIL 的金丝雀用例（代码中带 canary 标记，供编排器检索核对）——不会变红的测试套件证明不了任何事。",
  "破坏性操作判据：超出申报裁决清单的——数据集或既有产物被删/被覆盖、历史被改写、force 痕迹——标为严重问题并索要总工裁决记录；实验产物正常迭代替换不属此列。",
  "长上下文纪律：diff 或审查面偏大时，先盘变更清单、再对高风险区（逻辑改动、门禁相关、涉危险操作处）深读；verdict 的 coverage 字段必须写明深审了哪些、只略读了哪些——它写在知道问题在哪之前，日后问题落在略读区将以此对账。",
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
  "你是通读本项目全部参考文献的资深读者：核对稿件引用与叙事是否与文献事实一致、查新最新论文、就文献覆盖提问；核实每个被引竞品实际做了什么，而非转述二手分类。",
  "每轮必答的新颖性核查：给出与该想法最相近的 3 篇已有工作（题名+出处+一句话说明各自做了什么），并判断本想法与它们的实质差异在哪个维度（问题设定/方法机制/结论范围）——这是评估报告创新性一栏的证据，不是终止信号。",
  "只读，不改任何文件。审稿须同时给出质询与下一轮迭代建议。全程中文。",
].join("\n");

const idea = String(args.idea ?? "");
const rounds = typeof args.rounds === "number" ? args.rounds : 3;
const focus = typeof args.focus === "string" ? args.focus : "";
const profile = typeof args.profile === "string" ? args.profile : "";
const PROFILE_LINE = profile ? "\n项目级约束（必须遵守，高于默认做法）：" + profile : "";

/** 模型分档：tiered = 强弱分档（本参考实现 GLM-5.3 / GLM-5.3-Flash）；uniform = 全随会话模型 */
const tiered = String(args.models ?? "tiered").toLowerCase() !== "uniform";
const STRONG = model("GLM-5.3");
const CHEAP = model("GLM-5.3-Flash");
const persona = (system: string, m: ModelRef): { system: string; model?: ModelRef } =>
  tiered ? { system, model: m } : { system };

artifact.table("rounds", {
  title: "验证轮次看板",
  columns: [
    { field: "round", label: "轮次" },
    { field: "task", label: "任务" },
    { field: "portfolio", label: "方案组合" },
    { field: "dev", label: "开发" },
    { field: "experiments", label: "实验死亡率" },
    { field: "test", label: "测试门禁" },
    { field: "review", label: "最严重审稿意见" },
    { field: "next", label: "下轮方向" },
  ],
  key: "round",
});

phase("总工程师调研立项");
const chief = agent("总工程师", persona(CHIEF_ZH + PROFILE_LINE, STRONG)); // 强模型档：分析与规划
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
  "约束：方案与竞品数量由你在 ≤3 内依据证据决定；第一轮结束前必须规划出至少一个完整（FULL 级）端到端对比的落地路径——最小对比不可作为验证。",
);
if (survey.paperRequests.length > 0) {
  log("求论文清单（非阻塞，供老板代取）：" + survey.paperRequests.join("；"));
}
const startRound = Math.max(1, Math.min(rounds + 1, Math.round(survey.resumeFrom) + 1));
if (startRound > 1) log("账本显示已完成 " + (startRound - 1) + " 轮，从第 " + startRound + " 轮续跑");

const algo = agent("算法工程师", persona(ALGO_ZH + PROFILE_LINE, CHEAP)); // 廉价模型档
const tester = agent("测试工程师", persona(TEST_ZH + PROFILE_LINE, CHEAP)); // 廉价模型档
const researcher = agent("研究员", persona(RESEARCHER_ZH + PROFILE_LINE, CHEAP)); // 廉价模型档
const editor = agent("编辑", persona(EDITOR_ZH + PROFILE_LINE, STRONG)); // 强模型档
const reader = agent("文献资深读者", persona(READER_ZH + PROFILE_LINE, STRONG)); // 强模型档

const rows: RoundRow[] = [];
let plan = "第 " + startRound + " 轮：按调研结论执行（方案：" + survey.proposals.join("、") + "；竞品：" + survey.competitors.join("、") + "）";

/** 破坏性操作：申报→强档总工裁决→按批准执行；返回裁决日志（入账本）。初始开发与修复/补充实验路径都走这里 */
async function dangerFlow(reqs: DangerRequest[]): Promise<string> {
  phase("危险操作审核");
  const raw = await chief.ask<DangerReview>(
    "破坏性操作审核（你是强模型档裁决者，此判断不下放给老板）。申报人：算法工程师（廉价档）。逐条裁决：" + JSON.stringify(reqs) +
    "。判断依据：影响范围能否精确界定、是否可逆、有无更窄更安全的等价写法（限定路径、先 dry-run、先备份、先列受影响清单）；默认 reject，能给安全写法用 approve-with-change 并写 safeForm，必要且安全才 approve。仅当实验在无该操作时根本无法继续，才在 reason 中如实写明「实验受阻」，交由《初步评估报告》呈现（研究循环无打断机制）。返回 DangerReview（decisions 与请求逐条对应）。",
  );
  let decisions = raw.decisions ?? [];
  if (decisions.length !== reqs.length) {
    log("危险操作裁决不完整（" + decisions.length + "/" + reqs.length + " 条）——整体按驳回处理，如实记录");
    decisions = reqs.map((r) => ({ command: r.command, decision: "reject" as const, safeForm: "", reason: "裁决不完整，整体驳回以保安全" }));
  }
  let entry = decisions.map((d) => d.command + "→" + d.decision + (d.safeForm ? "（改：" + d.safeForm + "）" : "") + "：" + d.reason).join("；");
  const ok = decisions.filter((d) => d.decision !== "reject");
  if (ok.length > 0) {
    phase("执行已批准的危险操作");
    const execReport = await algo.ask<string>(
      "执行总工程师已批准的危险操作，严格按批准写法（safeForm 非空时用 safeForm），不得扩大范围：" + ok.map((d, i) => (i + 1) + ". " + (d.safeForm || d.command)).join("；") + "。完成后 git add -A && git commit，返回一句话（须列明实际执行的命令）。",
    );
    for (const d of ok) {
      const form = d.safeForm || d.command;
      if (!execReport.includes(form)) log("危险操作执行确认缺失：" + d.command + "——如实记录，账本将标注未确认");
    }
    entry += "；执行确认：" + (ok.every((d) => execReport.includes(d.safeForm || d.command)) ? "全部与批准写法一致" : "存在未确认项（见日志）");
  } else {
    log("危险操作全部驳回：不得绕过，另寻安全路径");
  }
  return entry;
}

for (let round = startRound; round <= rounds; round++) {
  let dangerLog = "无"; // 本轮危险操作裁决（入账本）
  phase("布置本轮任务卡");
  let cards = await chief.ask<WorkCards>(
    "第 " + round + "/" + rounds + " 轮。idea：" + idea + "\n" +
  (round === 1 ? "调研结论：" + survey.summary : "上一轮审稿意见与你的规划：" + plan) + "\n" +
  "注意：方案 Portfolio 每轮由你重新选定（可新增/移除/替换，≤3 且 ≥1）；本轮选中的每个方案都要充分验证；proposals 字段列出本轮选定的 1–3 个方案名。\n" +
  "把本轮工作转成任务卡（复现竞品 X / 尝试方案 Y…）。老板关注：" + (focus || "无"),
  );
  if (cards.proposals.length < 1 || cards.proposals.length > 3) {
    cards = await chief.ask<WorkCards>(
      "proposals 必须为 1–3 个方案名（当前 " + cards.proposals.length + " 个）。请重新返回 WorkCards。",
    );
  }
  if (cards.proposals.length < 1 || cards.proposals.length > 3) {
    log("第 " + round + " 轮方案组合仍不合规（" + cards.proposals.length + " 个），如实记录并继续");
  }
  log("第 " + round + " 轮任务：" + cards.title + "；方案组合：" + cards.proposals.join("、"));

  phase("算法工程师开发自测");
  let dev = await algo.ask<DevReport>(
    "本轮任务卡：" + cards.cards.join("；") + "\n" +
    "开发并自测。纪律：端到端真实跑、数字注明口径、竞品保真对照；本轮选中的每个方案都必须得到充分验证（三级执行：MINI_PILOT/PILOT 只用于调试，主张只来自 FULL）；第 1 轮结束时必须已有至少一个来自完整对比的端到端数字。与已有工作对比前先建口径对照表（每家原始约定/数据集/指标定义）；表示或预处理假设先用标准工具做零成本锚点实验再决定是否建全量；每轮至少做一个边界实验（方法何时失效、参数多敏感），主张注明证据范围（数据集与条件）。如实报告 experiments（尝试数/跑通数），零结果入档并解释机制。",
  );
  if (round === 1 && dev.numbers.length === 0) {
    dev = await algo.ask<DevReport>(
      "第 1 轮必须以至少一个来自完整对比（FULL 级）的端到端数字收尾，禁止以最小对比代替。请现在补跑并返回 DevReport（numbers 填入该数字与口径）；若客观上无法做到，如实说明并保持 numbers 为空。",
    );
    if (dev.numbers.length === 0) log("第 1 轮无端到端数字（补救后仍缺）——已如实记录，稿件不得声称已验证");
  }
  // 破坏性操作：廉价档只申报，强档总工裁决执行/改写法/跳过（不下放给老板）
  if ((dev.dangerRequests || []).length > 0) {
    dangerLog = await dangerFlow(dev.dangerRequests);
  }

  phase("测试工程师审查测试");
  const verdict = await tester.ask<TestVerdict>(
    "审查开发产出：" + JSON.stringify(dev) + "\n" +
    "职责：代码审查/roundtrip（含对抗输入）/泛化/扰动稳定性；更新 claim→evidence 映射表（docs/workflow/claim_map.md）；" +
    "建立或更新仓库根目录 selfcheck.py，必须含必须失败的金丝雀用例。对进入主张或 go/no-go 决策、且经多步聚合的头条数字，从存档中间记录用第二条路径复算（不同分组或公式——不要求第二套实现）；实验须存档足以让复算在分钟级完成的中间记录。不一致即冻结该数字并审计，绝不当作舍入误差放行。单一来源的直接测量免检（roundtrip 与 canary 已覆盖）。发现数字被撤回时，全库检索所有重复该数字的文档（账本历史、README、图表）并列出当轮修正清单。返回 TestVerdict。",
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
  let canary = false;
  try {
    canary = (await files.grep("canary", "selfcheck.py")).length > 0;
  } catch {
    canary = false;
  }
  if (!canary) log("门禁缺少 canary 标记（自检须含必须失败的对照用例）");
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
      output = (r.stderr || r.stdout || "(无输出)").slice(0, 1500);
    } catch {
      if (!interpIsPy3) {
        interpIsPy3 = true;
        try {
          const r = await world.run("python3", ["selfcheck.py"], { timeoutMs: 3600000 });
          exitCode = r.exitCode;
          output = (r.stderr || r.stdout || "(无输出)").slice(0, 1500);
        } catch {
          launchErr = "python 与 python3 均无法启动（请确认解释器可用）";
        }
      } else {
        launchErr = "selfcheck.py 启动失败或超时";
      }
    }
    if (launchErr === "" && exitCode === 0 && canary && claimMapOk) {
      gate = "通过（第 " + attempt + " 次尝试" + (interpIsPy3 ? "，python3" : "") + "）";
      break;
    }
    if (attempt === 3) {
      gate = launchErr !== ""
        ? launchErr
        : (claimMapOk ? "" : "映射表未建立；") + (canary ? "3 次修复后仍失败" : "门禁未就绪（自检缺少 canary 对照用例）");
      break;
    }
    try {
      canary = (await files.grep("canary", "selfcheck.py")).length > 0;
    } catch {
      canary = false;
    }
    const reason = launchErr !== ""
      ? launchErr
      : "exit " + exitCode + (canary ? "" : "，且缺少 canary 对照用例") + (claimMapOk ? "" : "，且映射表未建立");
    const triage = await tester.ask<string>(
      "门禁未通过（" + reason + "）。你是 selfcheck.py 与映射表的所有者：若问题在测试基建（脚本/用例/映射表），直接修复；若问题在被测实现，返回给算法工程师的明确修复指令清单（勿改被测实现）；若无法判断，如实说明。输出摘要：\n" + output,
    );
    const t = triage.trim();
    if (t !== "" && t !== "无") {
      const triageDev = await algo.ask<DevReport>(
        "测试工程师裁决的修复指令（你不许改 selfcheck.py 与 claim_map.md）：\n" + t.slice(0, 2000) + "\n执行后返回 DevReport。",
      );
      if ((triageDev.dangerRequests || []).length > 0) {
        dangerLog = (dangerLog === "无" ? "" : dangerLog + "；") + await dangerFlow(triageDev.dangerRequests);
      }
    }
  }

  phase("修复与补充实验");
  let fixDev: DevReport = dev;
  const fixes = await chief.ask<string[]>(
    "测试结论：" + JSON.stringify(verdict) + "\n门禁：" + gate + "\n把测试问题转成修复/补充实验指令（可为空数组=无需修复）。",
  );
  if (fixes.length > 0) {
    fixDev = await algo.ask<DevReport>("执行修复与补充实验：" + fixes.join("；") + "\n返回 DevReport。");
    if ((fixDev.dangerRequests || []).length > 0) {
      dangerLog = (dangerLog === "无" ? "" : dangerLog + "；") + await dangerFlow(fixDev.dangerRequests);
    }
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
      agent("审稿人-r" + round + "-" + (i + 1), tiered ? { model: STRONG } : undefined).ask<Review>(
        invite.brief + "\n\n你是相邻领域（与本研究方向相关但不重叠）的独立审稿人，只读：对稿件与证据映射提出尖锐质询（附证据出处），并给出下一轮迭代建议，给 severity。如无法判断，如实说明。",
      ),
    ),
  );
  const readerRev = await reader.ask<Review>(
    "通读文献后审稿（只读）。稿件摘要：" + paper.slice(0, 500) + "\n核对引用与叙事、查新、提问，并给出迭代建议；nearestWorks 必填：最相近的 3 篇工作与差异维度。",
  );
  const reviews: Review[] = settled.map((s) =>
    s.status === "fulfilled" ? s.value : { summary: "该审稿人未完成", issues: [], iteration: [], severity: "minor" },
  );
  reviews.push(readerRev);
  const digest = reviews
    .map((r, i) => "【" + (i < n ? "审稿人" + (i + 1) : "文献读者") + "｜" + r.severity + "】" + r.summary +
      "\n- 质询：" + (r.issues.join("；") || "无") + "\n- 迭代建议：" + (r.iteration.join("；") || "无") +
      (r.nearestWorks && r.nearestWorks.length > 0 ? "\n- 最相近工作：" + r.nearestWorks.join("；") : ""))
    .join("\n\n");

  phase("本轮存档");
  let head0 = "";
  try {
    const l0 = await git.log(1);
    head0 = l0[0]?.hash ?? "";
  } catch {
    head0 = "";
  }
  const archived = await chief.ask<string>(
    "把本轮（任务/产出/危险操作裁决（" + dangerLog + "）/测试（覆盖声明：" + (verdict.coverage || "").slice(0, 300) + "）/审稿/下轮方向）追加到 docs/workflow/ledger.md，然后 git add -A && git commit。若已配置本地加密备份 remote（建议用 GitCoffer 构建，防 Agent 误删本地代码后无从恢复），同时 push 到该 remote；不主动 push 到任何其它 remote（向云端发布永远是老板的明确动作）。返回一句话。",
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
      "本轮提交未落盘（HEAD 未变化）。请立即 git add -A && git commit（有本地加密备份 remote 则同推），返回提交哈希。",
    );
  }
  log("第 " + round + " 轮存档" + (commitOk ? "已核验（HEAD=" + head1.slice(0, 7) + "）" : "补救后仍需人工核查"));

  const worst = reviews.reduce((a, b) => (({ minor: 1, major: 2, blocker: 3 } as Record<string, number>)[b.severity] >
    ({ minor: 1, major: 2, blocker: 3 } as Record<string, number>)[a.severity] ? b : a));
  const nextDirection = reviews.flatMap((r) => r.iteration).slice(0, 3).join("；");
  rows.push({
    round,
    task: cards.title,
    portfolio: cards.proposals.join("、"),
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
  "撰写《初步评估报告》：verdict（继续/转向/停止）、预期成功率（推理依据必须引用实验死亡率趋势与文献读者的新颖性核查结论；并明确标注『这是定性判断的数值化表达，非校准概率』）、创新性（引用最相近 3 篇工作与实质差异维度）、影响力、继续做要注意的点（每条注明对应主张的证据范围——数据集与条件）、" +
  "reviewerQuotes（逐字引用每位审稿人结论，不得改写）、给老板的建议（含仅老板能做的决策清单：账号、数据、资源类）。写入 docs/workflow/evaluation_report.md。",
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
await artifact.markdown("report", md, { title: "初步评估报告", description: rounds + " 轮硬停后的 go/no-go 评估", primary: true });

return {
  conclusion: evalResult.advice,
  verdict: evalResult.verdict,
  rounds_completed: rows.length,
  paper_requests: survey.paperRequests,
  next_action: "等待老板决策：再次运行本工作流并传 focus 参数反馈（继续/转向/停止）",
};
