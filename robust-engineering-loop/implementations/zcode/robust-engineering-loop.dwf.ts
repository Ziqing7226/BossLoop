/* zcode-workflow
description: 鲁棒工程循环（v0.3.1）：把一句开发要求变成经过冷启动对抗验证的实现。总工建要求台账（老板原话逐字）并承诺 N 轮（老板可锁定）；每轮开发+文档单笔提交 → 冷启动门禁（diff 审查、鲁棒性测试、canary、零警告构建、上一轮 remote CI 结转）→ 先复现再返修（误诊须证据反驳）、amend 并入本轮提交（初级 3 次未解升级高级工程师，10 次未过打断上报）；全绿才推送约定 remote（默认 GitCoffer，append-only 永不 force）；账本断点续跑；破坏性操作申报-裁决-执行三段核验、绝不转交用户；模型分档 tiered/uniform。
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
  models:
    type: string
    default: "tiered"
    description: 模型分档；tiered = 总工/高级工程师用强模型、算法/测试用廉价模型（本参考实现为 GLM-5.3 与 GLM-5.3-Flash），uniform = 全部随会话模型
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
  /** 本轮需要执行的破坏性操作（删除/覆盖/改写历史等）：只申报，绝不自行执行；没有则空数组 */
  dangerRequests: DangerRequest[];
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
  /** 覆盖与验证声明：深审/略读区域 + 每个结论的验证手段（先于判定写出，供日后对账） */
  coverage: string;
}

interface FixOutcome {
  /** 一句话：返修情况 */
  summary: string;
  /** 确认属实并已修复（amend 并入本轮提交）的问题编号 */
  fixed: string[];
  /** 判为误诊并反驳的问题：编号 + 证据（命令输出/规格引用） */
  rebutted: { id: string; evidence: string }[];
  /** 返修中需要执行的破坏性操作：只申报，不执行；没有则空数组 */
  dangerRequests: DangerRequest[];
}

interface DangerRequest {
  /** 拟执行的破坏性命令原文 */
  command: string;
  /** 为什么必须这么做 */
  reason: string;
  /** 影响范围：将删除/覆盖哪些路径、哪些数据、是否可逆 */
  scope: string;
}

interface DangerDecision {
  command: string;
  decision: "approve" | "approve-with-change" | "reject";
  /** approve-with-change 时的安全写法（更窄路径、dry-run 先行、先备份、先列清单）；approve 时为空串 */
  safeForm: string;
  /** 裁决理由 */
  reason: string;
}

interface DangerReview {
  /** 一句话结论 */
  summary: string;
  /** 逐条裁决，与请求一一对应 */
  decisions: DangerDecision[];
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
  /** 延后事项：记录在案的延后是决策而非遗漏 */
  deferred?: { item: string; reason: string }[];
  /** 否决事项：带理由，防止下轮重新提案 */
  declined?: { item: string; reason: string }[];
  /** 流程教训：本轮循环自身如何失败或险些失败，提炼为检查单条目 */
  processLessons?: string[];
  /** 给老板的一句建议 */
  advice: string;
}

const CHIEF_ZH = [
  "你是总工程师。使命：把老板（用户）的开发要求在承诺的有限轮数内变成高质量交付——每一轮都必须经过冷启动验证、全绿门禁、零警告编译，才允许推送。",
  "老板要求保真是最高纪律：第 1 轮开工前建 docs/workflow/requirements.md——老板原话逐字、内涵解释、验收标准，一条不落；执行中不得与老板要求相悖，不得不偏离时必须在《最终汇报》中逐条说明原因与替代选择，绝不悄悄违背。",
  "打断策略：重大问题（要求不可行、会改变范围的歧义、需要加轮、门禁复核 10 次仍未过）→ 立即打断循环并写 docs/workflow/interrupt_report.md 向老板说明；破坏性操作本身不是打断事由——按危险操作条款裁决（初级申报→高级工程师；升级阶段高级工程师申报→你），仅当裁决后本轮仍完全无法推进才打断上报；小问题（范围内的实现细节、工具选择、顺序调整）→ 你自行决断并在账本记录。范围、进度、质量标准、预算这类老板级取舍不许被你降级成小问题。",
  "轮次规划：第 1 轮前承诺总轮数 N 与每轮一句话范围（老板用 rounds 参数锁定时以老板为准，不得增减）；每轮开始依据账本重新安排本轮任务卡——上一轮判决、问题与反驳、remote CI 结转、遗留事项都要处置；每张任务卡必须可追溯到要求条目（R1/R2…）；当上一轮的修复被后续验证否证时，本轮任务卡以\"回退还是继续修\"的显式决策开头，证据优先——绝不叠加在被否证的修复上。",
  "误诊仲裁：算法工程师与测试工程师就某条问题争执时，你只依据证据仲裁；仍不能定 → 重大问题，打断上报老板。",
  "接手先读账本（docs/workflow/ledger.md）：断点续跑，不重做已完成轮；账本同时记录每轮 baseline 哈希与已推送 SHA；被中断或取消的片段恢复时先做闭合复查——丢弃范围内的每项在途工作要么核实仍在、要么在账本记明放弃，先和解再前进，绝不静默跳过。",
  "诚实第一：汇报只引用命令输出与退出码；说不知道；矛盾上报而不是绕过。",
].join("\n");

const ALGO_ZH = [
  "你是算法工程师：实现本轮任务卡；每轮只做一笔本地提交（本轮提交），提交信息一句话概括本轮。文档即交付物：专业、美观、简洁——同一信息只在一处维护，杜绝冗余与重复；代码改动必须随附文档改动，纳入同一笔提交。",
  "测试工程师验证期间工作树冻结：不修改被测实现。",
  "返修纪律：拿到问题清单先逐条复现——确认属实的修复；复现不了或与事实不符的以证据反驳（命令输出、规格引用），绝不盲目\"修复\"不存在的问题——瞎改代码不是进度。",
  "修复一律 git add -A && git commit --amend --no-edit 并入本轮提交：绝不改写已推送历史，绝不 amend baseline 之下的提交。",
  "你的开发报告（含每张卡的要求覆盖）只交给总工程师做规划；测试工程师永远看不到它——冷启动是设计使能，不是疏漏。",
  "把失败当失败报告；矛盾上报。绝不造假、绝不绕过门禁、绝不 force 推送。",
  "你运行在廉价模型档，定位是初级工程师：同一问题 3 次迭代仍未解决时不要硬磕——整理最小复现与根因假设，交由高级工程师（强模型）接手。",
  "修复纪律三则：层归因先于修复——动手前用能判别的证据钉住缺陷所在层/组件，不做「以防万一」的跨层修复，无法归因就如实上报；诊断必须可证伪——指名能推翻它的实验，不可证伪的解释只是猜测，不能作为改动依据，失败现场的直接观察优先于理论；参照锚定——存在参考实现（上游/先行实现）时先对照其行为层再下结论，偏离参考要么在账本说明理由要么对齐。",
  "破坏性操作铁律：rm -rf / 删除目录或数据文件 / git reset --hard / git clean -fdx / force push / 改写已推送历史 / 覆盖他人产物，一律只申报不执行——写入 dangerRequests（命令原文、原因、影响范围），等高级工程师裁决后按其批准的写法执行。",
].join("\n");

const SENIOR_ZH = [
  "你是高级工程师（升级通道，强模型档）：初级算法工程师同一问题 3 次迭代未能解决时，该问题升级到你手上。先读门禁输出与账本定位根因，一次修对而不是绕症状；修复同样 amend 并入本轮提交，遵守算法工程师的全部纪律。",
  "你同时是破坏性操作的裁决者之一：裁决初级工程师申报的删除/覆盖/改写历史操作——能否精确界定影响范围、是否可逆、有无更窄更安全的等价写法（限定路径、dry-run 先行、先备份、先列受影响清单）；默认拒绝，能给安全写法就用 approve-with-change 并写明 safeForm，必要且安全才 approve（升级阶段你自己申报的操作由总工裁决，你不能裁决自己的申报）。",
  "这个裁决不下放给老板：只有整轮任务在无该操作时根本无法继续（必须重建索引、必须清掉损坏产物）才建议总工走打断流程；日常删除绝不去打扰用户。若确属阻塞性问题（要求矛盾、环境不可用），如实说明并建议打断上报。",
].join("\n");

const TEST_ZH = [
  "你是测试工程师，冷启动上岗：你只依据 diff（baseline..HEAD）与代码库本身工作，绝不依赖作者的自述；没有人会给你开发报告，作者叙述会锚定验证者，这是设计使能。",
  "diff 审查：看实际改了什么，而不是声称改了什么；新代码、被改动的行为、文档与实现是否一致；文档质量（专业、美观、简洁、无冗余重复）不合格同样算问题；用户可见声明一并审计——diff 引入的每条面向用户的主张（README、文档、发布说明）都映射到机制或可重跑检查，每个数字有唯一出处。",
  "编写并维护鲁棒性测试：边界与对抗输入、适用的扰动场景；并在仓库根创建/维护 selfcheck.py，按项目 profile 聚合三件事——严格模式构建（警告即错误：-Werror / /WX / -D warnings / deny(warnings) 等按语言取）、全量测试+鲁棒性用例、本地 CI 等价执行（仓库配了 CI 就必须本地等价跑通）；套件不只演练还要证伪——diff 新增的每个机制都配一条负向检查（篡改输入必须失败、注入必须被拒），\"已验证\"指证伪尝试失败过，而非快乐路径通过。",
  "selfcheck.py 必须含一个必须失败的金丝雀用例并带 canary 标记（编排器按标记搜索核验）——不会变红的测试套件证明不了任何事。",
  "核查上一轮推送在 remote 上的 CI：GitHub remote 且 gh 可用时用 gh run list / gh run view；不可核查则如实写\"无法核查\"，绝不默认通过；失败项列入本轮必修。",
  "独立性绝对：绝不修改被测实现。你只写 selfcheck.py、鲁棒性用例，以及 docs/workflow/requirement_map.md（要求↔实现位置↔可重跑验证命令，表格式并带 requirement-map 标记）的验证列。",
  "破坏性操作判据（与申报义务对齐）：超出批准清单的——数据文件或整目录消失、baseline 之下的历史被改写、force push、既有产物被覆盖——标 blocker 并索要申报与裁决记录；正常重构中的源文件删除不属破坏性操作，但须在提交信息或文档中可追溯；对第三方仓库的 clone，上游只读——推送仍只去约定 remote、绝不 push 上游，收尾前以 git 输出核实上游 refs 原样。",
  "产物新鲜度与参照锚定：核验所用产物必须由 HEAD 构建——构建布局可暴露产物时核对源文件与产物新旧（selfcheck.py 可内置该检查），陈旧二进制上的绿灯一律作废；存在参考实现（上游/先行实现）时，对可疑行为先对照其行为层核查，无理由的偏离即问题；每条问题标注所属层/组件及判别证据。",
  "验证命令一律在钉定环境运行：输出 locale 固定（本地化工具以固定 locale 重跑）、系统级配置隔离（凭据助手与全局 git 配置绕过而非信任）、场景间凭据状态复位、临时目录不假定持久；每个结论的验证手段分层声明按每次 verdict 的 coverage 要求执行。",
  "每条问题附复现证据（命令+输出）；修复后必须复跑原始失败检查确认关闭；对工程师的反驳只依据证据仲裁；构建系统都跑不起来、要求自相矛盾这类问题如实标 blocker。",
].join("\n");

const requirement = String(args.requirement ?? "");
const roundsArg = typeof args.rounds === "number" ? args.rounds : 0;
const remoteArg = typeof args.remote === "string" && args.remote !== "" ? args.remote : "gitcoffer";
const profile = typeof args.profile === "string" ? args.profile : "";
const focus = typeof args.focus === "string" ? args.focus : "";
const PROFILE_LINE = profile ? "\n项目约束（强制，覆盖默认）：" + profile : "";

/** 模型分档：tiered = 强弱分档（本参考实现 GLM-5.3 / GLM-5.3-Flash）；uniform = 全随会话模型 */
const tiered = String(args.models ?? "tiered").toLowerCase() !== "uniform";
const STRONG = model("GLM-5.3");
const CHEAP = model("GLM-5.3-Flash");
const persona = (system: string, m: ModelRef): { system: string; model?: ModelRef } =>
  tiered ? { system, model: m } : { system };

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

const CHIEF_BLOCK_NOTE = "\n（若为重大问题，填 blocked 并停止发卡：写 docs/workflow/interrupt_report.md——以解释开头（发生了什么、为什么），再列已完成轮次与产物、需要老板决策的点、建议选项与各自代价——然后本地提交。）";

artifact.table("rounds", {
  title: "工程开发轮次",
  columns: [
    { field: "round", label: "轮次" },
    { field: "task", label: "任务" },
    { field: "dev", label: "开发" },
    { field: "test", label: "冷启动门禁" },
    { field: "findings", label: "问题/反驳/升级" },
    { field: "push", label: "推送" },
    { field: "next", label: "下一步" },
  ],
  key: "round",
});

phase("总工：要求入账与总体规划");
const chief = agent("总工程师", persona(CHIEF_ZH + PROFILE_LINE, STRONG)); // 强模型档：分析与规划
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
  (ledger ? "已有账本（头部目录+末尾详情，续跑依据）：\n" + (ledger.length > 6000 ? ledger.slice(0, 1600) + "\n……（中间省略）……\n" + ledger.slice(-3200) : ledger) + "\n若显示本要求已完成 N 轮，resumeFrom = N（从第 N+1 轮续跑，不重做）；否则 0。\n" : "无账本：resumeFrom = 0。\n") +
  "第 1 轮开工前完成三件事：1) 建 docs/workflow/requirements.md 要求台账——文件头一行权威分工（requirements.md=要求正本、requirement_map.md=验证正本、ledger.md=历史正本）；老板原话逐字编号（R1/R2…）+ 内涵解释 + 验收标准，一条不落；若存在会改变范围的歧义，先在 blocked.question 里向老板提出（这是唯一的开工前提问）；2) 承诺总轮数 roundsTotal 与每轮一句话范围 roundsOutline" +
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

const algo = agent("算法工程师", persona(ALGO_ZH + PROFILE_LINE, CHEAP)); // 廉价模型档：初级工程师
const senior = agent("高级工程师", persona(ALGO_ZH + SENIOR_ZH + PROFILE_LINE, STRONG)); // 强模型档：升级通道 + 破坏性操作裁决

/** 破坏性操作审核：执行者只申报，由独立的强模型档裁决（初级申报→高级工程师；升级阶段高级工程师申报→总工）——裁决者非申报者本人，且绝不转交老板 */
async function adjudicateDanger(reqs: DangerRequest[], requester: string, requesterTier: string, byChief: boolean): Promise<DangerReview> {
  const askText =
    "破坏性操作审核。申报人：" + requester + "（" + requesterTier + "）。逐条裁决以下请求：\n" + JSON.stringify(reqs) +
    "\n判断依据：影响范围能否精确界定、是否可逆、有无更窄更安全的等价写法（限定路径、dry-run 先行、先备份、先列出受影响清单）。默认 reject；能给安全写法时用 approve-with-change 并在 safeForm 写明；必要且安全才 approve。" +
    "绝不把判断交回用户：仅当整轮任务在无该操作时根本无法继续，才在 reason 中写明并建议打断。返回 DangerReview（decisions 与请求逐条对应）。";
  const raw = byChief
    ? await chief.ask<DangerReview>(askText)
    : await senior.ask<DangerReview>(askText);
  let decisions = raw.decisions ?? [];
  if (decisions.length !== reqs.length) {
    log("危险操作裁决不完整（" + decisions.length + "/" + reqs.length + " 条）——整体按驳回处理，如实记录");
    decisions = reqs.map((r) => ({ command: r.command, decision: "reject" as const, safeForm: "", reason: "裁决不完整，整体驳回以保安全" }));
  }
  return { summary: raw.summary, decisions };
}

/** 让执行者严格照批准写法执行，并 amend 并入本轮提交 */
function dangerExecAsk(approved: DangerDecision[]): string {
  return "执行已批准的危险操作，严格按批准写法（safeForm 非空时用 safeForm），不得扩大范围、不得新增未批准的命令：\n" +
    approved.map((d, i) => (i + 1) + ". " + (d.safeForm || d.command) + "（批准理由：" + d.reason + "）").join("\n") +
    "\n完成后 git add -A && git commit --amend --no-edit 并入本轮提交（本轮尚无提交则直接 commit），返回一句话。";
}
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
    dev = await algo.ask<DevReport>("本轮提交未落地（HEAD 未前进）。现在执行 git add -A && git commit 并返回 DevReport。");
    headA = await HEAD0();
  }
  const commitOk = headA !== "" && headA !== baseline;
  log("第 " + round + " 轮提交 " + (commitOk ? "已落地（" + headA.slice(0, 7) + "，baseline " + (baseline || "空树").slice(0, 7) + "）" : "仍未落地——如实记录，测试将面对未提交改动"));

  // 破坏性操作：初级工程师只申报不执行，由强模型档裁决执行 / 改写法 / 跳过（不下放给老板）
  let dangerLog = "无";
  let approvedDanger: string[] = [];
  const dangerTrail: { declared: string; ruled: string; executed: string }[] = []; // 一致性核查凭据：申报→裁决→执行三段必须对得上
  if ((dev.dangerRequests || []).length > 0) {
    phase("危险操作审核");
    const review = await adjudicateDanger(dev.dangerRequests, "算法工程师", "廉价模型档", false);
    dangerLog = review.decisions.map((d) => d.command + " → " + d.decision + (d.safeForm ? "（改：" + d.safeForm + "）" : "") + "：" + d.reason).join("；");
    log("第 " + round + " 轮危险操作裁决：" + dangerLog.slice(0, 300));
    const ok = review.decisions.filter((d) => d.decision !== "reject");
    approvedDanger = ok.map((d) => d.safeForm || d.command);
    for (const d of ok) dangerTrail.push({ declared: d.command, ruled: d.decision + (d.safeForm ? "|" + d.safeForm : ""), executed: "待执行确认" });
    if (ok.length > 0) {
      phase("执行已批准的危险操作");
      const execReport = await algo.ask<string>(dangerExecAsk(ok));
      for (const e of dangerTrail) {
        if (e.executed !== "待执行确认") continue;
        const form = e.ruled.split("|")[1] || e.declared;
        e.executed = execReport.includes(form) ? form : "未确认：执行回报未含批准写法";
        if (!execReport.includes(form)) log("危险操作执行确认缺失：" + e.declared + "——如实记录并计入门禁");
      }
      headA = await HEAD0();
    } else {
      log("危险操作全部驳回：不执行，不得绕过");
    }
  }

  phase("测试工程师冷启动门禁");
  const tester = agent("测试工程师-R" + round, persona(TEST_ZH + PROFILE_LINE, CHEAP)); // 每轮全新实例：冷启动；廉价模型档
  const diffHint = baseline ? "git diff " + baseline + "..HEAD" : "git show HEAD（整仓首提交）";
  // 覆盖声明辅助：编排器只统计并转告 diff 体量，不设阈值红线；深读/略读的取舍由测试员在 verdict 中声明并对账
  let diffLines = -1;
  if (baseline) {
    try {
      const df = await world.run("git", ["diff", "--numstat", baseline + "..HEAD"], { timeoutMs: 120000 });
      diffLines = (df.stdout || "").split("\n").reduce((a, l) => { const p2 = l.trim().split("\t"); return a + (Number(p2[0]) || 0) + (Number(p2[1]) || 0); }, 0);
    } catch {
      diffLines = -1;
    }
  }
  const sizeNote = diffLines < 0 ? "（diff 体量未知：numstat 不可用，请自行评估）" : "（本轮 diff 体量约 " + diffLines + " 行" + (diffLines > 800 ? "，偏大：请先盘变更清单、再对高风险区深读" : "") + "）";
  let verdict: TestVerdict = { summary: "未开始", passed: false, findings: [] , coverage: "未开始：尚未评审" };
  let gate = "";
  let canary = false;
  let mapOk = false;
  let findingsCount = 0;
  let rebuttedCount = 0;
  let escalations = 0; // 升级到高级工程师（强模型档）的返修次数
  let interpIsPy3 = false;
  let lastFix: FixOutcome | null = null;

  for (let attempt = 1; attempt <= 10; attempt++) {
    verdict = await tester.ask<TestVerdict>(
      (attempt === 1
        ? "冷启动上岗。baseline 提交：" + (baseline || "（空树，本仓库首提交）") + "。本轮 diff 体量：" + sizeNote + "。审查 " + diffHint + " 与代码库本身：diff 审查、鲁棒性测试、selfcheck.py（严格构建/全量测试+鲁棒性/本地 CI 等价 + canary 标记）、更新 docs/workflow/requirement_map.md 验证列；这些测试设施的改动 git add -A && git commit --amend --no-edit 并入本轮提交（测试套件属于本轮交付）。"
        : (lastFix
            ? "算法工程师已返修（amend 并入本轮提交），其返修申报（只作对账线索，结论仍以你重跑的检查为准）：" + JSON.stringify(lastFix) + "\n"
            : "上一轮未过的机械项（selfcheck.py/requirement_map.md）已发回你补齐，工程侧无返修。\n") +
      "逐条复检：修复项重跑原始失败检查确认关闭；反驳项只依据证据仲裁——反驳成立则撤回问题，不成立则保留并说明。") +
      (cards.remoteCiIssues.length > 0 ? "\n另：上一轮 remote CI 必修项已由算法工程师处理：" + cards.remoteCiIssues.join("; ") : "") +
      (approvedDanger.length > 0
        ? "\n本轮经裁决批准的危险操作，只允许这些写法：" + approvedDanger.join("；")
        : "\n本轮未批准任何破坏性操作：diff 或历史中若出现数据/整目录消失、baseline 之下历史被改写、force、既有产物被覆盖，即为未授权破坏性操作，标 blocker（正常重构的源文件删除除外）。") +
      "返回 TestVerdict（问题必须有复现证据）。verdict 中必须附覆盖声明 coverage：深审了哪些文件/区域（逻辑改动、门禁相关、涉危险操作处）、只略读了哪些，且每个结论写明验证手段（真实设备/介质实测、CI 运行、或无设备时的专项冷启动审查替代——替代审查如实写明，绝不写成实测）——它写在知道问题在哪之前，日后任何问题落在略读区或替代验证上将直接以此对账。",
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
    // 机械核查：每条已批准的危险操作必须申报、有裁决、按批准写法执行（三段对得上才算过）
    const dangerConsistent = dangerTrail.every((e) => e.executed !== "待执行确认" && !e.executed.startsWith("未确认") && approvedDanger.includes(e.executed));
    if (verdict.passed && exitCode === 0 && canary && mapOk && dangerConsistent) {
      gate = "pass（第 " + attempt + " 次尝试" + (interpIsPy3 ? "，python3" : "") + "）";
      break;
    }
    if (attempt === 10) {
      gate = (verdict.passed ? "" : "测试未过；") + (canary ? "" : "缺 canary；") + (mapOk ? "" : "要求映射表缺失；") + (dangerConsistent ? "" : "危险操作申报-裁决-执行不一致；") + (exitCode === 0 ? "" : "selfcheck exit " + exitCode);
      break;
    }
    if (verdict.findings.length === 0) {
      // 纯机械项失败（无问题清单）：selfcheck.py 与映射表是测试工程师的设施，发回其所有者补齐——不占工程师生级通道
      lastFix = null;
      await tester.ask<string>(
        "机械门禁未达标（canary=" + (canary ? "有" : "无") + "；requirement_map=" + (mapOk ? "有效" : "缺失") + "；selfcheck exit=" + (canary ? exitCode : "未运行") + "），而你的 verdict 没有问题清单。selfcheck.py 与 requirement_map.md 归你所有：补齐或修复它们，改动 git add -A && git commit --amend --no-edit 并入本轮提交；若 selfcheck 暴露的是实现缺陷，在下一次 verdict 中作为问题提出（附复现证据）。返回一句话。",
      );
      headA = await HEAD0();
      continue;
    }
    const juniorAsk = attempt <= 3; // 初级 3 次迭代未解决 → 升级高级工程师（强模型档）
    if (!juniorAsk) escalations++;
    const fixer = juniorAsk ? algo : senior;
    const fix = await fixer.ask<FixOutcome>(
      (juniorAsk ? "" : "【升级】初级工程师已 3 次迭代未解决以下问题。你是高级工程师（强模型档）：先定位根因，一次修对，同样 amend 并入本轮提交。\n") +
      "第 " + attempt + " 次门禁未过：" + (verdict.passed ? "（自检通过但 selfcheck/映射表未达标）" : JSON.stringify(verdict.findings)) +
      "\n机械状态：canary=" + (canary ? "有" : "无") + "；requirement_map=" + (mapOk ? "有效" : "缺失") + "；危险操作三段一致=" + (dangerConsistent ? "是" : "否") + "；selfcheck exit=" + (canary ? exitCode : "未运行") +
      "\n输出摘录：\n" + output +
      "\n先逐条复现：确认→修复；误诊→证据反驳（FixOutcome.rebutted）。然后 git add -A && git commit --amend --no-edit 并入本轮提交。绝不改写 baseline 之下的历史。",
    );
    lastFix = fix;
    if ((fix.dangerRequests || []).length > 0) {
      phase("危险操作审核");
      const dr = await adjudicateDanger(fix.dangerRequests, juniorAsk ? "算法工程师" : "高级工程师", juniorAsk ? "廉价模型档" : "强模型档", !juniorAsk);
      const ok2 = dr.decisions.filter((d) => d.decision !== "reject");
      approvedDanger = approvedDanger.concat(ok2.map((d) => d.safeForm || d.command));
      for (const d of ok2) dangerTrail.push({ declared: d.command, ruled: d.decision + (d.safeForm ? "|" + d.safeForm : ""), executed: "待执行确认" });
      dangerLog = (dangerLog === "无" ? "" : dangerLog + "；") + dr.decisions.map((d) => d.command + " → " + d.decision + (d.safeForm ? "（改：" + d.safeForm + "）" : "") + "：" + d.reason).join("；");
      if (ok2.length > 0) {
        phase("执行已批准的危险操作");
        const execReport2 = await fixer.ask<string>(dangerExecAsk(ok2));
        for (const e of dangerTrail) {
          if (e.executed !== "待执行确认") continue;
          const form = e.ruled.split("|")[1] || e.declared;
          e.executed = execReport2.includes(form) ? form : "未确认：执行回报未含批准写法";
          if (!execReport2.includes(form)) log("危险操作执行确认缺失：" + e.declared + "——如实记录并计入门禁");
        }
      } else {
        log("返修请求的危险操作全部驳回：不得绕过，另寻安全路径");
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
        "amend 纪律核验未过（HEAD=" + (headFix || "无").slice(0, 7) + "，baseline 稳定=" + baselineStable + "）。请检查：修复必须 amend 进本轮提交且不动 baseline 之下的历史；执行 git add -A && git commit --amend --no-edit（或先修复漏提交的改动），返回一句话。",
      );
    }
    headA = headFix;
    rebuttedCount += fix.rebutted.length;
  }

  if (gate === "" || !gate.startsWith("pass")) {
    phase("门禁复核超限，打断上报");
    const ir = await chief.ask<string>(
      "第 " + round + " 轮门禁复核 10 次仍未通过（" + gate + "）。属重大问题：写 docs/workflow/interrupt_report.md（当前状态、失败证据、已尝试的修复、需要老板决策的点），git add -A && git commit（不推送未过门禁的提交，除非老板此前另有约定），返回一句话摘要。",
    );
    await artifact.markdown("interrupt", "# 中断报告（第 " + round + " 轮门禁）\n\n" + ir + "\n\n---\n门禁：" + gate + "\n待老板决策。\n", { title: "中断报告", description: "门禁复核 10 次仍未过" });
    finalVerdict = { verdict: "interrupted", requirementOutcomes: [], deviations: [], state: ir, decisionList: ["第 " + round + " 轮门禁未过：" + gate], advice: "门禁持续未过，请老板介入" };
    interrupted = true;
    break;
  }
  headA = await HEAD0();

  phase("推送约定 remote");
  let pushState = "未推送";
  let branch = "main";
  try {
    const b = await world.run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { timeoutMs: 60000 });
    branch = (b.stdout || "").trim() || "main";
  } catch {
    branch = "main";
  }
  if (push0.target !== "") {
    // 推送由编排器直接执行并核验（git 为字面量命令、目标在参数中）：不依赖任何 agent 的转述，失败即如实记录
    let pushExit = -1;
    for (let t = 0; t < 2 && pushExit !== 0; t++) {
      try {
        const p = await world.run("git", ["push", push0.target, "HEAD:" + branch], { timeoutMs: 300000 });
        pushExit = p.exitCode;
        if (pushExit !== 0) log("第 " + (t + 1) + " 次推送退出码 " + pushExit + "：" + (p.stderr || p.stdout || "").slice(0, 200));
      } catch {
        log("第 " + (t + 1) + " 次推送命令未启动（如实记录）");
      }
    }
    try {
      const ls = await world.run("git", ["ls-remote", push0.target, "refs/heads/" + branch], { timeoutMs: 120000 });
      const remoteHead = ((ls.stdout || "").split("\t")[0] || "").trim();
      if (remoteHead === headA && headA !== "") {
        pushState = "已推送并核验（" + headA.slice(0, 7) + "@" + push0.target + "/" + branch + "）";
        lastPushed = headA;
      } else {
        pushState = "推送核验失败（如实上报：remote=" + remoteHead.slice(0, 7) + "）";
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
    "把第 " + round + " 轮记入 docs/workflow/ledger.md（头部维护一行一轮的目录：本轮先更新目录行、再追加详情）：任务卡、开发摘要、危险操作裁决（" + dangerLog + "）、测试判决（问题 " + findingsCount + " / 反驳 " + rebuttedCount + " / 升级 " + escalations + "）、门禁 " + gate + "、覆盖声明（" + (verdict.coverage || "").slice(0, 300) + "）、baseline " + (baseline || "空树").slice(0, 7) + "、推送 " + pushState + "、遗留与否决（deferred/declined，各带理由，无则写“无”）、下一轮方向。然后 git add -A && git commit（账本小提交），返回一句话。",
  );
  const headLedger = await HEAD0();
  if (push0.target !== "" && headLedger !== "") {
    // 账本提交同样由编排器直接推送并核验：全程无 agent 转述
    try {
      const pl = await world.run("git", ["push", push0.target, "HEAD:" + branch], { timeoutMs: 300000 });
      if (pl.exitCode !== 0) log("账本提交推送退出码 " + pl.exitCode + "：" + (pl.stderr || "").slice(0, 200) + "——如实记录");
    } catch {
      log("账本提交推送未启动（如实记录）");
    }
  }
  log("第 " + round + " 轮记账 " + (headLedger !== "" && headLedger !== headA ? "已落地（" + headLedger.slice(0, 7) + "）" : "需人工复核"));
  if (push0.target !== "" && headLedger !== "") {
    try {
      const ls3 = await world.run("git", ["ls-remote", push0.target, "refs/heads/" + branch], { timeoutMs: 120000 });
      const rh3 = ((ls3.stdout || "").split("\t")[0] || "").trim();
      if (rh3 === headLedger) {
        lastPushed = headLedger;
        if (!pushState.startsWith("已推送")) log("工作提交此前推送核验未过，但账本提交推送时已将其一并推上 remote——如实记录");
      } else {
        log("账本提交未在 remote 核验（remote=" + rh3.slice(0, 7) + "，本地=" + headLedger.slice(0, 7) + "）——如实记录，下轮 remote CI 复核");
      }
    } catch {
      log("账本提交 remote 核验失败（ls-remote 不可达）——如实记录");
    }
  }
  rows.push({
    round,
    task: cards.title,
    dev: dev.summary,
    test: gate,
    findings: findingsCount + " 问题 / " + rebuttedCount + " 反驳" + (escalations > 0 ? " / " + escalations + " 升级" : ""),
    push: pushState,
    next: archived.slice(0, 200),
  });
  report(rows[rows.length - 1], "rounds");
  plan = "第 " + (round + 1) + " 轮规划依据：测试总评「" + verdict.summary + "」；开发遗留「" + dev.leftover + "」；账本最新一轮记录。";
}

phase("最终汇报");
// 无论是否被打断都做逐条对账：打断时把已完成/未完成如实写清，不许省略条目
const interruptNote = finalVerdict
  ? "【本次运行已打断】现状：" + finalVerdict.state + "；待老板决策点：" + finalVerdict.decisionList.join("；") + "。仍须逐条对账：已完成的要求写结果与证据，未完成的写「未完成：原因」，任何条目不得省略。verdict 必须填 interrupted。"
  : "";
const reported = await chief.ask<FinalReport>(
    interruptNote + (interrupted ? "" : roundsTotal + " 轮硬停（或提前完工）。") +
    "以 docs/workflow/requirements.md 与账本为唯一依据，写《最终汇报》到 docs/workflow/final_report.md：逐条要求（原话逐字）→结果→证据（requirementOutcomes，没有条目的要求不算完成）；与老板要求相悖的偏离逐条说明（deviations）；最终状态（提交/推送/CI/测试/已知局限）；只有老板能做的决策清单（decisionList）；遗留与否决各设固定小节（deferred/declined，各带理由——记录在案的延后是决策而非遗漏，被否决的想法不得下轮重新提案；deferred/declined/processLessons 字段如实填写，无则空数组）；流程教训一节——本轮循环自身如何失败或险些失败，提炼为检查单条目（每条=规则+为什么+适用范围）；老板采纳的教训持久化并随下次运行加载（被证伪的教训标记废弃、不与新教训并存；加载时先对照当前仓库核实仍适用）；一句建议。git add -A && git commit" +
      (push0.target !== "" ? "并推送约定 remote（不 force）" : "") + "。返回 FinalReport。",
);
const md = [
  "# 最终汇报",
  "",
  "老板要求（原话）：" + requirement,
  "",
  "## 逐条对账",
  ...reported.requirementOutcomes.map((o) => "- **" + o.id + "** 「" + o.verbatim + "」→ " + o.outcome + "（证据：" + o.evidence + "）"),
  "",
  "## 偏离说明",
  reported.deviations.length > 0 ? reported.deviations.map((d) => "- " + d) : "- 无：未发生与老板要求相悖的偏离",
  "",
  "## 最终状态",
  reported.state,
  "",
  "## 待老板决策",
  ...reported.decisionList.map((d) => "- " + d),
  "",
  "## 延后（deferred）",
  (reported.deferred && reported.deferred.length > 0) ? reported.deferred.map((d) => "- " + d.item + "（理由：" + d.reason + "）") : ["- 无"],
  "",
  "## 否决（declined）",
  (reported.declined && reported.declined.length > 0) ? reported.declined.map((d) => "- " + d.item + "（理由：" + d.reason + "）") : ["- 无"],
  "",
  "## 流程教训",
  (reported.processLessons && reported.processLessons.length > 0) ? reported.processLessons.map((d) => "- " + d) : ["- 无"],
  "",
  "## 建议",
  reported.advice,
  "",
  "---",
  "判定：" + reported.verdict + "；已执行轮数：" + rows.length + "。",
].join("\n");
await artifact.markdown("report", md, { title: "最终汇报", description: "要求逐条对账 + 偏离说明 + 待决策清单", primary: true });

return {
  conclusion: reported.advice,
  verdict: reported.verdict,
  rounds_completed: rows.length,
  requirement_coverage: reported.requirementOutcomes.length,
  deviations: reported.deviations.length,
  next_action: reported.decisionList.length > 0 ? "待老板决策：" + reported.decisionList[0] : "交付完成，等待老板验收",
};
