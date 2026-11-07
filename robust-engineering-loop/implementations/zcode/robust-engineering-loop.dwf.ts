/* zcode-workflow
description: 鲁棒工程循环（v0.5.9）：把一句开发要求变成经过冷启动对抗验证的实现。总工建要求台账（老板原话逐字）并承诺 N 轮（老板可锁定）；每轮开发+文档单笔提交 → 冷启动门禁（diff 审查、鲁棒性测试、canary、零警告构建、上一轮 remote CI 结转）→ 先复现再返修（误诊须证据反驳）、amend 并入本轮提交（初级 3 次未解升级高级工程师，10 次未过打断上报）；全绿才推送约定 remote（默认 GitCoffer，append-only 永不 force）；账本断点续跑；破坏性操作申报-裁决-执行三段核验、绝不转交用户；模型分档 tiered/uniform。
args:
  requirement:
    type: string
    required: true
    description: 老板的开发要求，原话逐字（将进入要求台账；逐条对账是总工的内部事务，只进账本与映射表，绝不进老板简报）
  rounds:
    type: number
    default: 0
    description: 总轮数；0 = 由总工程师规划并承诺（老板给定则锁定，硬停）
  remote:
    type: string
    default: "gitcoffer"
    description: 约定推送目标：显式 remote 名/URL 是权威指定方式；默认 gitcoffer = 自动探测名称或 URL 含 gitcoffer 的 remote（须恰有一个，探测只是便利）；none = 不推送
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
    description: 模型分档；tiered = 总工/高级工程师用强模型、算法/测试用廉价模型（本参考实现为 GLM-5.3 与 GLM-5.3-Flash，跨 provider 部署需把脚本内模型常量改为 provider 全名），uniform = 全部随会话模型（不声明任何模型，任何套餐可直接启动）
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
  /** 任务卡清单，每卡一句话指令＋逐字内嵌所引要求（R1/R2…）的台账原句 */
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
  /** 本轮交付的产物路径（含图像；.gitignore 里的产物也要列出，供视觉审阅定位）；无则空数组 */
  artifacts?: string[];
}

interface VisualVerdict {
  /** 一句话总评 */
  summary: string;
  /** 逐张图的问题（文件名 + 一句话 + 看到的现象）；没有则空数组 */
  issues: string[];
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
  /** 逐条对账：老板原话 → 结果 → 证据（内部事务：只进账本轮记录与 Agents/requirement_map.md 的对账标注，绝不进老板简报；没有条目的要求不算完成） */
  requirementOutcomes: { id: string; verbatim: string; outcome: string; evidence: string }[];
  /** 开头一段话：进展与结论——产出是不是老板要的东西（老板判断视角） */
  summary: string;
  /** 产出清单：每个交付物——一句话说明+回应老板哪句要求（引用 ≤15 字）+在哪 */
  deliverables: { artifact: string; addresses: string; location: string }[];
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
  /** 待答问题：老板原话里的疑问句 → 直接答案（含形态）→ 证据位置 */
  questionAnswers?: { q: string; a: string; evidence: string }[];
  /** 自主决定清单：决定｜理由｜若否决的后果｜奥卡姆自评（增加复杂度还是删减） */
  autonomousDecisions?: { decision: string; reason: string; ifRejected: string; occam: string }[];
  /** 给老板的一句建议 */
  advice: string;
}

const CHIEF_ZH = [
  "你是总工程师。使命：把老板（用户）的开发要求在承诺的有限轮数内变成高质量交付——每一轮都必须经过冷启动验证、全绿门禁、零警告编译，才允许推送。",
  "老板要求保真是最高纪律：第 1 轮开工前建 Agents/requirements.md——老板原话逐字、内涵解释、验收标准，一条不落；执行中不得与老板要求相悖，不得不偏离时必须在《最终简报》中逐条说明原因与替代选择，绝不悄悄违背。",
  "要求入账做四步机械清点，缺一不可：①逐句清点——老板每条消息（requirement 参数、focus、LoopMail/FromBoss.md 老板反馈文件）逐句切分，每句标「已登记 Rn / 不适用（理由）/ 需澄清」；②要求与验收标准——老板原话逐字编号（R1/R2…）+ 内涵解释 + 可机械判定的验收标准，一条不落；③产物规格表——每个交付物写清轴、定义域、分辨率、颜色编码、合格判据（可被机械判定），老板原话里每个数字与格式词都必须落到某一行；④待答问题——疑问句逐条登记（问题原文、登记时间、答复状态）。四步清点的四节与要求逐字台账一并写进 Agents/requirements.md（台账共四节）。对老板原话必须得出一个自洽的理解方向、正确把握主旨；把握不准的绝不臆断——在台账与简报中原样引用老板原话并标注「不确定」，工程师在开发、测试过程中可能就理解了。逐字保真不等于语义保真：照抄字面而理解错，是最危险的失败。",
  "开局简报（第一封邮件）：承诺轮数后、开工前把开局简报作为第一封邮件写入 LoopMail/ToBoss.md（≤1 页，只三块）：我打算交付什么（每条对应老板原话哪一句，引用 ≤15 字）、每项怎么算合格（可机械判定的判据）、我不确定的地方（≤3 条，各给默认理解与理解错的后果）。写完直接开工，绝不为「等老板过目」而停机空转；老板次日据简报逐条纠正。",
  "歧义即重大问题候选：老板原话填不进规格表时（例：某个数字既可读成分箱宽度也可读成坐标轴范围），不得按字面挑一种照办——原样引用原话写进简报的「不确定」，或据此判定是否改变范围而决定打断。",
  "文件三类化（交付纪律，分界线就是位置）：docs/ 只放正式内容——老板原话提及的交付物本体（REPORT.ipynb、论文稿件、方法正本、参考资料原文）；LoopMail/＝BOSS—总工通信层，只两个合法文件——ToBoss.md（总工交付邮件正本，开局简报与最终简报按邮件倒序追加、新邮件插头部、旧邮件永不删改，docs/ 正式文件以相对链接作附件引用）＋FromBoss.md（老板运行中反馈，老板写入，正序追加，总工绝不改动）；LoopMail/ 下出现其它文件时先判定归属——老板放置的文件名加前缀 FromBoss_ 并原样保留（绝不改动内容），agent 自己散落的产物按交付整理规则归位，拿不准的一律按老板放置处理；其余老板面向的历史文档并入 ToBoss 邮件表述后本体迁 Agents/；Agents/ 下的一切都是工程脚手架——账本、要求台账、映射表、Agents/selfcheck.py、测试调试脚本、被替代的代码、被证伪的历史、面向 Agent 的文档。交付遵循奥卡姆剃刀：整理交付只用 git mv 把脚手架移入 Agents/，绝不删除文件——删除是老板的动作；老板只看非 Agents/ 的部分；若需要老板亲自翻 Agents/，说明工作流出了问题。",
  "打断策略：重大问题（要求不可行、会改变范围的歧义、需要加轮、门禁复核 10 次仍未过）→ 立即打断循环并把打断报告作为加急邮件插入 LoopMail/ToBoss.md 头部向老板说明；破坏性操作本身不是打断事由——按危险操作条款裁决（初级申报→高级工程师；升级阶段高级工程师申报→你），仅当裁决后本轮仍完全无法推进才打断上报；小问题（范围内的实现细节、工具选择、顺序调整）→ 你自行决断并在账本记录。范围、进度、质量标准、预算这类老板级取舍不许被你降级成小问题。",
  "轮次规划：第 1 轮前承诺总轮数 N 与每轮一句话范围（老板用 rounds 参数锁定时以老板为准，不得增减）；每轮开始依据账本重新安排本轮任务卡——上一轮判决、问题与反驳、remote CI 结转、遗留事项都要处置；每张任务卡必须可追溯到要求条目并逐字内嵌台账原句（R1/R2…）；当上一轮的修复被后续验证否证时，本轮任务卡以\"回退还是继续修\"的显式决策开头（回退=用一笔新的普通提交恢复原行为，绝不改写历史），证据优先——绝不叠加在被否证的修复上；老板指令文件的新指令使已排产工作失效时，下一轮任务卡以\"作废重做\"的显式决策开头并如实记账。",
  "每轮发卡前先检查 requirements.md 的待答问题：有未答项时，本轮任务卡先安排作答（回答成本极低，却直接影响老板判断）。",
  "任务卡凡涉及老板要求，必须逐字内嵌 Agents/requirements.md 的台账原句（带 Rn 编号），禁止凭记忆转述：压缩短语只能作标题，逐字原文随卡携带；转述与原文的实词必须逐个保真——名词（操作对象）、动词（操作）、量词、否定词、数字，任何一个变了即失真，把握不住就全文照抄。台账原话中的关键实词是协议词：任务卡、开发报告、测试名与断言注释、提交信息、文档一律沿用同词，不得同义替换。",
  "奥卡姆剃刀：你的自主决定天然倾向「加东西」（加模块、加检查、加配置）——每个增加复杂度的决定必须写明预期价值，否则默认不做；凡是增加复杂度的自主决定，不能只写账本，必须进《最终简报》的自主决定清单。",
  "误诊仲裁：算法工程师与测试工程师就某条问题争执时，你只依据证据仲裁；仍不能定 → 重大问题，打断上报老板。",
  "接手先读账本（Agents/ledger.md）：断点续跑，不重做已完成轮；账本同时记录每轮 baseline 哈希与已推送 SHA；被中断或取消的片段恢复时先做闭合复查——丢弃范围内的每项在途工作要么核实仍在、要么在账本记明放弃，先和解再前进，绝不静默跳过。",
  "git 写操作权限：只执行问句明示的 git add/commit/amend；git push 由编排器统一执行并核验——你在任何时刻都不执行 push，也不执行 reset/rebase/tag 等其它写仓库的 git 操作。",
  "老板反馈（FromBoss.md）：编排器每轮发卡前会附上 LoopMail/FromBoss.md 的当前内容（老板运行中下达的指令，可能为空）——逐条落实到任务卡并把应用情况记入账本；它承载运行中指挥，不替代要求台账；与老板此前要求不一致时，以老板最新指令为准并如实记录。",
  "诚实第一：汇报只引用命令输出与退出码；说不知道；矛盾上报而不是绕过。",
  "全程中文。",
].join("\n");

const ALGO_ZH = [
  "你是算法工程师：实现本轮任务卡；每轮只做一笔本地提交（本轮提交），提交信息一句话概括本轮。文档即交付物：专业、美观、简洁——同一信息只在一处维护，杜绝冗余与重复；代码改动必须随附文档改动，纳入同一笔提交。测试与调试脚本、过程性产物一律写进 Agents/；仓库根与 docs/ 只放老板面向的文件。",
  "测试工程师验证期间工作树冻结：不修改被测实现。",
  "实现与验收以 Agents/requirements.md 的台账原话为唯一准绳：任务卡与台账不一致（疑似转述失真）时，以台账为准实现，并在开发报告中上报该不一致——沉默跟随错误卡面也是失职。",
  "返修纪律：拿到问题清单先逐条复现——确认属实的修复；复现不了或与事实不符的以证据反驳（命令输出、规格引用），绝不盲目\"修复\"不存在的问题——瞎改代码不是进度。过期条目（引用旧版本行号、已被修复、在本轮代码上无法复现）直接丢弃并在反驳中注明「过期」，绝不据此改代码。",
  "修复一律 git add -A && git commit --amend --no-edit 并入本轮提交：绝不改写已推送历史，绝不 amend baseline 之下的提交。",
  "你的开发报告（含每张卡的要求覆盖）只交给总工程师做规划；测试工程师永远看不到它——冷启动是设计使能，不是疏漏。",
  "把失败当失败报告；矛盾上报。绝不造假、绝不绕过门禁、绝不 force 推送。",
  "你运行在廉价模型档，定位是初级工程师：同一问题 3 次迭代仍未解决时不要硬磕——整理最小复现与根因假设，交由高级工程师（强模型）接手。",
  "修复纪律三则：层归因先于修复——动手前用能判别的证据钉住缺陷所在层/组件，不做「以防万一」的跨层修复，无法归因就如实上报；诊断必须可证伪——指名能推翻它的实验，不可证伪的解释只是猜测，不能作为改动依据，失败现场的直接观察优先于理论；参照锚定——存在参考实现（上游/先行实现）时先对照其行为层再下结论，偏离参考要么在账本说明理由要么对齐。",
  "上下文纪律：长命令输出重定向到文件后用 tail/grep 取摘要，不整屏阅读；参考材料只读相关节选（本轮 diff 触及的文件不适用节选规则——那些按测试的整读义务处理）；工具输出超长只取与判定相关的摘录。",
  "git 写操作权限：只执行问句明示的 git add/commit/amend；git push 由编排器统一执行——你在任何时刻都不执行 push，也不执行 reset/rebase/tag 等其它写仓库的 git 操作。",
  "破坏性操作铁律：rm -rf / 删除目录或数据文件 / git reset --hard / git clean -fdx / force push / 改写已推送历史 / 覆盖他人产物，一律只申报不执行——写入 dangerRequests（命令原文、原因、影响范围），等高级工程师裁决后按其批准的写法执行。",
  "全程中文。",
].join("\n");

const SENIOR_ZH = [
  "你是高级工程师（升级通道，强模型档）：初级算法工程师同一问题 3 次迭代未能解决时，该问题升级到你手上。先读门禁输出与账本定位根因，一次修对而不是绕症状；修复同样 amend 并入本轮提交，遵守算法工程师的全部纪律。",
  "你同时是破坏性操作的裁决者之一：裁决初级工程师申报的删除/覆盖/改写历史操作——能否精确界定影响范围、是否可逆、有无更窄更安全的等价写法（限定路径、dry-run 先行、先备份、先列受影响清单）；默认拒绝，能给安全写法就用 approve-with-change 并写明 safeForm，必要且安全才 approve（升级阶段你自己申报的操作由总工裁决，你不能裁决自己的申报）。",
  "这个裁决不下放给老板：只有整轮任务在无该操作时根本无法继续（必须重建索引、必须清掉损坏产物）才建议总工走打断流程；日常删除绝不去打扰用户。若确属阻塞性问题（要求矛盾、环境不可用），如实说明并建议打断上报。",
  "全程中文。",
].join("\n");

const VISUAL_ZH = [
  "你是视觉审阅员：只看图，不看代码，也不相信任何自述。用工具打开指定图像，逐张回答三问：①数据是否铺满应定义域（有无大片空白、是否只有极少数据点）；②坐标轴、刻度、图例是否可读且与规格表一致；③这张图能否支撑本轮所声称的结论。",
  "对照 Agents/requirements.md 的产物规格表判断「应该是什么样」，而不是凭好看与否。只读，绝不修改任何文件；打不开的图如实说明。",
  "全程中文。",
].join("\n");

const TEST_ZH = [
  "你是测试工程师，冷启动上岗：你只依据 diff（baseline..HEAD）与代码库本身工作，绝不依赖作者的自述；没有人会给你开发报告，作者叙述会锚定验证者，这是设计使能。",
  "diff 审查：看实际改了什么，而不是声称改了什么；新代码、被改动的行为、文档与实现是否一致；文档质量（专业、美观、简洁、无冗余重复）不合格同样算问题；用户可见声明一并审计——diff 引入的每条面向用户的主张（README、文档、发布说明）都映射到机制或可重跑检查，每个数字有唯一出处。",
  "整读义务：本轮 diff 触及的每个文件必须完整阅读（含改动处前后文），绝不只读其中几段就下结论；略读只允许发生在本轮 diff 之外的仓库区域，且必须在 coverage 中申报；凡深读文件，coverage 写明实际执行的检查与行级锚点（file:line），供日后对账。",
  "上下文纪律：长命令输出重定向到文件后用 tail/grep 取摘要；diff 触及文件的整读义务不适用节选规则；工具输出超长只取与判定相关的摘录。",
  "git 写操作权限：只执行问句明示的 git add/commit/amend（selfcheck/映射表等测试设施随轮 amend）；git push 由编排器统一执行——你在任何时刻都不执行 push，也不执行其它写仓库的 git 操作。",
  "先读 Agents/requirements.md 的四节（逐句清点、要求与验收标准、产物规格表、待答问题）：门禁必须覆盖规格表里的合格判据，而不是只验结构（文件生成了、图非空、颜色合规）。",
  "验收以 Agents/requirements.md 的台账原话为唯一准绳，不以任何卡面转述为准；发现转述失真（卡面/文档与台账的实词不一致）列入问题清单并定性「转述失真」。",
  "内容断言：每个交付物的 selfcheck 必须含从规格表派生的内容断言——定义域/范围断言（如某图横轴必须等于规格值）、填充率断言（如数据应铺满 ≥60% 横轴）、可辨识断言（输入与输出应有可观测差异）。只验「有没有」不验「对不对」的套件视为门禁未达标——废图通过 40 项结构检查是最坏情形。",
  "测试期望值只许从规格表或已登记要求派生，绝不从当前实现派生；每条断言的注释写明出处（Rn 或规格行）。把误解写成必须通过的测试，是最坏的护城河。",
  "数字幻觉警示：好的数据表现不代表好的情况——严谨考虑数字代表的含义是不是表面那么简单；支撑它的理论可能本身有错，而漂亮的数字又会加固这一理论幻觉。理解数字含义的前提是对其基础理论有充分认知：对每个头条数字追问——它背后的理论/机制是什么，若理论错了这个数字还说明什么？",
  "编写并维护鲁棒性测试：边界与对抗输入、适用的扰动场景；并在 Agents/ 下创建/维护 Agents/selfcheck.py（测试与调试脚本一律放 Agents/，仓库根与 docs/ 只放老板面向的文件——开发时鼓励多探索多测试，交付时奥卡姆剃刀），按项目 profile 聚合三件事——严格模式构建（警告即错误：-Werror / /WX / -D warnings / deny(warnings) 等按语言取）、全量测试+鲁棒性用例、本地 CI 等价执行（仓库配了 CI 就必须本地等价跑通）；套件不只演练还要证伪——diff 新增的每个机制都配一条负向检查（篡改输入必须失败、注入必须被拒），\"已验证\"指证伪尝试失败过，而非快乐路径通过。",
  "Agents/selfcheck.py 必须含至少一个必须失败的金丝雀用例并带 canary 标记；selfcheck 运行时必须真实执行该金丝雀并观察到其失败，并在标准输出末尾打印一行机器可读结果：CANARY: expected-FAIL observed-FAIL（编排器解析此行核验——缺失或 observed-PASS 视为套件无效）——不会变红的测试套件证明不了任何事。",
  "核查上一轮推送在 remote 上的 CI：GitHub remote 且 gh 可用时用 gh run list / gh run view；不可核查则如实写\"无法核查\"，绝不默认通过；失败项列入本轮必修。",
  "独立性绝对：绝不修改被测实现。你只写 Agents/selfcheck.py、鲁棒性用例，以及 Agents/requirement_map.md（要求↔实现位置↔可重跑验证命令，表格式并带 requirement-map 标记）的验证列。",
  "破坏性操作判据（与申报义务对齐）：超出批准清单的——数据文件或整目录消失、baseline 之下的历史被改写、force push、既有产物被覆盖——标 blocker 并索要申报与裁决记录；正常重构中的源文件删除不属破坏性操作，但须在提交信息或文档中可追溯；对第三方仓库的 clone，上游只读——推送仍只去约定 remote、绝不 push 上游，收尾前以 git 输出核实上游 refs 原样。",
  "产物新鲜度与参照锚定：核验所用产物必须由 HEAD 构建——构建布局可暴露产物时核对源文件与产物新旧（Agents/selfcheck.py 可内置该检查），陈旧二进制上的绿灯一律作废；存在参考实现（上游/先行实现）时，对可疑行为先对照其行为层核查，无理由的偏离即问题；每条问题标注所属层/组件及判别证据。",
  "验证命令一律在钉定环境运行：输出 locale 固定（本地化工具以固定 locale 重跑）、系统级配置隔离（凭据助手与全局 git 配置绕过而非信任）、场景间凭据状态复位、临时目录不假定持久；每个结论的验证手段分层声明按每次 verdict 的 coverage 要求执行。",
  "每条问题附复现证据（命令+输出）；修复后必须复跑原始失败检查确认关闭；对工程师的反驳只依据证据仲裁；构建系统都跑不起来、要求自相矛盾这类问题如实标 blocker。",
  "全程中文。",
].join("\n");

const requirement = String(args.requirement ?? "");
const roundsArg = typeof args.rounds === "number" ? args.rounds : 0;
const remoteArg = typeof args.remote === "string" && args.remote !== "" ? args.remote : "gitcoffer";
if (requirement === "") log("警告：requirement 参数为空——续跑修正可能丢失参数，请核对本次运行参数；最终简报的「老板要求」将缺失");
if (typeof args.remote === "undefined") log("提示：remote 参数缺失（疑似续跑丢参）——按默认 gitcoffer 探测，请核对启动日志的「推送目标」行");
const profile = typeof args.profile === "string" ? args.profile : "";
const focus = typeof args.focus === "string" ? args.focus : "";
const PROFILE_LINE = profile ? "\n项目约束（强制，覆盖默认）：" + profile : "";

/** 模型分档：tiered = 强弱分档（本参考实现 GLM-5.3 / GLM-5.3-Flash；跨 provider 部署请把这两个常量改成 provider 全名）；uniform = 全随会话模型。模型名只在 tiered 时以字符串传入——uniform 下整个脚本不出现任何模型声明，任何套餐都能直接启动（实测：裸 model() 声明会在非参考套餐上启动失败） */
const tiered = String(args.models ?? "tiered").toLowerCase() !== "uniform";
const STRONG = "GLM-5.3" as const;
const CHEAP = "GLM-5.3-Flash" as const;
type ModelName = typeof STRONG | typeof CHEAP;
const persona = (system: string, m: ModelName): { system: string; model?: ModelName } =>
  tiered ? { system, model: m } : { system };

/** 解析约定推送目标：返回 {target(名字或URL，空=跳过推送), note} */
async function resolvePushTarget(): Promise<{ target: string; note: string }> {
  if (remoteArg.toLowerCase() === "none") return { target: "", note: "老板已设 remote=none：全程不推送" };
  let names: string[] = [];
  let hits: string[] = [];
  try {
    const r = await G(["remote", "-v"], 60000);
    const pairs: { name: string; url: string }[] = [];
    for (const line of (r.stdout || "").split("\n")) {
      const m = line.trim().match(/^(\S+)\s+(\S+)/);
      if (m) pairs.push({ name: m[1], url: m[2] });
    }
    names = Array.from(new Set(pairs.map((p) => p.name)));
    // gitcoffer 备份探测（启发式）：名称或 URL 含 gitcoffer——GitCoffer 建的库不必然叫这个名字，探测只是便利；显式传 remote 参数（名字或 URL）才是权威指定方式
    hits = Array.from(new Set(pairs.filter((p) => /gitcoffer/i.test(p.name) || /gitcoffer/i.test(p.url)).map((p) => p.name)));
  } catch {
    names = [];
    hits = [];
  }
  if (/^(\w+@|[A-Za-z][A-Za-z0-9+.-]*:\/\/|[A-Za-z]:|\/|\\\\)/.test(remoteArg)) return { target: remoteArg, note: "" };
  if (names.includes(remoteArg)) return { target: remoteArg, note: "" };
  if (remoteArg.toLowerCase() === "gitcoffer") {
    if (hits.length === 1) return { target: hits[0], note: "" };
    if (hits.length === 0) return { target: "", note: "未探测到 gitcoffer 备份 remote（按名称或 URL 匹配）：跳过推送并如实上报，绝不擅自改推别处——若备份 remote 已配置，请用 remote 参数显式指定其名称或 URL" };
    return { target: "", note: "gitcoffer 匹配不唯一（" + hits.join(", ") + "）：无法唯一识别，跳过推送并如实上报——请用 remote 参数显式指定" };
  }
  return { target: "", note: "remote 参数 \"" + remoteArg + "\" 不在 git remote 列表（" + (names.join(", ") || "无") + "）：跳过推送并如实上报" };
}

/** 凭据掩码：remote URL 的 user:token@ 段绝不进入日志/账本/问句 */
const maskUrl = (u: string): string => u.replace(/\/\/[^/@]+@/, "//***@");
const HEAD0 = async (): Promise<string> => {
  for (let t = 0; t < 2; t++) {
    try {
      const l = await git.log(1);
      return l[0]?.hash ?? "";
    } catch {
      /* 瞬态失败：重试一次（B#25） */
    }
  }
  return "";
};

const CHIEF_BLOCK_NOTE = "\n（若为重大问题，填 blocked 并停止发卡：把打断报告作为加急邮件插入 LoopMail/ToBoss.md 头部——以解释开头（发生了什么、为什么），再列已完成轮次与产物、需要老板决策的点、建议选项与各自代价——然后本地提交。）";

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
let chief = agent("总工程师", persona(CHIEF_ZH + PROFILE_LINE, STRONG)); // 强模型档：分析与规划（pre-loop 实例：承诺入账/迁移复核/打断；进入轮循环后每轮重建，B#27）
let ledger = "";
try {
  ledger = await files.read("Agents/ledger.md");
} catch {
  ledger = "";
}
if (ledger === "") {
  try {
    const ag = await files.glob("Agents/*");
    if (ag.length > 0) log("警告：Agents/ 非空（" + ag.length + " 项）但 Agents/ledger.md 读取为空——账本可能超出读取上限，续跑轮次判定需人工核对，绝不静默当全新仓库");
  } catch {
    /* 探测失败则无补充信息 */
  }
}
if (ledger !== "" && typeof args.rounds !== "number") log("提示：rounds 参数缺失（疑似续跑丢参）——轮数以账本承诺为准，请核对启动日志");
let legacyLayout = false; // LoopMail 之前的布局（docs/workflow/，或中间布局 docs/ 下的 brief.md 与 boss_directives.md）——发现即要求总工先整体迁移再续跑；迁移是一次性转换，此后读写只走 LoopMail 路径，不留双轨回退
if (ledger === "") {
  try {
    ledger = await files.read("docs/workflow/ledger.md");
    legacyLayout = ledger !== "";
  } catch {
    ledger = "";
  }
}
if (!legacyLayout) {
  let modernMail = "";
  try {
    modernMail = (await files.read("LoopMail/FromBoss.md")).trim();
  } catch {
    modernMail = "";
  }
  if (modernMail === "") {
    for (const p of ["docs/boss_directives.md", "docs/brief.md"]) {
      try {
        await files.read(p);
        legacyLayout = true; // 中间布局：一次性迁移的触发探测（非读取回退——迁移后读写只走 LoopMail）
        break;
      } catch {
        legacyLayout = false;
      }
    }
  }
}
if (legacyLayout) log("检测到 LoopMail 之前的布局：开工前先整体迁移（一律 git mv，绝不删除）——工作文件移入 Agents/，指令文件→LoopMail/FromBoss.md、简报→LoopMail/ToBoss.md；迁移是一次性转换，此后读写只走 LoopMail 路径");
let repoRoot = "";
try {
  const tr = await world.run("git", ["rev-parse", "--show-toplevel"], { timeoutMs: 60000 });
  repoRoot = (tr.stdout || "").trim();
} catch {
  repoRoot = "";
}
/** 编排器统一 git 入口：显式 -C 仓库根——工作区根≠仓库根时不再静默失效（实测缺陷） */
const G = (gitArgs: string[], timeoutMs = 120000): Promise<WorldRunResult> =>
  world.run("git", repoRoot !== "" ? ["-C", repoRoot, ...gitArgs] : gitArgs, { timeoutMs });
try {
  const st = await G(["status", "--porcelain"], 60000);
  if ((st.stdout || "").trim() !== "") log("警告：工作树不干净——请从干净工作树开始；已如实记入账本");
} catch {
  /* 无 git 或无法检查：跳过 */
}
const push0 = await resolvePushTarget();
log("推送目标：" + (push0.target !== "" ? maskUrl(push0.target) : "未配置——" + push0.note));
// 启动仓库体检：工作流假定「工作目录是仓库根」——不成立时大声说明，而不是静默跳过推送
let repoWarn = "";
try {
  const wt = await world.run("git", ["rev-parse", "--is-inside-work-tree"], { timeoutMs: 60000 });
  const inside = (wt.stdout || "").trim() === "true";
  const cd = inside ? await world.run("git", ["rev-parse", "--show-cdup"], { timeoutMs: 60000 }) : null;
  const cdup = cd ? (cd.stdout || "").trim() : "";
  if (!inside) {
    repoWarn = "当前目录不是 git 仓库（或 git 不可用）：提交核验与推送将不可用——请从被开发仓库的根目录运行本工作流";
  } else if (cdup !== "" && repoRoot !== "") {
    repoWarn = "当前目录是仓库的子目录（仓库根为 " + repoRoot + "，需上溯 " + cdup + "）：Agents/ 与 docs/ 将写在当前目录下，与仓库根不一致——建议从仓库根运行";
  }
} catch {
  repoWarn = "仓库状态体检失败（git 不可用）：提交核验与推送将不可用";
}
if (repoWarn !== "") log("警告：" + repoWarn + "；已如实记入账本");
let bossDirectives0 = "";
try {
  bossDirectives0 = (await files.read("LoopMail/FromBoss.md")).trim();
} catch {
  bossDirectives0 = "";
}
const commit0 = await chief.ask<Commitment>(
  "老板的开发要求（原话逐字）：" + requirement + "\n" + (focus ? "老板本次关注点：" + focus + "\n" : "") +
  (bossDirectives0 ? "【老板反馈 LoopMail/FromBoss.md】（老板下达的指令，逐条落实）：\n" + bossDirectives0 + "\n" : "") +
  (repoRoot ? "当前仓库根：" + repoRoot + "（与账本记录不符时如实注明）。\n" : "") +
  (repoWarn !== "" ? "【环境警告】" + repoWarn + "——本轮照常推进，但推送/提交核验可能不可用；在账本记明。\n" : "") +
  (legacyLayout ? "【迁移】检测到旧版布局：把工作文件归位到新布局（目标位置已是新布局的项跳过）：docs/workflow/ 下的 ledger.md、requirements.md、requirement_map.md 与仓库根的 selfcheck.py 若存在则 git mv 进 Agents/，docs/boss_directives.md→LoopMail/FromBoss.md、docs/brief.md→LoopMail/ToBoss.md（git mv）；final_brief.md 历史简报并入 ToBoss 邮件表述后本体迁 Agents/；FromBoss.md/ToBoss.md 头注缺失时补一行 LoopMail 协议头注（FromBoss 正序追加/绝不删改老板写下的内容；ToBoss 新邮件插头部/倒序追加/旧邮件永不删改/四禁写作纪律），git add -A && git commit 后再续跑。\n" : "") +
  (ledger ? "已有账本（头部目录+末尾详情，续跑依据）：\n" + (ledger.length > 6000 ? ledger.slice(0, 1600) + "\n……（中间省略）……\n" + ledger.slice(-3200) : ledger) + "\n若显示本要求已完成 N 轮，resumeFrom = N（从第 N+1 轮续跑，不重做）；否则 0。\n" : "无账本：resumeFrom = 0。\n") +
  "第 1 轮开工前完成四件事：1) 建 Agents/requirements.md 要求台账——文件头一行权威分工（Agents/requirements.md=要求正本、Agents/requirement_map.md=验证正本、Agents/ledger.md=历史正本）；四节必备：逐句清点（每条消息逐句标 已登记Rn/不适用/需澄清）、要求逐字编号（R1/R2…）+ 内涵解释 + 可机械判定的验收标准、产物规格表（轴/定义域/分辨率/颜色编码/合格判据）、待答问题（疑问句逐条登记）；若存在会改变范围的歧义，先在 blocked.question 里向老板提出（这是唯一的开工前提问）；2) 承诺总轮数 roundsTotal 与每轮一句话范围 roundsOutline" +
  (roundsArg > 0 ? "（老板已锁定 rounds=" + roundsArg + "，必须采用，不得增减）" : "（由你规划，定死即不得再加，除非打断上报）") +
  "；3) 把开局简报作为第一封邮件写入 LoopMail/ToBoss.md（≤1 页：交付什么/怎么算合格/不确定处 ≤3 条——不确定处原样引用老板原话，不写臆断的转述）；LoopMail/ToBoss.md 与 LoopMail/FromBoss.md 不存在时先创建并写入协议头注（ToBoss：新邮件插头部、倒序追加、旧邮件永不删改、四禁写作纪律；FromBoss：正序追加、绝不删改老板写下的内容、总工每轮发卡前必读）；4) 本地提交该台账与简报。承诺后立即开工——除要求自相矛盾或不可行（填 blocked），绝不为「等老板过目」停机。返回 Commitment。" + CHIEF_BLOCK_NOTE,
);
let roundsTotal = roundsArg > 0 ? roundsArg : Math.round(commit0.roundsTotal);
if (!(roundsTotal >= 1)) roundsTotal = 3;
let clampNote = "";
if (roundsArg === 0 && roundsTotal > 50) {
  log("警告：总工规划轮数 " + roundsTotal + " 超出编排器上限——已钳制为 50（有界迭代是协议原则；确需更多轮，老板可用 rounds 参数锁定）");
  clampNote = "总工原规划 " + roundsTotal + " 轮，超出编排器上限，已按 50 轮执行";
  roundsTotal = 50;
}
if (roundsTotal !== (roundsArg > 0 ? roundsArg : commit0.roundsTotal) && clampNote === "") {
  log("总工承诺轮数越界（守卫已纠正），已按 " + roundsTotal + " 处理（如实记录）");
}
if (legacyLayout) {
  let migratedLedger = "";
  try {
    migratedLedger = await files.read("Agents/ledger.md");
  } catch {
    migratedLedger = "";
  }
  if (migratedLedger === "") await chief.ask<string>("迁移复核未通过：Agents/ledger.md 读取为空——旧布局迁移（git mv 归位）可能未完成或未提交。请补全迁移并 git add -A && git commit，返回一句话；确无账本可迁的如实说明。");
}
if (commit0.blocked) {
  phase("重大问题打断");
  const ir = await chief.ask<string>(
    "已按 blocked 打断。补全 LoopMail/ToBoss.md 头部的打断加急邮件（问题、已完成轮次与产物、需要老板决策的问题、建议选项），git add -A && git commit，返回一句话摘要供老板速览。",
  );
  await artifact.markdown("interrupt", "# 中断报告\n\n" + ir + "\n\n---\n待老板决策后，携带补充说明重跑本工作流（账本已记录断点）。\n", { title: "中断报告（投递副本）", description: "正本：LoopMail/ToBoss.md 加急邮件；重大问题，等待老板决策" });
  return { conclusion: "已打断：" + commit0.blocked.reason, question: commit0.blocked.question, rounds_completed: 0, next_action: "老板决策后重跑（从账本续跑）" };
}
log("总轮数承诺：" + roundsTotal + " 轮；规划：" + String(commit0.roundsOutline || "").replace(/\n/g, "；"));
const rawResume = Math.round(commit0.resumeFrom);
if (!Number.isFinite(rawResume) || rawResume < 0) log("警告：resumeFrom 无效（" + String(commit0.resumeFrom) + "）——按 0 处理（如实记录）");
if (Number.isFinite(rawResume) && rawResume > roundsTotal) log("警告：账本/总工申报已完成 " + rawResume + " 轮，超过本次承诺轮数 " + roundsTotal + "——本次运行将不执行任何轮次，最终简报必须向老板说明此异常");
const startRound = Number.isFinite(rawResume) && rawResume >= 0 ? Math.max(1, Math.min(roundsTotal + 1, rawResume + 1)) : 1;
if (startRound > 1) log("账本显示已完成 " + (startRound - 1) + " 轮，从第 " + startRound + " 轮续跑");

let algo = agent("算法工程师", persona(ALGO_ZH + PROFILE_LINE, CHEAP)); // 廉价模型档：初级工程师（每轮重建，B#27）
let senior = agent("高级工程师", persona(ALGO_ZH + SENIOR_ZH + PROFILE_LINE, STRONG)); // 强模型档：破坏性操作裁决（升级返修由一次性实例承担；每轮重建，B#27）

/** 破坏性操作审核：执行者只申报，由独立的强模型档裁决（初级申报→高级工程师；升级阶段高级工程师申报→总工）——裁决者非申报者本人，且绝不转交老板 */
async function adjudicateDanger(reqs: DangerRequest[], requester: string, requesterTier: string, byChief: boolean): Promise<DangerReview> {
  const askText =
    "破坏性操作审核。申报人：" + requester + "（" + requesterTier + "）。逐条裁决以下请求：\n" + JSON.stringify(reqs) +
    "\n判断依据：影响范围能否精确界定、是否可逆、有无更窄更安全的等价写法（限定路径、dry-run 先行、先备份、先列出受影响清单）。默认 reject；能给安全写法时用 approve-with-change 并在 safeForm 写明；必要且安全才 approve。批准附条件：先备份保证可逆、失败即停；同一操作有界重试（2–3 次）仍败就挂起（在账本记明、不再尝试），绝不改用影响面更大的替代方案。" +
    "绝不把判断交回用户：仅当整轮任务在无该操作时根本无法继续，才在 reason 中写明并建议打断。返回 DangerReview（decisions 与请求逐条对应）。";
  const raw = byChief
    ? await chief.ask<DangerReview>(askText)
    : await senior.ask<DangerReview>(askText);
  let decisions = raw.decisions ?? [];
  const mismatched = decisions.length === reqs.length && reqs.some((r, i) => !decisions[i] || decisions[i].command !== r.command);
  if (decisions.length !== reqs.length || mismatched) {
    log("危险操作裁决不完整或与申报不对应（" + decisions.length + "/" + reqs.length + " 条）——整体按驳回处理，如实记录");
    decisions = reqs.map((r) => ({ command: r.command, decision: "reject" as const, safeForm: "", reason: "裁决不完整或与申报不对应，整体驳回以保安全" }));
  }
  for (const d of decisions) {
    if (d.decision === "approve-with-change" && (d.safeForm || "").trim() === "") {
      log("危险操作裁决缺口：approve-with-change 但安全写法为空——按拒绝处理，绝不放行原始命令（" + d.command.slice(0, 60) + "）");
      d.decision = "reject";
      d.reason = (d.reason || "") + "（安全写法为空，按拒绝处理）";
    }
  }
  return { summary: raw.summary, decisions };
}

/** 让执行者严格照批准写法执行，并 amend 并入本轮提交 */
function dangerExecAsk(approved: DangerDecision[]): string {
  return "执行已批准的危险操作，严格按批准写法（safeForm 非空时用 safeForm），不得扩大范围、不得新增未批准的命令：\n" +
    approved.map((d, i) => (i + 1) + ". " + (d.safeForm || d.command) + "（批准理由：" + d.reason + "）").join("\n") +
    "\n回报中必须逐字引用上列每条批准写法（一致性核查按逐字匹配，漏引或转述都算未确认）；完成后 git add -A && git commit --amend --no-edit 并入本轮提交（本轮尚无提交则直接 commit），返回一句话。";
}
// 入账完整性机械核查：四节与开局简报是否真的写进了文件——缺了就补一次，补不上如实记录（这是"漏登记 5/7 条"的机械对账点）
const intakeMarkers = ["逐句清点", "要求与验收标准", "产物规格表", "待答问题"];
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
    bt = await files.read("LoopMail/ToBoss.md");
  } catch {
    bt = "";
  }
  intakeMissing = [];
  if (rt === "") {
    intakeMissing.push("requirements.md 缺失");
  } else {
    for (const mk of intakeMarkers) if (!rt.includes(mk)) intakeMissing.push("requirements.md 缺「" + mk + "」节");
  }
  if (bt === "") intakeMissing.push("LoopMail/ToBoss.md 缺失");
};
await checkIntake();
if (intakeMissing.length > 0) {
  await chief.ask<string>(
    "入账完整性核查未通过：" + intakeMissing.join("；") + "。请补全并 git add -A && git commit（节标题固定为「逐句清点」「要求与验收标准」「产物规格表」「待答问题」，ToBoss.md 开局邮件三块：交付什么/怎么算合格/不确定处 ≤3），返回一句话。",
  );
  await checkIntake();
  log(intakeMissing.length === 0 ? "入账完整性：补齐后通过" : "入账完整性仍缺：" + intakeMissing.join("；") + "——如实记录并继续");
}

const rows: RoundRow[] = [];
let lastPushed = ""; // 上一轮推送的 SHA（供下一轮 remote CI 核查）
let plan = String(commit0.roundsOutline || "");
let finalVerdict: FinalReport | null = null;
let interrupted = false;
let ungatedHead = false; // 门禁未过即打断时 HEAD 含未过门禁的提交——最终简报不推送
let branch = "main";
try {
  const b = await G(["rev-parse", "--abbrev-ref", "HEAD"], 60000);
  branch = (b.stdout || "").trim() || "main";
} catch {
  branch = "main";
}
if (branch === "HEAD") {
  branch = ""; // detached HEAD：目标分支不确定——全部推送跳过（fail-closed，B#20），老板确认分支后重跑
  log("警告：仓库处于 detached HEAD 状态，目标分支不确定——本轮所有推送跳过并如实记录（确认分支后重跑）");
}

for (let round = startRound; round <= roundsTotal && !interrupted; round++) {
  const baseline = await HEAD0();
  chief = agent("总工程师-R" + round, persona(CHIEF_ZH + PROFILE_LINE, STRONG)); // B#27：每轮全新实例——检查点是账本，不是任何人的会话记忆
  algo = agent("算法工程师-R" + round, persona(ALGO_ZH + PROFILE_LINE, CHEAP));
  senior = agent("高级工程师-R" + round, persona(ALGO_ZH + SENIOR_ZH + PROFILE_LINE, STRONG));
  let bossNote = "";
  try {
    bossNote = (await files.read("LoopMail/FromBoss.md")).trim();
  } catch {
    bossNote = "";
  }
  phase("总工发卡");
  let cards = await chief.ask<RoundCards>(
    "第 " + round + "/" + roundsTotal + " 轮。老板要求见 Agents/requirements.md；本轮规划依据：\n" + String(plan).slice(0, 4000) + "\n" +
    (lastPushed ? "上一轮已推送 " + lastPushed.slice(0, 7) + "：先核查其在 remote（" + (maskUrl(push0.target) || "未配置") + "）上的 CI 状态（gh run list/view；不可核查则如实注明），失败项列入 remoteCiIssues 作为本轮必修。\n" : "") +
    (round === startRound && startRound > 1 ? "【续跑首轮】上一次运行若以门禁未过打断，HEAD 上可能留有未过门禁的提交——本轮推送会将其一并带上 remote：先核对账本末轮的门禁与推送记录，未过门禁的遗留工作在本轮任务卡中显式处置（修好或回退）。\n" : "") +
    (bossNote ? "【老板反馈（本轮读取，LoopMail/FromBoss.md）】逐条落实，应用情况入账本：\n" + bossNote + "\n" : "") +
    "发本轮任务卡前先查 requirements.md 的待答问题：有未答项时，第一张卡就是作答（含形态说明：是 raw 还是派生格式、有没有写出器）。\n" +
    "发本轮任务卡：每卡一句话且可追溯到要求条目并逐字内嵌所引 Rn 的台账原句（压缩短语只能作标题，实词逐个保真）；上一轮的问题、反驳、遗留逐条处置。轮次号以 Agents/ledger.md 的目录实态为准——与本提示的编号不一致时按账本实态标注并说明（编排器计数仅内部用）。所有要求已闭环且门禁全绿可置 done=true 提前完工。" + CHIEF_BLOCK_NOTE,
  );
  if (cards.blocked) {
    const ir = await chief.ask<string>(
      "已按 blocked 打断（第 " + round + " 轮开工前）。补全 LoopMail/ToBoss.md 头部的打断加急邮件，git add -A && git commit，返回一句话摘要。",
    );
    if (push0.target !== "" && branch !== "") {
      // 中断报告提交由编排器推送（树中只有已过门禁的工作与本次文档提交）
      try {
        const pi = await G(["push", push0.target, "HEAD:" + branch], 300000);
        if (pi.exitCode !== 0) log("中断报告推送退出码 " + pi.exitCode + "——如实记录");
      } catch {
        log("中断报告推送未启动（如实记录）");
      }
    }
    await artifact.markdown("interrupt", "# 中断报告（第 " + round + " 轮）\n\n" + ir + "\n\n---\n待老板决策后，携带补充说明重跑本工作流（账本已记录断点）。\n", { title: "中断报告（投递副本）", description: "正本：LoopMail/ToBoss.md 加急邮件；重大问题，等待老板决策" });
    finalVerdict = { verdict: "interrupted", requirementOutcomes: [], deviations: [], summary: "", deliverables: [], state: ir, decisionList: [cards.blocked.question], advice: "重大问题已打断，等待老板决策" };
    interrupted = true;
    break;
  }
  if (cards.done === true) {
    log("总工判定所有要求已闭环，提前完工（如实记录）");
    break;
  }
  if ((cards.cards || []).length === 0) {
    log("第 " + round + " 轮任务卡为空且未声明完工——按打断处理（如实记录）");
    const ir0 = await chief.ask<string>("任务卡为空又未完工，属规划异常：写明原因到 Agents/ledger.md 并 git add -A && git commit，返回一句话。");
    finalVerdict = { verdict: "interrupted", requirementOutcomes: [], deviations: [], summary: "", deliverables: [], state: ir0, decisionList: ["总工未能在第 " + round + " 轮发出任务卡"], advice: "规划异常，请老板介入" };
    interrupted = true;
    break;
  }
  // 卡面-台账逐字对拍（转述失真防线，句级）：引用了 Rn 的卡必须完整内嵌台账中该 Rn 的登记行（含 Rn 前缀，空白规约后逐字比对）——句内翻词、跨 Rn 借句、借路径等公共字符串旁路全部拦下；登记行只认以 Rn 开头的行（目录行/交叉引用行不算，标题/列表/强调装饰不碍）；语言中立、无字符数魔数
  let reqRawC = "";
  try {
    reqRawC = await files.read("Agents/requirements.md");
  } catch {
    reqRawC = "";
  }
  if (reqRawC === "") {
    log("转述失真防线未运行：Agents/requirements.md 不可读——如实记录（其余防线不变）");
  } else {
    const linesByRn = new Map<string, string[]>();
    for (const rawLine of reqRawC.split("\n")) {
      if (!/^\s*(?:#{1,6}\s*|[-*+]\s*|\d{1,3}[.、)]\s*|[*_]{0,2})*R\d+\b/.test(rawLine)) continue; // 登记行只认以 Rn 开头的行——目录行/交叉引用行不得当通行证（标题/列表/强调装饰不碍）
      const rns = Array.from(new Set(rawLine.match(/\bR\d+\b/g) || []));
      if (rns.length === 0) continue;
      const lineN = rawLine.replace(/\s+/g, "");
      for (const rn of rns) {
        const parts = linesByRn.get(rn) || [];
        if (parts.indexOf(lineN) < 0) parts.push(lineN);
        linesByRn.set(rn, parts);
      }
    }
    const verbatimOk = (card: string): boolean => {
      const c = card.replace(/\s+/g, "");
      const cited = Array.from(new Set(card.match(/\bR\d+\b/g) || []));
      for (const rn of cited) {
        const lines = linesByRn.get(rn) || [];
        if (!lines.some((l) => c.indexOf(l) >= 0)) return false;
      }
      return cited.length > 0;
    };
    const noRn = (cards.cards || []).filter((c) => !/\bR\d+\b/.test(c));
    let paraphrased = (cards.cards || []).filter((c) => /\bR\d+\b/.test(c) && !verbatimOk(c));
    if (noRn.length > 0) log("第 " + round + " 轮有 " + noRn.length + " 张卡无 Rn 标注——违反发卡纪律（每卡可追溯到要求条目），如实记录");
    if (paraphrased.length > 0) {
      cards = await chief.ask<RoundCards>(
        "卡面-台账对拍未通过（转述失真防线，句级）：以下卡引用了 Rn，但没有完整内嵌台账中该 Rn 的登记行——卡面转述可能已改变实词（对象/操作/量词/否定词/数字）：\n" + paraphrased.map((c) => "- " + c.slice(0, 80)).join("\n") + "\n请重写这些卡：把 Agents/requirements.md 中该 Rn 的登记行逐字复制进卡面（含 Rn 前缀；压缩短语只能作标题），其余字段照旧返回（不得新增 blocked/done）；若是台账漏记了原话，先补台账再返回。返回 RoundCards。",
      );
      paraphrased = (cards.cards || []).filter((c) => /\bR\d+\b/.test(c) && !verbatimOk(c));
      log(paraphrased.length === 0 ? "卡面-台账对拍：重写后通过" : "卡面-台账对拍重写后仍缺 " + paraphrased.length + " 张——如实记录并继续，下游以台账原话为准绳");
    }
  }
  log("第 " + round + " 轮任务：" + cards.title + ((cards.remoteCiIssues || []).length > 0 ? "；remote CI 结转必修：" + cards.remoteCiIssues.length + " 项" : ""));

  phase("算法工程师开发与提交");
  let dev = await algo.ask<DevReport>(
    "第 " + round + " 轮任务卡：\n" + cards.cards.map((c, i) => (i + 1) + ". " + c).join("\n") +
    ((cards.remoteCiIssues || []).length > 0 ? "\n上一轮 remote CI 必修项：\n" + cards.remoteCiIssues.map((s) => "- " + s).join("\n") : "") +
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
  const dangerTrail: { declared: string; decision: string; form: string; executed: string }[] = []; // 一致性核查凭据：申报→裁决→执行三段必须对得上
  if ((dev.dangerRequests || []).length > 0) {
    phase("危险操作审核");
    const review = await adjudicateDanger(dev.dangerRequests, "算法工程师", "廉价模型档", false);
    dangerLog = review.decisions.map((d) => d.command + " → " + d.decision + (d.safeForm ? "（改：" + d.safeForm + "）" : "") + "：" + d.reason).join("；");
    log("第 " + round + " 轮危险操作裁决：" + dangerLog.slice(0, 300));
    const ok = review.decisions.filter((d) => d.decision !== "reject");
    approvedDanger = ok.map((d) => (d.decision === "approve-with-change" ? (d.safeForm || "").trim() : d.command));
    for (const d of ok) dangerTrail.push({ declared: d.command, decision: d.decision, form: d.safeForm || d.command, executed: "待执行确认" });
    if (ok.length > 0) {
      phase("执行已批准的危险操作");
      const execReport = await algo.ask<string>(dangerExecAsk(ok));
      for (const e of dangerTrail) {
        if (e.executed !== "待执行确认" && !e.executed.startsWith("未确认：")) continue;
        const hit = execReport.includes(e.form);
        e.executed = hit ? e.form : "未确认：执行回报未含批准写法";
        if (!hit) log("危险操作执行确认缺失：" + e.declared + "——待复核（返修轮会再给一次逐字引用机会），计入门禁");
      }
      headA = await HEAD0();
    } else {
      log("危险操作全部驳回：不执行，不得绕过");
    }
  }

  phase("测试工程师冷启动门禁");
  const diffHint = baseline ? "git diff " + baseline + "..HEAD" : "git show HEAD（整仓首提交）";
  // 覆盖声明辅助：编排器只统计并转告 diff 体量，不设阈值红线；深读/略读的取舍由测试员在 verdict 中声明并对账
  let diffLines = -1;
  if (baseline) {
    try {
      const df = await G(["diff", "--numstat", baseline + "..HEAD"]);
      diffLines = (df.stdout || "").split("\n").reduce((a, l) => { const p2 = l.trim().split("\t"); return a + (Number(p2[0]) || 0) + (Number(p2[1]) || 0); }, 0);
    } catch {
      diffLines = -1;
    }
  }
  const sizeNote = diffLines < 0 ? "（diff 体量未知：numstat 不可用，请自行评估）" : "（本轮 diff 体量约 " + diffLines + " 行" + (diffLines > 800 ? "，偏大：请先盘变更清单、再对高风险区深读" : "") + "）";
  let verdict: TestVerdict = { summary: "未开始", passed: false, findings: [] , coverage: "未开始：尚未评审" };
  let gate = "";
  let canary = false;
  let canaryRun = false;
  let fullSelfOut = "";
  let mapOk = false;
  let findingsCount = 0;
  let rebuttedCount = 0;
  let escalations = 0; // 升级到高级工程师（强模型档）的返修次数
  let interpIsPy3 = false;
  let lastFix: FixOutcome | null = null;
  let imageFiles: string[] = []; // 本轮图像产物（账本与视觉声明跨 attempt 使用，故置于轮级）
  let imgDetectOk = true; // 图像检测是否成功（B#18：失败必须如实披露，随 attempt 复位）
  let visualNote = "本轮未进入视觉审阅";

  for (let attempt = 1; attempt <= 10; attempt++) {
    const tester = agent("测试工程师-R" + round + "-A" + attempt, persona(TEST_ZH + PROFILE_LINE, CHEAP)); // 一次性实例：上下文有界、证据随任务卡走（实测：持久实例在廉价档 65K 窗口上风暴）
    verdict = await tester.ask<TestVerdict>(
      (attempt === 1
        ? "冷启动上岗。baseline 提交：" + (baseline || "（空树，本仓库首提交）") + "。本轮 diff 体量：" + sizeNote + "。先读 Agents/requirements.md 的四节（逐句清点/要求与验收标准/产物规格表/待答问题），再审查 " + diffHint + " 与代码库本身：diff 审查、鲁棒性测试、Agents/selfcheck.py（严格构建/全量测试+鲁棒性/本地 CI 等价 + canary 标记 + 从规格表派生的内容断言）、更新 Agents/requirement_map.md 验证列；这些测试设施的改动 git add -A && git commit --amend --no-edit 并入本轮提交（测试套件属于本轮交付）。"
        : (lastFix
            ? "算法工程师已返修（amend 并入本轮提交），其返修申报（只作对账线索，结论仍以你重跑的检查为准）：" + JSON.stringify(lastFix) + "\n"
            : "上一轮未过的机械项（Agents/selfcheck.py/requirement_map.md）已发回你补齐，工程侧无返修。\n") +
      "逐条复检：修复项重跑原始失败检查确认关闭；反驳项只依据证据仲裁——反驳成立则撤回问题，不成立则保留并说明。") +
      ((cards.remoteCiIssues || []).length > 0 ? "\n另：上一轮 remote CI 必修项已由算法工程师处理：" + cards.remoteCiIssues.join("; ") : "") +
      (approvedDanger.length > 0
        ? "\n本轮经裁决批准的危险操作，只允许这些写法：" + approvedDanger.join("；")
        : "\n本轮未批准任何破坏性操作：diff 或历史中若出现数据/整目录消失、baseline 之下历史被改写、force、既有产物被覆盖，即为未授权破坏性操作，标 blocker（正常重构的源文件删除除外）。") +
      "返回 TestVerdict（问题必须有复现证据）。verdict 中必须附覆盖声明 coverage：深审了哪些文件/区域（逻辑改动、门禁相关、涉危险操作处）、只略读了哪些（略读仅限本轮 diff 之外的区域，深读文件给出行级锚点 file:line），且每个结论写明验证手段（真实设备/介质实测、CI 运行、或无设备时的专项冷启动审查替代——替代审查如实写明，绝不写成实测）——它写在知道问题在哪之前，日后任何问题落在略读区或替代验证上将直接以此对账。artifacts 字段列出本轮交付的产物路径（含图像；即使被 .gitignore 也要列）。",
    );
    findingsCount = (verdict.findings || []).length;
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
        fullSelfOut = r.stdout || "";
        output = (r.stderr || r.stdout || "(no output)").slice(0, 1500);
        if (!interpIsPy3 && (exitCode === 9009 || exitCode === 127 || (exitCode !== 0 && /Python was not found|command not found/i.test(output)))) {
          throw new Error("py-launcher-stub"); // Windows Store python 别名：spawn 成功但解释器不存在——按启动失败走 python3 回退
        }
      } catch (e) {
        if (!interpIsPy3) {
          interpIsPy3 = true;
          try {
            const r = await world.run("python3", ["Agents/selfcheck.py"], { timeoutMs: 3600000 });
            exitCode = r.exitCode;
            fullSelfOut = r.stdout || "";
            output = (r.stderr || r.stdout || "(no output)").slice(0, 1500);
          } catch {
            output = e instanceof Error && e.message === "py-launcher-stub" ? "python 为启动器 stub 且 python3 不可用——环境缺 Python 解释器" : "python 与 python3 均无法启动 Agents/selfcheck.py";
          }
        } else {
          output = "Agents/selfcheck.py 启动失败或超时";
        }
      }
    } else {
      output = "Agents/selfcheck.py 缺少 canary 标记（必须失败的金丝雀用例）";
    }
    canaryRun = /CANARY:\s*expected-FAIL\W*observed-FAIL/i.test(fullSelfOut);
    if (canary && !canaryRun) log("门禁拦截：selfcheck 未报告 canary 执行结果（缺 CANARY: expected-FAIL observed-FAIL 行）——金丝雀必须真实运行并观察到失败");
    // 机械核查：每条已批准的危险操作必须申报、有裁决、按批准写法执行（三段对得上才算过）；执行写法必须与批准写法逐字一致，转述不算执行一致
    let dangerConsistent = dangerTrail.every((e) => e.executed !== "待执行确认" && !e.executed.startsWith("未确认") && approvedDanger.includes(e.executed));
    if (!dangerConsistent && dangerTrail.some((e) => e.executed.startsWith("未确认"))) {
      // 粘滞解药（实测缺陷：一次未确认曾被当成终态，门禁空转 10 轮）：给执行者一次逐字引用机会，引用即闭环
      const reQuote = await algo.ask<string>(
        "危险操作一致性复核：你此前申报执行的已批准危险操作中，有 " + dangerTrail.filter((e) => e.executed.startsWith("未确认")).length + " 条的执行回报未含逐字原文。先核实它们确已执行（git log/reflog），再在回报中逐字引用你实际执行的命令原文（照抄你当初执行的形式，不得转述——本提示不提供原文，凭你自己的执行记录引用）；确未执行的如实说明。返回一句话。",
      );
      for (const e of dangerTrail) {
        if (!e.executed.startsWith("未确认")) continue;
        if (reQuote.includes(e.form)) e.executed = e.form;
      }
      dangerConsistent = dangerTrail.every((e) => e.executed !== "待执行确认" && !e.executed.startsWith("未确认") && approvedDanger.includes(e.executed));
    }
    if (!commitOk) log("门禁拦截：本轮提交未落地（commitOk=false）——按未过处理");
    if (verdict.passed && (verdict.findings || []).length > 0) log("门禁拦截：测试员 passed=true 但仍带 " + (verdict.findings || []).length + " 条 findings——按未过处理");
    const mechGreen = verdict.passed && exitCode === 0 && canary && canaryRun && mapOk && dangerConsistent && commitOk && (verdict.findings || []).length === 0;
    // 图像产物检测（机械）：测试员申报的产物 ∪ diff 中新增/修改的图片 ∪ 工作树未跟踪的图片——有图就必须有人真的看一眼
    const isImg = (p: string): boolean => /\.(png|jpe?g|svg|webp|gif)$/i.test(p);
    imageFiles = (verdict.artifacts || []).filter((p) => isImg(p));
    imgDetectOk = true;
    if (mechGreen && imageFiles.length === 0) {
      try {
        const st2 = await G(["status", "--porcelain"], 60000);
        for (const line of (st2.stdout || "").split("\n")) {
          const t2 = line.trim();
          if (t2.length < 4) continue;
          const p2raw = t2.slice(3).trim();
          const p2unq = p2raw.startsWith("\"") && p2raw.endsWith("\"") && p2raw.length > 1 ? p2raw.slice(1, -1) : p2raw; // porcelain 对含空格路径加引号——剥离后再判定（B#18）
          const p2parts = p2unq.split(" -> "); // rename 条目 "R  old -> new"：取新路径（B#18）
          const p2 = (p2parts[p2parts.length - 1] || p2unq).trim();
          if (isImg(p2) && imageFiles.indexOf(p2) < 0) imageFiles.push(p2);
        }
        if (baseline) {
          const df2 = await G(["diff", "--name-only", baseline + "..HEAD"], 60000);
          for (const p3 of (df2.stdout || "").split("\n").map((s) => s.trim())) {
            if (p3 !== "" && isImg(p3) && imageFiles.indexOf(p3) < 0) imageFiles.push(p3);
          }
        }
        const ig2 = await G(["ls-files", "--others", "--ignored", "--exclude-standard", "--", "*.png", "*.jpg", "*.jpeg", "*.svg", "*.webp", "*.gif"], 60000); // pathspec 限定图形文件：全量 ignored 枚举在大仓库有体量代价（P1）
        for (const p4 of (ig2.stdout || "").split("\n").map((s) => s.trim())) {
          // 被 .gitignore 的交付图只可能在老板面向的位置（仓库根或 docs/）——依赖目录与 Agents/ 不算交付（B#18）
          if (p4 !== "" && isImg(p4) && imageFiles.indexOf(p4) < 0 && (p4.indexOf("/") < 0 || p4.indexOf("docs/") === 0)) imageFiles.push(p4);
        }
      } catch {
        imgDetectOk = false; // B#18：检测失败必须如实披露，不得静默按无图处理
      }
    }
    let visualOk = imageFiles.length === 0;
    visualNote = imageFiles.length === 0 ? (imgDetectOk ? "本轮无图像产物：不适用" : "图像产物检测失败——按无图处理，如实记录") : "尚未审阅";
    if (mechGreen && imageFiles.length > 0) {
      phase("视觉审阅图像产物");
      const vv = await agent("视觉审阅-R" + round + "-A" + attempt, persona(VISUAL_ZH + PROFILE_LINE, STRONG)).ask<VisualVerdict>(
        "本轮任务：" + cards.title + "。规格见 Agents/requirements.md 的产物规格表。逐张打开并审阅以下图像（相对工作区路径）：\n" + imageFiles.join("\n") +
        "\n三问：数据是否铺满应定义域（有无大片空白/是否只有极少数据点）；坐标轴、刻度、图例是否可读且与规格一致；这张图能否支撑本轮所声称的结论。返回 VisualVerdict（问题写清文件名与你看到的现象）。",
      );
      visualNote = vv.summary + ((vv.issues || []).length > 0 ? "｜问题：" + (vv.issues || []).join("；") : "");
      visualOk = (vv.issues || []).length === 0;
      if (!visualOk) log("视觉审阅未通过：" + visualNote.slice(0, 300));
    }
    if (mechGreen && visualOk) {
      gate = "pass（第 " + attempt + " 次尝试" + (interpIsPy3 ? "，python3" : "") + (imageFiles.length > 0 ? "，含视觉审阅" : "") + "）";
      break;
    }
    if (attempt === 10) {
      gate = (!commitOk ? "提交未落地；" : "") + (verdict.passed ? ((verdict.findings || []).length > 0 ? "passed 但带 findings；" : "") : "测试未过；") + (canary ? "" : "缺 canary；") + ((canary && !canaryRun) ? "canary 未报告执行结果；" : "") + (mapOk ? "" : "要求映射表缺失；") + (dangerConsistent ? "" : "危险操作申报-裁决-执行不一致；") + (visualOk ? "" : "视觉审阅未过；") + (exitCode === 0 ? "" : "selfcheck exit " + exitCode);
      break;
    }
    if ((verdict.findings || []).length === 0) {
      // 纯机械项失败（无问题清单）：Agents/selfcheck.py 与映射表是测试工程师的设施，发回其所有者补齐——不占工程师生级通道
      lastFix = null;
      await tester.ask<string>(
        "机械门禁未达标（canary=" + (canary ? (canaryRun ? "有（已报告）" : "有（缺 CANARY 行）") : "无") + "；requirement_map=" + (mapOk ? "有效" : "缺失") + "；selfcheck exit=" + (canary ? exitCode : "未运行") + "），而你的 verdict 没有问题清单。Agents/selfcheck.py 与 requirement_map.md 归你所有：补齐或修复它们，改动 git add -A && git commit --amend --no-edit 并入本轮提交；若 selfcheck 暴露的是实现缺陷，在下一次 verdict 中作为问题提出（附复现证据）。返回一句话。",
      );
      headA = await HEAD0();
      continue;
    }
    const juniorAsk = attempt <= 3; // 初级 3 次迭代未解决 → 升级高级工程师（强模型档）
    if (!juniorAsk) escalations++;
    const fixer = juniorAsk
      ? agent("返修-R" + round + "-A" + attempt, persona(ALGO_ZH + PROFILE_LINE, CHEAP))
      : agent("高级返修-R" + round + "-A" + attempt, persona(ALGO_ZH + SENIOR_ZH + PROFILE_LINE, STRONG)); // 一次性实例：证据随任务卡走，上下文有界
    const fix = await fixer.ask<FixOutcome>(
      (juniorAsk ? "" : "【升级】初级工程师已 3 次迭代未解决以下问题。你是高级工程师（强模型档）：先定位根因，一次修对，同样 amend 并入本轮提交。\n") +
      "第 " + attempt + " 次门禁未过：" + (verdict.passed ? "（自检通过但 selfcheck/映射表未达标）" : JSON.stringify(verdict.findings)) +
      "\n机械状态：canary=" + (canary ? (canaryRun ? "有（已报告）" : "有（缺 CANARY 行）") : "无") + "；requirement_map=" + (mapOk ? "有效" : "缺失") + "；危险操作三段一致=" + (dangerConsistent ? "是" : "否") + "；selfcheck exit=" + (canary ? exitCode : "未运行") +
      (imageFiles.length > 0 ? "；图像产物：" + imageFiles.join("、") + "；视觉审阅=" + (visualOk ? "通过" : "未通过——" + visualNote) : "") +
      "\n输出摘录：\n" + output +
      "\n先逐条复现：确认→修复；误诊→证据反驳（FixOutcome.rebutted）；过期条目（引用旧版本行号、已被修复、在本轮代码上复现不了）直接丢弃并在反驳中注明「过期」，绝不据此改代码。然后 git add -A && git commit --amend --no-edit 并入本轮提交。绝不改写 baseline 之下的历史。",
    );
    lastFix = fix;
    if ((fix.dangerRequests || []).length > 0) {
      phase("危险操作审核");
      const dr = await adjudicateDanger(fix.dangerRequests, juniorAsk ? "算法工程师" : "高级工程师", juniorAsk ? "廉价模型档" : "强模型档", !juniorAsk);
      const ok2 = dr.decisions.filter((d) => d.decision !== "reject");
      approvedDanger = approvedDanger.concat(ok2.map((d) => (d.decision === "approve-with-change" ? (d.safeForm || "").trim() : d.command)));
      for (const d of ok2) dangerTrail.push({ declared: d.command, decision: d.decision, form: d.safeForm || d.command, executed: "待执行确认" });
      dangerLog = (dangerLog === "无" ? "" : dangerLog + "；") + dr.decisions.map((d) => d.command + " → " + d.decision + (d.safeForm ? "（改：" + d.safeForm + "）" : "") + "：" + d.reason).join("；");
      if (ok2.length > 0) {
        phase("执行已批准的危险操作");
        const execReport2 = await fixer.ask<string>(dangerExecAsk(ok2));
        for (const e of dangerTrail) {
          if (e.executed !== "待执行确认" && !e.executed.startsWith("未确认：")) continue;
          const hit = execReport2.includes(e.form);
          e.executed = hit ? e.form : "未确认：执行回报未含批准写法";
          if (!hit) log("危险操作执行确认缺失：" + e.declared + "——待复核（返修轮会再给一次逐字引用机会），计入门禁");
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
    rebuttedCount += (fix.rebutted || []).length;
  }

  if (gate === "" || !gate.startsWith("pass")) {
    phase("门禁复核超限，打断上报");
    const ir = await chief.ask<string>(
      "第 " + round + " 轮门禁复核 10 次仍未通过（" + gate + "）。属重大问题：把打断报告作为加急邮件插入 LoopMail/ToBoss.md 头部（当前状态、失败证据、已尝试的修复、需要老板决策的点），git add -A && git commit（不推送未过门禁的提交，除非老板此前另有约定），返回一句话摘要。",
    );
    await artifact.markdown("interrupt", "# 中断报告（第 " + round + " 轮门禁）\n\n" + ir + "\n\n---\n门禁：" + gate + "\n待老板决策。\n", { title: "中断报告（投递副本）", description: "正本：LoopMail/ToBoss.md 加急邮件；门禁复核 10 次仍未过" });
    finalVerdict = { verdict: "interrupted", requirementOutcomes: [], deviations: [], summary: "", deliverables: [], state: ir, decisionList: ["第 " + round + " 轮门禁未过：" + gate], advice: "门禁持续未过，请老板介入" };
    interrupted = true;
    ungatedHead = true;
    break;
  }
  headA = await HEAD0();

  phase("推送约定 remote");
  let pushState = "未推送";
  if (push0.target !== "" && branch !== "") {
    // 推送前核对：远端 HEAD 应为本轮 baseline（上轮已推送核验）——不符即疑似代理在会话内推送过，大声记录并对账
    try {
      const pre = await G(["ls-remote", push0.target, "refs/heads/" + branch]);
      const preHead = ((pre.stdout || "").split("\t")[0] || "").trim();
      if (preHead !== "" && preHead !== baseline && preHead !== lastPushed) {
        log("推送前核对：远端 HEAD=" + preHead.slice(0, 7) + "，本轮 baseline=" + (baseline || "空树").slice(0, 7) + (startRound > 1 ? "（续跑常态：远端应为账本记录的上一轮推送 SHA，已核对）" : "——疑似存在会话内推送，如实记录"));
      }
    } catch {
      /* ls-remote 不可达：推送结果本身会如实记录 */
    }
    // 推送由编排器直接执行并核验（git 为字面量命令、目标在参数中）：不依赖任何 agent 的转述，失败即如实记录
    let pushExit = -1;
    for (let t = 0; t < 2 && pushExit !== 0; t++) {
      try {
        const p = await G(["push", push0.target, "HEAD:" + branch], 300000);
        pushExit = p.exitCode;
        if (pushExit !== 0) log("第 " + (t + 1) + " 次推送退出码 " + pushExit + "：" + maskUrl((p.stderr || p.stdout || "")).slice(0, 200));
      } catch {
        log("第 " + (t + 1) + " 次推送命令未启动（如实记录）");
      }
    }
    try {
      const ls = await G(["ls-remote", push0.target, "refs/heads/" + branch]);
      const remoteHead = ((ls.stdout || "").split("\t")[0] || "").trim();
      if (remoteHead === headA && headA !== "") {
        pushState = "已推送并核验（" + headA.slice(0, 7) + "@" + maskUrl(push0.target) + "/" + branch + "）";
        lastPushed = headA;
      } else {
        pushState = "推送核验失败（如实上报：remote=" + remoteHead.slice(0, 7) + "）";
      }
    } catch {
      pushState = "推送核验失败（ls-remote 不可达，如实上报）";
    }
  } else {
    pushState = branch === "" ? "跳过推送：detached HEAD，分支不确定（如实记录）" : "跳过推送：" + push0.note;
  }
  log("第 " + round + " 轮推送：" + pushState);

  phase("总工记账");
  const archived = await chief.ask<string>(
    "把第 " + round + " 轮记入 Agents/ledger.md（头部含仓库标识行" + (repoRoot ? "：" + repoRoot : "") + "与一行一轮的目录：本轮先更新目录行、再追加详情）：任务卡、开发摘要（" + (dev.summary || "").slice(0, 400) + "）、危险操作裁决（" + dangerLog + "）、测试判决（问题 " + findingsCount + " / 反驳 " + rebuttedCount + " / 升级 " + escalations + "）、门禁 " + gate + "、覆盖声明（" + (verdict.coverage || "").slice(0, 300) + "）、视觉审阅（" + visualNote.slice(0, 200) + "）、要求覆盖（" + (dev.requirementCoverage || []).join("；") + "）、baseline " + (baseline || "空树").slice(0, 7) + "、推送 " + pushState + "、遗留与否决（deferred/declined，各带理由，无则写“无”）、下一轮方向。然后 git add -A && git commit（账本小提交），返回一句话。",
  );
  let headLedger = await HEAD0();
  if (headLedger === "" || headLedger === headA) {
    log("账本提交未落地（HEAD 未前进或 git 读取失败）——账本追加重试一次");
    await chief.ask<string>("账本提交未落地（HEAD 未前进）：把本轮记录写入 Agents/ledger.md，git add -A && git commit，返回一句话。");
    headLedger = await HEAD0();
  }
  if (push0.target !== "" && branch !== "" && headLedger !== "") {
    // 账本提交同样由编排器直接推送并核验：全程无 agent 转述
    try {
      const pl = await G(["push", push0.target, "HEAD:" + branch], 300000);
      if (pl.exitCode !== 0) log("账本提交推送退出码 " + pl.exitCode + "：" + maskUrl((pl.stderr || "")).slice(0, 200) + "——如实记录");
    } catch {
      log("账本提交推送未启动（如实记录）");
    }
  }
  log("第 " + round + " 轮记账 " + (headLedger !== "" && headLedger !== headA ? "已落地（" + headLedger.slice(0, 7) + "）" : "需人工复核"));
  if (push0.target !== "" && branch !== "" && headLedger !== "") {
    try {
      const ls3 = await G(["ls-remote", push0.target, "refs/heads/" + branch]);
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
    dev: dev.summary + ((dev.requirementCoverage || []).length > 0 ? "｜覆盖 " + (dev.requirementCoverage || []).join("/") : ""),
    test: gate,
    findings: findingsCount + " 问题 / " + rebuttedCount + " 反驳" + (escalations > 0 ? " / " + escalations + " 升级" : ""),
    push: pushState,
    next: archived.slice(0, 200),
  });
  report(rows[rows.length - 1], "rounds");
  plan = "第 " + (round + 1) + " 轮规划依据：测试总评「" + verdict.summary + "」；开发遗留「" + dev.leftover + "」；要求覆盖「" + (dev.requirementCoverage || []).join("；") + "」；账本最新一轮记录。";
}

let closingBossNote = "";
try {
  closingBossNote = (await files.read("LoopMail/FromBoss.md")).trim();
} catch {
  closingBossNote = "";
}
if (closingBossNote !== "") log("收尾时重读 LoopMail/FromBoss.md：发现老板反馈 " + closingBossNote.length + " 字——注入最终简报问句逐条处置，绝不静默蒸发");
phase("最终简报");
// 无论是否被打断都做逐条对账：打断时把已完成/未完成如实写清，不许省略条目
const interruptNote = finalVerdict
  ? "【本次运行已打断】现状：" + finalVerdict.state + "；待老板决策点：" + finalVerdict.decisionList.join("；") + "。逐条对账是内部事务：已完成/未完成的每一条写进账本与 Agents/requirement_map.md 的对账标注，不得省略；老板看到的文档保持简报形态（解释开头、待决策、建议选项），不在老板文档里对账。verdict 必须填 interrupted。"
  : "";
// 要求映射覆盖机械核查（"没有条目的要求不算完成"的机械版；仅未打断时运行）：requirements.md 的每个 Rn 必须在 requirement_map.md 留有对账条目（词边界匹配，防 R1 误匹配 R10）
let mapGap = "";
if (!interrupted) {
  let mapTextF = "";
  try {
    mapTextF = await files.read("Agents/requirement_map.md");
  } catch {
    mapTextF = "";
  }
  let reqTextF = "";
  try {
    reqTextF = await files.read("Agents/requirements.md");
  } catch {
    reqTextF = "";
  }
  const rnAllF = Array.from(new Set(reqTextF.match(/\bR\d+\b/g) || [])).sort();
  const hasEntryF = (rn: string): boolean => new RegExp("\\b" + rn + "\\b").test(mapTextF);
  const rnMissingF = rnAllF.filter((rn) => !hasEntryF(rn));
  if (rnMissingF.length > 0) {
    await chief.ask<string>(
      "要求映射覆盖核查未过：Agents/requirement_map.md 缺少以下要求的对账条目：" + rnMissingF.join("、") + "——没有条目的要求不算完成。逐条补映射（要求↔实现位置↔可重跑验证命令）；已放弃/不适用的要求在台账记明原因并在映射表标注处置，git add -A && git commit，返回一句话。",
    );
    try {
      mapTextF = await files.read("Agents/requirement_map.md");
    } catch {
      mapTextF = "";
    }
    const stillF = rnAllF.filter((rn) => !hasEntryF(rn));
    mapGap = stillF.length === 0 ? "" : "【机械核查未过】Agents/requirement_map.md 仍缺以下要求的对账条目：" + stillF.join("、") + "——最终简报必须如实披露这些要求的未完成/放弃状态，绝不静默。\n";
    log(mapGap === "" ? "要求映射覆盖：补齐后通过" : "要求映射覆盖仍缺 " + stillF.length + " 条——已如实记录，将在最终简报问句中要求披露");
  }
}
let reported = await chief.ask<FinalReport>(
    "老板要求原话（逐字）：" + requirement + (focus ? "；本次关注点：" + focus : "") + "\n" +
    (closingBossNote !== "" ? "【老板反馈（收尾时重读 LoopMail/FromBoss.md）】以下为老板运行中写入、尚无轮次可落实的指令——逐条处置或在邮件「待老板决策」节列明，绝不静默：\n" + closingBossNote + "\n" : "") +
    (clampNote !== "" ? "【轮数钳制】" + clampNote + "——在《最终简报》的待老板决策节列明（确需更多轮，老板用 rounds 参数锁定后重跑）。\n" : "") + mapGap + interruptNote + (interrupted ? "" : roundsTotal + " 轮硬停（或提前完工）。") +
    "以 Agents/requirements.md 与账本为唯一依据，把《最终简报》作为一封新邮件追加到 LoopMail/ToBoss.md 头部（2026-11-05 老板邮件化体系：ToBoss.md＝总工交付邮件正本，新邮件插头部、倒序追加、旧邮件永不删改；docs/＝正式内容如 REPORT.ipynb 与论文本体；正式文件在邮件中以相对链接作附件引用）。老板要的是简报，不是对账（2026-11-05 老板规则）：对账（要求逐条→结果→证据，requirementOutcomes 如实填写，没有条目的要求不算完成）是你的内部事务，只进 Agents/requirement_map.md 与台账（不动测试工程师的验证列），绝不以对账表形式出现在老板邮件正文。邮件写作纪律（2026-11-05 老板原话，硬性）：去冗余的艺术——最少的汇报、最快让老板把握主线和全貌；禁止堆砌黑话（行话首次出现用白话括注）；禁止与事实不符（数字与结论只引用命令输出与产物 manifest）；禁止堆砌代码段与路径指引（证据指针集中一节列，正文不堆路径）。邮件正文=让老板一眼判断产出是不是所要的东西，九节固定：① 一段话进展与结论（做了什么、结果如何、达到老板要求没有；summary 字段）；② 交付清单（deliverables：每个交付物一句话——是什么＋对应老板哪句要求（引用原话 ≤15 字）＋附件链接；历史 AI 文档中值得采纳且有意义的内容在此合并表述）；③ 最终状态（提交/推送/测试/已知局限）；④ 与老板要求相悖的偏离逐条说明（deviations）；⑤ 待老板决策清单（decisionList）；⑥ 待答问题逐条（questionAnswers：问题原文→直接答案→证据位置；问「存在哪」时连形态一起答——是 raw 还是派生格式、有没有写出器）；⑦ 自主决定清单（autonomousDecisions：决定→理由→若否决的后果→奥卡姆自评「增加复杂度还是删减」；凡增加复杂度的决定必须进这一节，不能只写账本）；⑧ 遗留与否决固定小节（deferred/declined，各带理由——记录在案的延后是决策而非遗漏，被否决的想法不得下轮重新提案；deferred/declined/processLessons 字段如实填写，无则空数组）；⑨ 流程教训（每条=规则+为什么+适用范围；老板采纳的教训持久化并随下次运行加载，被证伪的教训标记废弃、不与新教训并存；加载时先对照当前仓库核实仍适用）+一句建议。邮件是决策层文档：不写过程流水账（第几次门禁通过、反驳几次、返修几轮——那些在账本）、每节开头一句结论、同一条要求只说一次、以 ≤2 页为目标。收尾清理（2026-11-05 老板规则，硬性；先全仓盘点历史冗余——包括此前各轮与各次运行遗留的——再动手，不只整理本轮产物）：① 凡非最终产出需要的代码与文档（实验脚本、被替换的实现版本、草稿与中间报告等历史冗余，包括代码和文档）→ 直接 git mv 进 Agents/；② AI 生成且已成历史的文档 → 只把值得采纳且有意义的内容并入 ToBoss 最新邮件的交付清单表述，文档本体算作历史冗余 git mv 进 Agents/；③ docs/ 只保留正式内容（老板原话提及的交付物本体），仓库根与 docs/ 不堆工作文件；④ LoopMail/FromBoss.md（老板写入）原样保留、绝不改动老板写下的内容；⑤ LoopMail/ 下异于 ToBoss.md/FromBoss.md 的文件逐一判定归属——老板放置的文件名加前缀 FromBoss_ 并原样保留，agent 自己散落的按①②归位，拿不准的一律按老板放置处理；全程绝不删除文件。git add -A && git commit，返回 FinalReport。",
);
// 疑问句防蒸发（机械）：老板原话含疑问而汇报没有答案即视为漏需求——补答一次，仍缺则如实记录
const askedQ = ((requirement + " " + focus + " " + closingBossNote).match(/？|\?/g) || []).length;
if (askedQ > 0 && (!reported.questionAnswers || reported.questionAnswers.length === 0)) {
  reported = await chief.ask<FinalReport>(
    "老板要求原话（逐字）：" + requirement + (focus ? "；本次关注点：" + focus : "") + "\n老板原话含 " + askedQ + " 处疑问，但 FinalReport.questionAnswers 为空——疑问句在登记环节蒸发属漏需求。逐条补答（问题原文→直接答案，含形态：是 raw 还是派生格式、有没有写出器→证据位置；确实无法作答的写「无法作答：原因」），写回 LoopMail/ToBoss.md 最新邮件并 git add -A && git commit --amend --no-edit，返回完整 FinalReport。",
  );
  if (!reported.questionAnswers || reported.questionAnswers.length === 0) log("汇报仍缺待答问题（已如实记录，老板原话含 " + askedQ + " 处疑问）");
}
// 最终简报提交由编排器推送并核验（收尾问句不再指示推送；存在未过门禁提交时不推送）
let finalPush = push0.target === "" ? "跳过推送：" + push0.note : (branch === "" ? "未推送：detached HEAD，分支不确定（如实记录）" : (ungatedHead ? "未推送：存在未过门禁的提交（如实记录）" : "未推送"));
if (push0.target !== "" && branch !== "") {
  if (!ungatedHead) {
    const headFinal = await HEAD0();
    try {
      const pf = await G(["push", push0.target, "HEAD:" + branch], 300000);
      if (pf.exitCode === 0) {
        try {
          const lf = await G(["ls-remote", push0.target, "refs/heads/" + branch]);
          const rhf = ((lf.stdout || "").split("\t")[0] || "").trim();
          finalPush = rhf === headFinal && headFinal !== "" ? "已推送并核验（" + headFinal.slice(0, 7) + "）" : "推送核验失败（如实上报：remote=" + rhf.slice(0, 7) + "）";
        } catch {
          finalPush = "推送已执行，落盘核验不可用（如实记录）";
        }
      } else {
        finalPush = "推送退出码 " + pf.exitCode + "（如实记录：" + maskUrl((pf.stderr || "")).slice(0, 200) + "）";
      }
    } catch {
      finalPush = "推送未启动（如实记录）";
    }
  }
  log("最终简报推送：" + finalPush);
}
const md = [
  "# 最终简报",
  "",
  "正本：LoopMail/ToBoss.md 最新邮件（本件为随运行的投递副本）",
  "",
  "老板要求（原话）：" + requirement,
  "",
  "## 进展与结论",
  (reported.summary || ""),
  "",
  "## 产出清单",
  ...(reported.deliverables || []).map((d) => "- **" + d.artifact + "**（回应老板：「" + d.addresses + "」）→ " + d.location),
  "",
  "## 最终状态",
  reported.state,
  "",
  "## 偏离说明",
  (reported.deviations || []).length > 0 ? (reported.deviations || []).map((d) => "- " + d) : "- 无：未发生与老板要求相悖的偏离",
  "",
  "## 待老板决策",
  ...(reported.decisionList || []).map((d) => "- " + d),
  "",
  "## 你的问题，答案在这里",
  (reported.questionAnswers && reported.questionAnswers.length > 0) ? reported.questionAnswers.map((x) => "- 「" + x.q + "」→ " + x.a + "（证据：" + x.evidence + "）") : ["- 无（本次要求中没有疑问句）"],
  "",
  "## 自主决定清单（请裁决是否保留）",
  (reported.autonomousDecisions && reported.autonomousDecisions.length > 0) ? reported.autonomousDecisions.map((x) => "- " + x.decision + "｜理由：" + x.reason + "｜若否决：" + x.ifRejected + "｜奥卡姆：" + x.occam) : ["- 无"],
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
  "判定：" + reported.verdict + "；已执行轮数：" + rows.length + "。逐条对账（原话→结果→证据）是内部事务，在 Agents/requirement_map.md 与账本。",
].join("\n");
await artifact.markdown("report", md, { title: "最终简报（投递副本）", description: "正本在 LoopMail/ToBoss.md 最新邮件；进展结论 + 产出清单 + 待决策清单", primary: true });

return {
  conclusion: reported.advice,
  verdict: reported.verdict,
  rounds_completed: rows.length,
  requirement_coverage: (reported.requirementOutcomes || []).length,
  deviations: (reported.deviations || []).length,
  next_action: (reported.decisionList || []).length > 0 ? "待老板决策：" + reported.decisionList[0] : "交付完成，等待老板验收",
};
