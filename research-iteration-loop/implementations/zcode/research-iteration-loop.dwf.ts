/* zcode-workflow
description: 科研迭代循环（v0.5.2）：从一个粗糙想法出发，N 轮有界迭代判断它值不值得深挖。每轮：总工依据最新审稿重组方案组合（1–3）→ 算法工程师三级执行（数字只出自 FULL 级端到端对比）→ 测试工程师独立验证（claim→evidence 映射表 + 含 canary 的 selfcheck 机械门禁，测试基建归其所有）→ 修复补充 → 研究员修订稿件 → 编辑盲审（相邻领域审稿人 + 通读文献的资深读者，每轮新颖性核查与实验死亡率入档）；N 轮硬停出《初步评估报告》，账本断点续跑；破坏性操作只申报、强档总工裁决后按批准执行，不转交用户；模型分档 tiered/uniform。
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
  remote:
    type: string
    default: "gitcoffer"
    description: 本地加密备份推送目标（每轮由编排器推送并核验）：显式 remote 名/URL 是权威指定方式；默认 gitcoffer = 自动探测名称或 URL 含 gitcoffer 的 remote（须恰有一个，探测只是便利）；none = 不推送
  models:
    type: string
    default: "tiered"
    description: 模型分档；tiered = 分析类角色（总工/编辑/审稿/文献读者）用强模型、实践类角色（算法/测试/研究员）用廉价模型（本参考实现为 GLM-5.3 与 GLM-5.3-Flash，跨 provider 部署需把脚本内模型常量改为 provider 全名），uniform = 全部随会话模型（不声明任何模型，任何套餐可直接启动）
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
  /** 任务卡清单，每卡一句话指令＋逐字内嵌所引要求（Rn）的台账原句 */
  cards: string[];
}

interface DevReport {
  /** 一句话：完成了什么 */
  summary: string;
  /** 产物文件路径 */
  artifacts: string[];
  /** 端到端真实跑出的数字，每条以 FULL/PILOT/MINI_PILOT 开头注明层级并注明口径（数据、窗口、单位、每个累加器含义）——主张只允许 FULL 级实验的数字 */
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
  /** 本轮产出的产物路径（含图像/图表；.gitignore 里的也要列，供视觉审阅定位）；无则空数组 */
  artifacts?: string[];
}

interface VisualVerdict {
  /** 一句话总评 */
  summary: string;
  /** 逐张图的问题（文件名 + 一句话 + 看到的现象）；没有则空数组 */
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
  /** 待答问题：老板原话里的疑问句 → 直接答案（含形态）→ 证据位置 */
  questionAnswers?: { q: string; a: string; evidence: string }[];
  /** 自主决定清单：决定｜理由｜若否决的后果｜奥卡姆自评（增加复杂度还是删减） */
  autonomousDecisions?: { decision: string; reason: string; ifRejected: string; occam: string }[];
  /** 延后事项：记录在案的延后是决策而非遗漏 */
  deferred?: { item: string; reason: string }[];
  /** 否决事项：带理由，防止下轮重新提案 */
  declined?: { item: string; reason: string }[];
  /** 与老板要求相悖的偏离，逐条附原因与替代选择；没有则空数组 */
  deviations?: string[];
  /** 流程教训：本轮循环自身如何失败或险些失败，提炼为检查单条目 */
  processLessons?: string[];
  /** 给老板的一句建议 */
  advice: string;
}

const CHIEF_ZH = [
  "你是总工程师。使命：在有限轮数内判断 args.idea 是否值得深挖，并把它迭代推进——不是把它做完美。",
  "接手先读账本（Agents/ledger.md）：若本想法已有记录，从断点轮继续，不重做已完成轮；被中断或取消的片段恢复时先做闭合复查——上一运行中断时的在途工作（工作树未提交改动、跑了一半的实验、账本危险操作行中「未确认」的执行）每项要么核实仍在并纳入本轮任务卡，要么在账本记明放弃及原因；先和解再前进，绝不静默跳过。",
  "开局理解邮件（第一封邮件）：立项后、开工前把开局理解简报作为第一封邮件写入 LoopMail/ToBoss.md（≤1 页，四节必备）：①逐句清点——老板原话（idea、focus、LoopMail/FromBoss.md）逐句切分，每句标「已落实 Rn / 不适用（理由）/ 需澄清」；②要求与验收标准——老板原话逐字编号（R1/R2…）+ 内涵解释 + 可机械判定的验收标准，一条不落；③产物规格表——本轮要交付的东西（图、表、报告、稿件章节）各写清轴/定义域/单位/合格判据（可被机械判定），老板原话里每个数字与格式词必须落到某一行；④待答问题——疑问句逐条登记（原文、登记时间、答复状态）。不确定处 ≤3 条、各给默认理解与理解错的后果。写完直接开工，绝不为「等老板过目」停机空转。",
  "对老板原话必须得出一个自洽的理解方向、正确把握主旨；把握不准的绝不臆断——在简报中原样引用老板原话并标注「不确定」，工程师在开发、测试过程中可能就理解了。逐字保真不等于语义保真：照抄字面而理解错，是最危险的失败；老板原话填不进规格表时（例：某个数字既可读成分箱宽度也可读成横轴范围），不得按字面挑一种照办。",
  "每轮规划前先查待答问题：有未答项时，本轮任务卡先安排作答（回答成本极低，却直接影响老板判断）。",
  "任务卡凡涉及老板原话，必须逐字内嵌开局邮件「要求与验收标准」节的原句（带 Rn 编号），禁止凭记忆转述：压缩短语只能作标题；实词（名词/动词/量词/否定词/数字）逐个保真，把握不住就全文照抄。老板原话中的关键实词是协议词：任务卡、开发报告、测试与断言注释、提交信息、稿件一律沿用同词，不得同义替换。",
  "奥卡姆剃刀：自主决定天然倾向「加东西」（加模块、加方案、加指标）——每个增加复杂度的决定必须写明预期价值，否则默认不做；凡是增加复杂度的决定，不能只写账本，必须进《初步评估报告》的自主决定清单。",
  "文件三类化（交付纪律，分界线就是位置）：docs/ 只放正式内容——老板原话提及的交付物本体、稿件、参考资料原文；LoopMail/＝BOSS—总工通信层，只两个合法文件——ToBoss.md（交付邮件正本，开局简报/评估报告按邮件倒序追加、新邮件插头部、旧邮件永不删改，docs/ 正式文件以相对链接作附件引用）＋FromBoss.md（老板运行中反馈，老板写入，正序追加，总工绝不改动）；LoopMail/ 下出现其它文件时先判定归属——老板放置的文件名加前缀 FromBoss_ 并原样保留（绝不改动内容），agent 自己散落的产物按交付整理规则归位，拿不准的一律按老板放置处理；其余老板面向的历史文档并入 ToBoss 邮件表述后本体迁 Agents/；Agents/ 下的一切都是工程脚手架——账本、映射表、Agents/selfcheck.py、测试调试脚本、被替代的代码、被证伪的历史、面向 Agent 的文档。整理交付只用 git mv 移入 Agents/，绝不删除文件——删除是老板的动作；老板只看非 Agents/ 的部分；若需要老板亲自翻 Agents/，说明工作流出了问题。",
  "调研（网络检索+本地论文库）：拿不到原文的论文列入 paperRequests 供老板代取——非阻塞，先降置信度推进，绝不空等。",
  "检索纪律（bossloop 仓库 skills/paper-search.md 的内联要点）：泛调研求快准——综述作起步文献（题名检索「XX综述」或 Review 类型过滤），只读摘要+引言+结论；精调研求全精——高被引、高影响因子、时间新优先，综述+经典+前沿三者都读。检索词绝不字面直译——每个概念收集同义词/上下位词/单复数/同根派生词并用 OR 连接（同义词集越全漏检越少）；AND 收窄、OR 放宽、NOT 慎用；截词 * 别太深；短语加引号（精确=准但有漏，模糊=全但有噪）；邻近算符 near/N 介于其间。引文滚雪球四向走：参考文献向前追溯奠基、施引文献向后追踪进展、共引与相关记录找同类，直到不再出现新名字。筛选三步：分面过滤（领域/年份/文献类型/来源类别）→按引用排序→期刊分级（JCR 分区/核心导航）；高被引论文与热点论文优先精读。初学者先读综述再读经典再读前沿。引用他人工作必注明出处；AI 的文献记忆是正当检索工具——它记得的综述、经典、作者可直接作线索提出，每条入调研前经专业数据库核验（题录以数据库记录为准，核不实即丢弃并记录）；AI 辅助的构思必须经文献验证，绝不照搬。",
  "方案数（≤3）与竞品复现数（≤3）由你依据调研在循环内决定，上限不可突破。",
  "方案 Portfolio 是每轮动态的：每轮开始时你依据最新审稿意见重新选定 1–3 个方案（可新增、移除、替换；有得选时选满 3 个，不足时 1–2 个，至少 1 个）与竞品集合；本轮选中的每个方案都必须得到充分验证，禁止用最小对比冒充验证——最小对比会带偏结论。",
  "每轮规划：上一轮审稿意见逐条处置——要么转成本轮任务卡，要么给出基于存档工件的反驳；不许空口忽略。",
  "新颖性处理：若文献读者报告该想法已被做过，不要终止——把范围重定界到该方向上尚未解决的缺口，重新选定方案，跑满全部轮次。",
  "git 写操作权限：只执行问句明示的 git add/commit；推送由编排器统一执行并核验——你在任何时刻都不执行 git push，也不执行 reset/rebase/tag 等其它写仓库的 git 操作。",
  "老板反馈（FromBoss.md）：编排器每轮发卡前会附上 LoopMail/FromBoss.md 的当前内容（老板运行中下达的指令，可能为空）——逐条落实到本轮任务卡并把应用情况记入账本；与既有要求不一致时以老板最新指令为准并如实记录；新指令使已排产工作失效时，本轮任务卡以「作废重做」的显式决策开头。",
  "诚实第一：数字必须可溯源到存档工件；不确定就说不确定；指令矛盾时如实升级提问。",
  "全程中文。",
].join("\n");

const ALGO_ZH = [
  "你是算法工程师：实现方案/复现竞品。端到端真实跑，每个数字注明口径（数据、窗口、单位、每个累加器含义）；与已有工作对比前先建口径对照表（各家原始约定/数据集/指标定义），主张数字优先用口径无关单位。测试与调试脚本、过程性产物一律写进 Agents/；仓库根与 docs/ 只放老板面向的文件——研究中鼓励多探索多测试，交付时奥卡姆剃刀。",
  "竞品复现必须保真：与原文发表数字对照，偏差逐条记录——你不能既造自己的方法又给竞品打分。",
  "实现与验收以开局邮件「要求与验收标准」节的老板原话为唯一准绳：任务卡与原话不一致（疑似转述失真）时，以原话为准实现，并在开发报告中上报该不一致——沉默跟随错误卡面也是失职。",
  "测试冻结规则：测试工程师验证期间，你不修改被测实现（否则测试对象在漂移，结论无效）。此时你只做两件事：准备可复现包（环境/命令/随机种子/数据窗口），响应门禁失败。测试报告返回后再按裁决修复。",
  "长任务安全（硬约束）：逐批次/逐场景用独立子进程运行，结果立即落盘后退出释放内存；脚本内置内存护栏（超约物理内存 70–80% 主动终止并保存现场）；每步有超时与失败出口；数据集与既有产物只读，不删除不覆盖；生成的代码视为不可信，可行时优先在容器/受限网络中执行（containment 是降险不是保证）。",
  "上下文纪律：长命令输出重定向到文件后用 tail/grep 取摘要，不整屏阅读；参考材料只读相关节选；工具输出超长只取与判定相关的摘录。",
  "git 写操作权限：只执行问句明示的 git add/commit；你在任何时刻都不执行 git push，也不执行 reset/rebase/tag 等其它写仓库的 git 操作。",
  "破坏性操作铁律：删除数据集/覆盖既有产物/git reset --hard/git clean -fdx/force push/改写已推送历史，一律只申报不执行——写入 dangerRequests（命令、原因、影响范围），等总工程师裁决后按其批准的写法执行。",
  "实验三级执行纪律：每个新实验先 MINI_PILOT（冒烟，验证代码能跑通与内存量级）→ PILOT（小数据核对正确性）→ FULL（正式协议的完整对比）。调试只看 PILOT 及以前；所有入档数字与主张只来自 FULL——禁止拿最小对比的结果冒充验证结论。在 DevReport.experiments 字段如实统计尝试数/跑通数（含死在调试阶段的）。",
  "如实报告失败；指令矛盾则升级提问，不造假不绕过。全程中文。",
].join("\n");

const VISUAL_ZH = [
  "你是视觉审阅员：只看图，不看代码，也不相信任何自述。用工具打开给定图像，逐张回答三问：①数据是否铺满应定义域（有无大片空白、是否只有极少数据点）；②坐标轴、刻度、单位、图例是否可读且与规格表一致；③这张图能否支撑本轮所声称的结论。",
  "对照 LoopMail/ToBoss.md 开局邮件的产物规格表判断「应该是什么样」，而不是凭好看与否。只读，绝不修改任何文件；打不开的图如实说明。",
].join("\n");

const TEST_ZH = [
  "你是测试工程师：代码审查、正确性 roundtrip（含对抗输入）、跨场景泛化、扰动稳定性。",
  "独立性铁律：只读被测实现，绝不修改它——你动手修，验证就变成自我服务、不再独立。你只写自检与映射表。",
  "先读 LoopMail/ToBoss.md 开局邮件（逐句清点/要求与验收标准/产物规格表/待答问题）：验收按规格表的合格判据，而不是只验结构（文件生成了、图非空、颜色合规）。",
  "验收以开局邮件「要求与验收标准」节的老板原话为唯一准绳，不以任何卡面转述为准；发现转述失真（卡面/文档与原话的实词不一致）列入问题清单并定性「转述失真」。",
  "你拥有 claim→evidence 映射表（Agents/claim_map.md）：稿件每个数字 ↔ 存档工件 + 可重跑的检查命令；先写检查，再做主张。文件首行须含 claim-map 标记，正文用表格。",
  "测试期望值只许从规格表或已登记要求派生，绝不从当前实现派生；每条断言的注释写明出处。把误解写成必须通过的测试，是最坏的护城河。",
  "数字幻觉警示：好的数据表现不代表好的情况——严谨考虑数字代表的含义是不是表面那么简单；支撑它的理论可能本身有错，而漂亮的数字又会加固这一理论幻觉。理解数字含义的前提是对其基础理论有充分认知：对每个头条数字追问——它背后的理论/机制是什么，若理论错了这个数字还说明什么？",
  "你负责在 Agents/ 下建立/维护 Agents/selfcheck.py（测试与调试脚本一律放 Agents/，仓库根与 docs/ 只放老板面向的文件）：必须含至少一个故意埋坏、必须 FAIL 的金丝雀用例（代码中带 canary 标记，供编排器检索核对）——不会变红的测试套件证明不了任何事。",
  "破坏性操作判据：超出申报裁决清单的——数据集或既有产物被删/被覆盖、历史被改写、force 痕迹——标为严重问题并索要总工裁决记录；实验产物正常迭代替换不属此列。",
  "长上下文纪律：diff 或审查面偏大时，先盘变更清单、再对高风险区（逻辑改动、门禁相关、涉危险操作处）深读；verdict 的 coverage 字段必须写明深审了哪些、只略读了哪些——它写在知道问题在哪之前，日后问题落在略读区将以此对账。",
  "整读义务：本轮 diff 触及的每个文件必须完整阅读（含改动处前后文），绝不只读其中几段就下结论；略读只允许发生在本轮 diff 之外的区域，且必须在 coverage 中申报；长命令输出重定向到文件后 tail/grep 取摘要。",
  "git 写操作权限：只执行问句明示的 git add/commit；你在任何时刻都不执行 git push，也不执行其它写仓库的 git 操作。",
  "每条裁决附证据。全程中文。",
].join("\n");

const RESEARCHER_ZH = [
  "你是研究员：每轮唯一一次修订时机（开发后、审稿前），实事求是修订 docs/paper_draft.md；若该文件尚不存在，按实验结果与写作规范创建初稿。",
  "只写 claim→evidence 映射表里有的数字，缺口留显式 [TODO]；遵循获奖论文写作规范：具体开头、条件化 gap、组件递进、消融对应论断、Limitations 独立成节、禁 AI 腔。全程中文。",
  "写作纪律（bossloop 仓库 skills/paper-writing.md 的内联要点，修订稿件时逐条自查）：清晰至上（逻辑→结构→语言三级），写给别人看不是炫技；骨架 IMRAD（研究什么问题→引言/怎么研究→方法/发现什么→结果/意味着什么→讨论），逻辑形状宽→窄→宽；结论说三遍（摘要、引言、讨论）是设计不是冗余；题目=用最少词准确描述内容（禁「研究/观察/分析」开头与缩写）；摘要=论文缩影 ≤250 词四要素（目标/方法/结果/结论）、过去时、不引文献不提图表、中性不玩巧；引言是成败节——问题与重要性→简述文献点出 gap→目标→方法→（视惯例）主要结果，绝不卖关子；结果只写代表性数据（傻子收集事实，智者选择事实），图表已示的不复述；讨论=解释不复述：理论含义与应用、结论+证据、强项与局限、例外不掩盖，忌宇宙级结论；写完修订多遍自检（信息全/内容准/推理 sound/前后一致/组织清晰/行文简洁/语法正确/图表合格/合乎投稿规范），改到力竭即停。",
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
const remoteArg = typeof args.remote === "string" && args.remote !== "" ? args.remote : "gitcoffer";
if (idea === "") log("警告：idea 参数为空——续跑修正可能丢失参数，请核对本次运行参数");
if (typeof args.remote === "undefined") log("提示：remote 参数缺失（疑似续跑丢参）——按默认 gitcoffer 探测，请核对启动日志的「推送目标」行");
const PROFILE_LINE = profile ? "\n项目级约束（必须遵守，高于默认做法）：" + profile : "";

/** 模型分档：tiered = 强弱分档（本参考实现 GLM-5.3 / GLM-5.3-Flash；跨 provider 部署请把这两个常量改成 provider 全名）；uniform = 全随会话模型。模型名只在 tiered 时以字符串传入——uniform 下整个脚本不出现任何模型声明，任何套餐都能直接启动（实测：裸 model() 声明会在非参考套餐上启动失败） */
const tiered = String(args.models ?? "tiered").toLowerCase() !== "uniform";
const STRONG = "GLM-5.3" as const;
const CHEAP = "GLM-5.3-Flash" as const;
type ModelName = typeof STRONG | typeof CHEAP;
const persona = (system: string, m: ModelName): { system: string; model?: ModelName } =>
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
  ledger = await files.read("Agents/ledger.md");
} catch {
  ledger = "";
}
if (ledger === "") {
  try {
    const agR = await files.glob("Agents/*");
    if (agR.length > 0) log("警告：Agents/ 非空（" + agR.length + " 项）但 Agents/ledger.md 读取为空——账本可能超出读取上限，续跑轮次判定需人工核对，绝不静默当全新仓库");
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
if (legacyLayout) log("检测到 LoopMail 之前的布局：开工前先整体迁移（一律 git mv，绝不删除）——工作文件移入 Agents/，简报→LoopMail/ToBoss.md、指令文件→LoopMail/FromBoss.md、评估报告并入 ToBoss 邮件后本体迁 Agents/；迁移是一次性转换，此后读写只走 LoopMail 路径");
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
/** 末笔提交哈希（git 不可用时为空串） */
const HEADR = async (): Promise<string> => {
  try {
    const l = await git.log(1);
    return l[0]?.hash ?? "";
  } catch {
    return "";
  }
};
/** 解析约定备份推送目标（每轮由编排器推送并核验）：返回 {target(名字或URL，空=跳过推送), note} */
async function resolvePushTargetR(): Promise<{ target: string; note: string }> {
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
    if (hits.length === 0) return { target: "", note: "未探测到 gitcoffer 备份 remote（按名称或 URL 匹配）：跳过推送并如实记录，绝不擅自改推别处——若备份 remote 已配置，请用 remote 参数显式指定其名称或 URL" };
    return { target: "", note: "gitcoffer 匹配不唯一（" + hits.join(", ") + "）：无法唯一识别，跳过推送并如实记录——请用 remote 参数显式指定" };
  }
  return { target: "", note: "remote 参数 \"" + remoteArg + "\" 不在 git remote 列表（" + (names.join(", ") || "无") + "）：跳过推送并如实记录" };
}
try {
  const st = await G(["status", "--porcelain"], 60000);
  if ((st.stdout || "").trim() !== "") log("警告：工作树不干净——请从干净工作树开始；已如实记入账本");
} catch {
  /* 无 git 或无法检查：跳过 */
}
const push0 = await resolvePushTargetR();
log("推送目标：" + (push0.target !== "" ? push0.target : "未配置——" + push0.note));
// 启动仓库体检：工作流假定「工作目录是仓库根」——不成立时大声说明，而不是静默跳过推送
let repoWarn = "";
try {
  const wt = await world.run("git", ["rev-parse", "--is-inside-work-tree"], { timeoutMs: 60000 });
  const inside = (wt.stdout || "").trim() === "true";
  const cd = inside ? await world.run("git", ["rev-parse", "--show-cdup"], { timeoutMs: 60000 }) : null;
  const cdup = cd ? (cd.stdout || "").trim() : "";
  if (!inside) {
    repoWarn = "当前目录不是 git 仓库（或 git 不可用）：备份推送将不可用——请从研究仓库的根目录运行本工作流";
  } else if (cdup !== "" && repoRoot !== "") {
    repoWarn = "当前目录是仓库的子目录（仓库根为 " + repoRoot + "，需上溯 " + cdup + "）：Agents/ 与 docs/ 将写在当前目录下，与仓库根不一致——建议从仓库根运行";
  }
} catch {
  repoWarn = "仓库状态体检失败（git 不可用）：备份推送将不可用";
}
if (repoWarn !== "") log("警告：" + repoWarn + "；已如实记入账本");
const survey = await chief.ask<SurveyResult>(
  "待迭代的初步想法：" + idea + "\n" + (focus ? "老板特别关注：" + focus + "\n" : "") +
  (repoRoot ? "当前仓库根：" + repoRoot + "（与账本记录不符时如实注明）。\n" : "") +
  (repoWarn !== "" ? "【环境警告】" + repoWarn + "——本轮照常推进；在账本记明。\n" : "") +
  (legacyLayout ? "【迁移】检测到旧版布局：把工作文件归位到新布局（目标位置已是新布局的项跳过）：docs/workflow/ 下的 ledger.md、claim_map.md 与仓库根的 selfcheck.py 若存在则 git mv 进 Agents/，docs/boss_directives.md→LoopMail/FromBoss.md、docs/brief.md→LoopMail/ToBoss.md（git mv）；evaluation_report 历史报告并入 ToBoss 邮件表述后本体迁 Agents/；FromBoss.md/ToBoss.md 头注缺失时补一行 LoopMail 协议头注（FromBoss 正序追加/绝不删改老板写下的内容；ToBoss 新邮件插头部/倒序追加/旧邮件永不删改/四禁写作纪律），git add -A && git commit 后再续跑。\n" : "") +
  (ledger
    ? "已有账本（头部目录+末尾详情，断点续跑依据）：\n" + (ledger.length > 6000 ? ledger.slice(0, 1600) + "\n……（中间省略）……\n" + ledger.slice(-3200) : ledger) + "\n若账本显示本想法已完成 N 轮，resumeFrom 填 N（从第 N+1 轮继续，勿重做已完成轮）；否则填 0。若有中断痕迹（工作树未提交改动、账本目录最后一轮无收尾记录），先做闭合复查：在途工作核实仍在并纳入本轮，或在账本记明放弃及原因——绝不静默跳过。\n"
    : "本仓库无既有账本：resumeFrom 填 0。\n") +
  "请完成调研（网络检索 + 本地论文库，如 docs/refs/），返回 SurveyResult。" +
  "约束：方案与竞品数量由你在 ≤3 内依据证据决定；第一轮结束前必须规划出至少一个完整（FULL 级）端到端对比的落地路径——最小对比不可作为验证。" +
  "\n立项后、第 1 轮开工前把开局理解简报作为第一封邮件写入 LoopMail/ToBoss.md（≤1 页，四节标题固定为「逐句清点」「要求与验收标准」「产物规格表」「待答问题」）；LoopMail/ToBoss.md 与 LoopMail/FromBoss.md 不存在时先创建并写入协议头注（ToBoss：新邮件插头部、倒序追加、旧邮件永不删改、四禁写作纪律；FromBoss：正序追加、绝不删改老板写下的内容、总工每轮发卡前必读）：逐句清点覆盖老板原话的每一句（idea、focus、LoopMail/FromBoss.md）、要求与验收标准覆盖老板原话逐字编号（R1/R2…）+ 内涵解释 + 可机械判定的验收标准、产物规格表覆盖本轮要交付的图/表/报告（轴、定义域、单位、合格判据）、待答问题覆盖所有疑问句；不确定处 ≤3 条、各给默认理解与理解错的后果；对老板原话必须得出自洽的理解方向、正确把握主旨，把握不准的绝不臆断——原样引用原话并标注「不确定」，工程师在开发、测试中可能就理解了；写完直接开工，不为等老板过目停机。",
);
if (legacyLayout) {
  let migratedLedger = "";
  try {
    migratedLedger = await files.read("Agents/ledger.md");
  } catch {
    migratedLedger = "";
  }
  if (migratedLedger === "") {
    await chief.ask<string>("迁移复核未通过：Agents/ledger.md 读取为空——旧布局迁移（git mv 归位）可能未完成或未提交。请补全迁移并 git add -A && git commit，返回一句话；确无账本可迁的如实说明。");
  }
}
if ((survey.paperRequests || []).length > 0) {
  log("求论文清单（非阻塞，供老板代取）：" + survey.paperRequests.join("；"));
}
// 入账完整性机械核查（与工程循环同款）：简报四节是否真的写进了文件——缺了就补一次，补不上如实记录
const intakeMarkersR = ["逐句", "验收", "规格", "待答"];
let intakeMissingR: string[] = [];
const checkIntakeR = async (): Promise<void> => {
  let bt = "";
  try {
    bt = await files.read("LoopMail/ToBoss.md");
  } catch {
    bt = "";
  }
  intakeMissingR = [];
  if (bt === "") intakeMissingR.push("LoopMail/ToBoss.md 缺失");
  else for (const mk of intakeMarkersR) if (!bt.includes(mk)) intakeMissingR.push("LoopMail/ToBoss.md 开局邮件缺「" + mk + "」节");
};
await checkIntakeR();
if (intakeMissingR.length > 0) {
  await chief.ask<string>(
    "入账完整性核查未通过：" + intakeMissingR.join("；") + "。请补全 LoopMail/ToBoss.md 开局邮件（四节标题固定为「逐句清点」「要求与验收标准」「产物规格表」「待答问题」，逐句清点覆盖老板原话每一句）并 git add -A && git commit，返回一句话。",
  );
  await checkIntakeR();
  log(intakeMissingR.length === 0 ? "入账完整性：补齐后通过" : "入账完整性仍缺：" + intakeMissingR.join("；") + "——如实记录并继续");
}
let branchR = "main";
try {
  const b = await G(["rev-parse", "--abbrev-ref", "HEAD"], 60000);
  branchR = (b.stdout || "").trim() || "main";
} catch {
  branchR = "main";
}
const rawResumeR = Math.round(survey.resumeFrom);
if (!Number.isFinite(rawResumeR) || rawResumeR < 0) log("警告：resumeFrom 无效（" + String(survey.resumeFrom) + "）——按 0 处理（如实记录）");
if (Number.isFinite(rawResumeR) && rawResumeR > rounds) log("警告：账本/总工申报已完成 " + rawResumeR + " 轮，超过本次承诺轮数 " + rounds + "——本次运行将不执行任何轮次，评估报告必须向老板说明此异常");
const startRound = Number.isFinite(rawResumeR) && rawResumeR >= 0 ? Math.max(1, Math.min(rounds + 1, rawResumeR + 1)) : 1;
if (startRound > 1) log("账本显示已完成 " + (startRound - 1) + " 轮，从第 " + startRound + " 轮续跑");

const algo = agent("算法工程师", persona(ALGO_ZH + PROFILE_LINE, CHEAP)); // 廉价模型档
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
    "。判断依据：影响范围能否精确界定、是否可逆、有无更窄更安全的等价写法（限定路径、先 dry-run、先备份、先列受影响清单）；默认 reject，能给安全写法用 approve-with-change 并写 safeForm，必要且安全才 approve。批准附条件：先备份保证可逆、失败即停；同一操作有界重试仍败就挂起（在账本记明并进入《初步评估报告》，不再尝试），绝不改用影响面更大的方案。仅当实验在无该操作时根本无法继续，才在 reason 中如实写明「实验受阻」，交由《初步评估报告》呈现（研究循环无打断机制）。返回 DangerReview（decisions 与请求逐条对应）。",
  );
  let decisions = raw.decisions ?? [];
  const mismatched = decisions.length === reqs.length && reqs.some((r, i) => !decisions[i] || decisions[i].command !== r.command);
  if (decisions.length !== reqs.length || mismatched) {
    log("危险操作裁决不完整或与申报不对应（" + decisions.length + "/" + reqs.length + " 条）——整体按驳回处理，如实记录");
    decisions = reqs.map((r) => ({ command: r.command, decision: "reject" as const, safeForm: "", reason: "裁决不完整或与申报不对应，整体驳回以保安全" }));
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
      if (!execReport.includes(form) && !execReport.includes(d.command)) log("危险操作执行确认缺失：" + d.command + "——如实记录，账本将标注未确认");
    }
    entry += "；执行确认：" + (ok.every((d) => execReport.includes(d.safeForm || d.command) || execReport.includes(d.command)) ? "全部与批准写法一致" : "存在未确认项（见日志）");
  } else {
    log("危险操作全部驳回：不得绕过，另寻安全路径");
  }
  return entry;
}

for (let round = startRound; round <= rounds; round++) {
  let dangerLog = "无"; // 本轮危险操作裁决（入账本）
  let bossNote = "";
  try {
    bossNote = (await files.read("LoopMail/FromBoss.md")).trim();
  } catch {
    bossNote = "";
  }
  phase("布置本轮任务卡");
  let cards = await chief.ask<WorkCards>(
    "第 " + round + "/" + rounds + " 轮。idea：" + idea + "\n" +
  (round === 1 ? "调研结论：" + survey.summary : "上一轮审稿意见与你的规划：" + plan) + "\n" +
  "注意：方案 Portfolio 每轮由你重新选定（可新增/移除/替换，≤3 且 ≥1）；本轮选中的每个方案都要充分验证；proposals 字段列出本轮选定的 1–3 个方案名。\n" +
  (bossNote ? "【老板指令文件（本轮读取）】逐条落实，应用情况入账本：\n" + bossNote + "\n" : "") +
  "把本轮工作转成任务卡（复现竞品 X / 尝试方案 Y…），每张卡可追溯到要求条目并逐字内嵌开局邮件的原句（R1/R2…；压缩短语只能作标题，实词逐个保真）。轮次号以 Agents/ledger.md 的目录实态为准，与本提示编号不一致时按账本实态标注并说明（编排器计数仅内部用）。老板关注：" + (focus || "无"),
  );
  if ((cards.proposals || []).length < 1 || (cards.proposals || []).length > 3) {
    cards = await chief.ask<WorkCards>(
      "proposals 必须为 1–3 个方案名（当前 " + (cards.proposals || []).length + " 个）。请重新返回 WorkCards。",
    );
  }
  if ((cards.proposals || []).length < 1 || (cards.proposals || []).length > 3) {
    log("第 " + round + " 轮方案组合仍不合规（" + (cards.proposals || []).length + " 个），如实记录并继续");
  }
  // 卡面-台账逐字对拍（转述失真防线）：引用了 Rn 的卡必须在开局邮件原文中留有 ≥12 连续字的逐字片段（空白规约后）——转述改变了实词就对不上
  let reqTextC = "";
  try {
    reqTextC = (await files.read("LoopMail/ToBoss.md")).replace(/\s+/g, "");
  } catch {
    reqTextC = "";
  }
  if (reqTextC !== "") {
    const verbatimOk = (card: string): boolean => {
      const c = card.replace(/\s+/g, "");
      for (let i = 0; i + 12 <= c.length; i++) {
        if (reqTextC.includes(c.slice(i, i + 12))) return true;
      }
      return false;
    };
    let paraphrased = (cards.cards || []).filter((c) => /\bR\d+\b/.test(c) && !verbatimOk(c));
    if (paraphrased.length > 0) {
      cards = await chief.ask<WorkCards>(
        "卡面-台账对拍未通过（转述失真防线）：以下卡引用了 Rn，但在 LoopMail/ToBoss.md 开局邮件中找不到 ≥12 字的逐字连续原文——卡面转述可能已改变实词（对象/操作/量词/否定词/数字）：\n" + paraphrased.map((c) => "- " + c.slice(0, 80)).join("\n") + "\n请重写这些卡：逐字内嵌开局邮件的原句（带 Rn，压缩短语只能作标题），其余字段照旧返回（不得新增 blocked/done）；若是开局邮件漏记了原话，先补邮件再返回。返回 WorkCards。",
      );
      paraphrased = (cards.cards || []).filter((c) => /\bR\d+\b/.test(c) && !verbatimOk(c));
      log(paraphrased.length === 0 ? "卡面-台账对拍：重写后通过" : "卡面-台账对拍重写后仍缺 " + paraphrased.length + " 张——如实记录并继续，下游以开局邮件原话为准绳");
    }
  }
  log("第 " + round + " 轮任务：" + cards.title + "；方案组合：" + (cards.proposals || []).join("、"));

  phase("算法工程师开发自测");
  let dev = await algo.ask<DevReport>(
    "本轮任务卡：" + (cards.cards || []).join("；") + "\n" +
    "开发并自测。纪律：端到端真实跑、数字注明口径、竞品保真对照；本轮选中的每个方案都必须得到充分验证（三级执行：MINI_PILOT/PILOT 只用于调试，主张只来自 FULL）；第 1 轮结束时必须已有至少一个来自完整对比的端到端数字。与已有工作对比前先建口径对照表（每家原始约定/数据集/指标定义）；表示或预处理假设先用标准工具做零成本锚点实验再决定是否建全量；每轮至少做一个边界实验（方法何时失效、参数多敏感），主张注明证据范围（数据集与条件）。如实报告 experiments（尝试数/跑通数），零结果入档并解释机制。",
  );
  if (round === 1 && !(dev.numbers || []).some((n) => /\bFULL\b/i.test(n))) {
    dev = await algo.ask<DevReport>(
      "第 1 轮必须以至少一个来自完整对比（FULL 级）的端到端数字收尾，禁止以最小对比代替。请现在补跑并返回 DevReport（numbers 填入该数字与口径，并以 FULL 开头注明层级）；若客观上无法做到，如实说明并保持 numbers 为空。",
    );
    if (!(dev.numbers || []).some((n) => /\bFULL\b/i.test(n))) log("第 1 轮无 FULL 级端到端数字（补救后仍缺）——已如实记录，稿件不得声称已验证");
  }
  // 破坏性操作：廉价档只申报，强档总工裁决执行/改写法/跳过（不下放给老板）
  if ((dev.dangerRequests || []).length > 0) {
    dangerLog = await dangerFlow(dev.dangerRequests);
  }

  phase("测试工程师审查测试");
  const tester = agent("测试工程师-R" + round, persona(TEST_ZH + PROFILE_LINE, CHEAP)); // 一次性实例：上下文有界（借鉴工程循环的实测教训），跨轮不记忆
  let verdict = await tester.ask<TestVerdict>(
    "审查开发产出。作者自报如下（只当线索与覆盖面提示——每个数字与主张以 claim_map 与存档工件核验为准，绝不因自报而免检）：" + JSON.stringify(dev) + "\n" +
    "本轮 diff = 上一轮存档提交..当前工作树（含未跟踪文件）。先读 LoopMail/ToBoss.md 开局邮件的产物规格表：验收按规格表的合格判据，不只验结构。" +
    "职责：代码审查/roundtrip（含对抗输入）/泛化/扰动稳定性；更新 claim→evidence 映射表（Agents/claim_map.md）；" +
    "建立或更新 Agents/selfcheck.py，必须含必须失败的金丝雀用例；selfcheck 运行时必须真实执行该金丝雀并观察到其失败，并在输出末尾打印机器可读一行：CANARY: expected-FAIL observed-FAIL（编排器解析此行核验——缺失或 observed-PASS 视为套件无效）；期望值只从规格表或已登记要求派生（注释写出处），绝不从当前实现派生。对进入主张或 go/no-go 决策、且经多步聚合的头条数字，从存档中间记录用第二条路径复算（不同分组或公式——不要求第二套实现）；实验须存档足以让复算在分钟级完成的中间记录。不一致即冻结该数字并审计，绝不当作舍入误差放行。单一来源的直接测量免检（roundtrip 与 canary 已覆盖）。发现数字被撤回时，全库检索所有重复该数字的文档（账本历史、README、图表）并列出当轮修正清单。返回 TestVerdict（artifacts 列出本轮产出的图/表路径，含被 .gitignore 的）。",
  );
  // 图像产物 → 视觉审阅（机械触发）：问题并入本轮问题清单，走既有修复流程；没有图就没有这笔开销
  const isImgR = (p: string): boolean => /\.(png|jpe?g|svg|webp|gif)$/i.test(p);
  let imageFilesR: string[] = (verdict.artifacts || []).filter((p) => isImgR(p));
  try {
    const stR = await G(["status", "--porcelain"], 60000);
    for (const line of (stR.stdout || "").split("\n")) {
      const tR = line.trim();
      if (tR.length < 4) continue;
      const pR = tR.slice(3).trim();
      if (isImgR(pR) && imageFilesR.indexOf(pR) < 0) imageFilesR.push(pR);
    }
  } catch {
    /* 检测失败：按无图处理，账本如实记录 */
  }
  let visualNoteR = imageFilesR.length === 0 ? "本轮无图像产物：不适用" : "尚未审阅";
  if (imageFilesR.length > 0) {
    phase("视觉审阅图像产物");
    const vvR = await agent("视觉审阅-R" + round, persona(VISUAL_ZH + PROFILE_LINE, STRONG)).ask<VisualVerdict>(
      "本轮任务：" + cards.title + "。规格见 LoopMail/ToBoss.md 开局邮件的产物规格表。逐张打开并审阅以下图像（相对工作区路径）：\n" + imageFilesR.join("\n") +
      "\n三问：数据是否铺满应定义域；坐标轴/刻度/单位/图例是否可读且与规格一致；这张图能否支撑本轮所声称的结论。返回 VisualVerdict（问题写清文件名与你看到的现象）。",
    );
    visualNoteR = vvR.summary + ((vvR.issues || []).length > 0 ? "｜问题：" + (vvR.issues || []).join("；") : "");
    if ((vvR.issues || []).length > 0) {
      verdict.issues = verdict.issues.concat((vvR.issues || []).map((x) => "【视觉】" + x));
      log("视觉审阅发现问题，已并入本轮修复清单：" + visualNoteR.slice(0, 300));
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
      "Agents/claim_map.md 缺失或不合格（需含 claim-map 标记 + 表格行）。请建立：每行 = 稿件数字 | 存档工件 | 可重跑的检查命令。",
    );
    try {
      const map = await files.read("Agents/claim_map.md");
      claimMapOk = map.includes("claim-map") && map.split("\n").filter((l) => l.trim().startsWith("|")).length >= 2;
    } catch {
      claimMapOk = false;
    }
  }
  let canary = false;
  let canaryRun = false;
  let fullSelfOut = "";
  try {
    canary = (await files.grep("canary", "Agents/selfcheck.py")).length > 0;
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
        ? await world.run("python3", ["Agents/selfcheck.py"], { timeoutMs: 3600000 })
        : await world.run("python", ["Agents/selfcheck.py"], { timeoutMs: 3600000 });
      exitCode = r.exitCode;
      fullSelfOut = r.stdout || "";
      output = (r.stderr || r.stdout || "(无输出)").slice(0, 1500);
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
          output = (r.stderr || r.stdout || "(无输出)").slice(0, 1500);
        } catch {
          launchErr = e instanceof Error && e.message === "py-launcher-stub" ? "python 为启动器 stub 且 python3 不可用——环境缺 Python 解释器" : "python 与 python3 均无法启动（请确认解释器可用）";
        }
      } else {
        launchErr = "Agents/selfcheck.py 启动失败或超时";
      }
    }
    canaryRun = /CANARY:\s*expected-FAIL\W*observed-FAIL/i.test(fullSelfOut);
    if (canary && !canaryRun) log("门禁拦截：selfcheck 未报告 canary 执行结果（缺 CANARY: expected-FAIL observed-FAIL 行）");
    if (launchErr === "" && exitCode === 0 && canary && canaryRun && claimMapOk) {
      gate = "通过（第 " + attempt + " 次尝试" + (interpIsPy3 ? "，python3" : "") + "）";
      break;
    }
    if (attempt === 3) {
      gate = launchErr !== ""
        ? launchErr
        : (claimMapOk ? "" : "映射表未建立；") + ((canary && canaryRun) ? "3 次修复后仍失败" : (canary ? "canary 未报告执行结果" : "门禁未就绪（自检缺少 canary 对照用例）"));
      break;
    }
    try {
      canary = (await files.grep("canary", "Agents/selfcheck.py")).length > 0;
    } catch {
      canary = false;
    }
    const reason = launchErr !== ""
      ? launchErr
      : "exit " + exitCode + (canary ? (canaryRun ? "" : "，且 canary 未报告执行结果") : "，且缺少 canary 对照用例") + (claimMapOk ? "" : "，且映射表未建立");
    const triage = await tester.ask<string>(
      "门禁未通过（" + reason + "）。你是 Agents/selfcheck.py 与映射表的所有者：若问题在测试基建（脚本/用例/映射表），直接修复；若问题在被测实现，返回给算法工程师的明确修复指令清单（勿改被测实现）；若无法判断，如实说明。输出摘要：\n" + output,
    );
    const t = triage.trim();
    const tNorm = t.replace(/。/g, "").trim();
    if (tNorm !== "" && tNorm !== "无" && tNorm.toLowerCase() !== "none") {
      const fixer = attempt === 2
        ? agent("强档返修-R" + round + "-A" + attempt, persona(ALGO_ZH + PROFILE_LINE, STRONG)) // 最后一次修复机会由强模型档执行（借鉴工程循环的升级通道）；triage 裁决权仍在测试员
        : algo;
      const triageDev = await fixer.ask<DevReport>(
        (attempt === 2 ? "【升级】前 1 次修复未解决。你是强档返修实例：先定位根因，一次修对。" : "") +
        "测试工程师裁决的修复指令（你不许改 Agents/selfcheck.py 与 claim_map.md）：\n" + t.slice(0, 2000) + "\n执行后返回 DevReport。",
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
    fixDev = await algo.ask<DevReport>("执行修复与补充实验：" + fixes.join("；") + "\n每条先在本轮代码上复现：过期条目（引用旧版本行号、已被修复、当前复现不了）直接丢弃并说明，绝不据此改动。返回 DevReport。");
    if ((fixDev.dangerRequests || []).length > 0) {
      dangerLog = (dangerLog === "无" ? "" : dangerLog + "；") + await dangerFlow(fixDev.dangerRequests);
    }
  }

  phase("研究员修订文稿");
  const paper = await researcher.ask<string>(
    "开发与测试已完成，这是你本轮唯一修订时机。" + (round === 1 && (dev.numbers || []).length === 0 ? "【禁令】第 1 轮无 FULL 级端到端数字——稿件不得声称已验证，相关主张一律标注未验证。\n" : "") + "开发报告：" + JSON.stringify(dev) +
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
        invite.brief + "\n\n你是相邻领域（与本研究方向相关但不重叠）的独立审稿人。评审只依据简报及其所指材料——不翻看简报之外的仓库内容、git 历史与账本（盲审纪律），只读不改任何文件：对稿件与证据映射提出尖锐质询（附证据出处），并给出下一轮迭代建议，给 severity。小心数字幻觉：好的数据表现不代表好的情况——严谨考虑稿件数字的含义是不是表面那么简单，支撑它的理论可能本身有错，而漂亮的数字会加固这一理论幻觉。如无法判断，如实说明。",
      ),
    ),
  );
  const readerRev = await reader.ask<Review>(
    "通读文献后审稿（材料范围：稿件摘要、所引参考文献——含 docs/refs/ 论文库——与网络检索；不翻看账本、git 历史或源码工作区）。稿件摘要：" + paper.slice(0, 500) + "\n核对引用与叙事、查新、提问，并给出迭代建议。小心数字幻觉：好的数据表现不代表好的情况——严谨考虑稿件数字的含义是不是表面那么简单，支撑它的理论可能本身有错，而漂亮的数字会加固这一理论幻觉。nearestWorks 必填：最相近的 3 篇工作与差异维度。",
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
    "把本轮记入 Agents/ledger.md（头部含仓库标识行" + (repoRoot ? "：" + repoRoot : "") + "与一行一轮的目录：本轮先更新目录行、再追加详情）：任务/产出/存档前 HEAD " + (head0 || "空树").slice(0, 7) + "/危险操作裁决（" + dangerLog + "）/测试（覆盖声明：" + (verdict.coverage || "").slice(0, 300) + "；视觉审阅：" + visualNoteR.slice(0, 200) + "）/审稿/下轮方向。然后 git add -A && git commit（备份推送由编排器执行并核验，你不执行 push；向云端发布永远是老板的明确动作）。返回一句话。",
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
      "本轮提交未落盘（HEAD 未变化）。请立即 git add -A && git commit，返回提交哈希。",
    );
  }
  log("第 " + round + " 轮存档" + (commitOk ? "已核验（HEAD=" + head1.slice(0, 7) + "）" : "补救后仍需人工核查"));
  // 备份推送由编排器执行并核验（与工程循环同款，实测升级）：失败或核验不过都如实记录，绝不改推别处
  let pushStateR = "跳过推送：" + push0.note;
  const headPush = await HEADR();
  if (push0.target !== "" && headPush !== "") {
    try {
      const p = await G(["push", push0.target, "HEAD:" + branchR], 300000);
      if (p.exitCode !== 0) log("第 " + round + " 轮备份推送退出码 " + p.exitCode + "：" + (p.stderr || p.stdout || "").slice(0, 200) + "——如实记录");
    } catch {
      log("第 " + round + " 轮备份推送未启动（如实记录）");
    }
    try {
      const ls = await G(["ls-remote", push0.target, "refs/heads/" + branchR]);
      const rh = ((ls.stdout || "").split("\t")[0] || "").trim();
      pushStateR = rh === headPush && headPush !== ""
        ? "已推送并核验（" + headPush.slice(0, 7) + "@" + push0.target + "/" + branchR + "）"
        : "推送核验失败（如实记录：remote=" + rh.slice(0, 7) + "）";
    } catch {
      pushStateR = "推送核验失败（ls-remote 不可达，如实记录）";
    }
  }
  log("第 " + round + " 轮备份推送：" + pushStateR);

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
let evalResult = await chief.ask<EvalReport>(
  resumeNote + rounds + " 轮已完成，硬停。全部审稿意见：\n" + plan.slice(0, 6000) + "\n" +
  "轮次记录（含每轮实验死亡率 experiments 字段）：" + JSON.stringify(rows) + "\n" +
  (startRound > 1 ? "【证据基座范围】本次运行从第 " + startRound + " 轮续跑：上述审稿意见与轮次记录只含本次运行的轮次——评估必须显式注明证据基座范围，绝不让老板误以为覆盖全部轮次。\n" : "") +
  "若轮次记录显示第 1 轮无端到端数字，报告必须显式声明「第 1 轮无 FULL 数字，稿件不得声称已验证」。\n" +
  "撰写《初步评估报告》：verdict（继续/转向/停止）、预期成功率（推理依据必须引用实验死亡率趋势与文献读者的新颖性核查结论；并明确标注『这是定性判断的数值化表达，非校准概率』）、创新性（引用最相近 3 篇工作与实质差异维度）、影响力、继续做要注意的点（每条注明对应主张的证据范围——数据集与条件）、" +
  "reviewerQuotes（逐字引用每位审稿人结论，不得改写）、待答问题逐条（questionAnswers：问题原文→直接答案→证据位置；问「存在哪」时连形态一起答——是 raw 还是派生格式、有没有写出器）、自主决定清单（autonomousDecisions：决定→理由→若否决的后果→奥卡姆自评「增加复杂度还是删减」；凡增加复杂度的决定必须进这一节，不能只写账本）、遗留与否决各设固定小节（deferred/declined，各带理由——记录在案的延后是决策而非遗漏，被否决的想法不得下轮重新提案；字段如实填写，无则空数组）、与老板要求相悖的偏离逐条说明（deviations：偏离+原因+替代选择；无则空数组）、流程教训（processLessons：每条=规则+为什么+适用范围；老板采纳的教训持久化并随下次运行加载，被证伪的教训标记废弃）、给老板的建议（含仅老板能做的决策清单：账号、数据、资源类）。" +
  "逐句对账收尾（内部事务）：开局邮件逐句清点的每句 Rn 逐条标注 已交付/部分/未交付→证据位置，写进账本终章与 Agents/claim_map.md 的对账列——绝不以对账表形式出现在老板邮件正文，没有条目支撑的「已落实」不算完成。这份报告是决策层文档，并作为一封新邮件追加到 LoopMail/ToBoss.md 头部（2026-11-05 老板邮件化体系：ToBoss.md＝总工交付邮件正本，新邮件插头部、倒序追加、旧邮件永不删改；docs/＝正式内容如稿件与 REPORT.ipynb；正式文件在邮件中以链接作附件引用；写作纪律（2026-11-05 老板原话，硬性）：去冗余的艺术——最少的汇报、最快让老板把握主线和全貌，禁止堆砌黑话（行话首次出现用白话括注），禁止与事实不符（数字与结论只引用命令输出与产物 manifest），禁止堆砌代码段与路径指引（证据指针集中一节列，正文不堆路径））：不写过程流水账（第几次门禁通过、返修几轮、审稿几条——那些在账本）、每节开头一句结论、同一件事只说一次、以 ≤2 页为目标。收尾同时整理交付（2026-11-05 老板规则，硬性；先全仓盘点历史冗余——包括此前各轮与各次运行遗留的——再动手，一律 git mv，绝不删除——删除文件是老板的动作）：①凡非最终产出需要的代码与文档（实验脚本、被替换的实现版本、草稿与中间报告等历史冗余，包括代码和文档）→ 直接 git mv 进 Agents/；②AI 生成且已成历史的文档→只把值得采纳且有意义的内容并入 ToBoss 最新邮件的交付清单表述，文档本体算作历史冗余 git mv 进 Agents/；③docs/ 只保留正式内容（稿件本体等），仓库根与 docs/ 不堆工作文件；④老板写入或提供的文件（LoopMail/FromBoss.md、docs/refs/ 论文库）原样保留，绝不改动老板写下的内容；⑤LoopMail/ 下异于 ToBoss.md/FromBoss.md 的文件逐一判定归属——老板放置的文件名加前缀 FromBoss_ 并原样保留，agent 自己散落的按①②归位，拿不准的一律按老板放置处理；工作脚手架（账本、映射表、Agents/selfcheck.py、测试调试脚本、被证伪的历史）全部在 Agents/ 下。追加邮件到 LoopMail/ToBoss.md，git add -A && git commit。",
);
let evalOnDisk = "";
try {
  evalOnDisk = await files.read("LoopMail/ToBoss.md");
} catch {
  evalOnDisk = "";
}
if (!evalOnDisk.slice(0, 2000).includes("初步评估报告")) {
  await chief.ask<string>("评估报告未落盘（LoopMail/ToBoss.md 头部未见《初步评估报告》邮件）：把报告作为新邮件插入 LoopMail/ToBoss.md 头部并 git add -A && git commit，返回一句话。");
}
// 逐句对账覆盖机械核查：开局邮件的每个 Rn 必须在账本终章有处置标注（已交付/部分/未交付→证据位置）——蒸发即漏需求
{
  let ledgerTailF = "";
  try {
    ledgerTailF = (await files.read("Agents/ledger.md")).slice(-6000);
  } catch {
    ledgerTailF = "";
  }
  let toBossF = "";
  try {
    toBossF = await files.read("LoopMail/ToBoss.md");
  } catch {
    toBossF = "";
  }
  const rnUnivF = Array.from(new Set(toBossF.match(/\bR\d+\b/g) || [])).sort();
  const rnGoneF = rnUnivF.filter((rn) => !(new RegExp("\\b" + rn + "\\b")).test(ledgerTailF));
  if (rnGoneF.length > 0) {
    await chief.ask<string>(
      "逐句对账覆盖核查未过：账本终章缺少以下开局邮件 Rn 的处置标注：" + rnGoneF.join("、") + "——每条标 已交付/部分/未交付→证据位置，绝不省略（蒸发即漏需求），git add -A && git commit，返回一句话。",
    );
    try {
      ledgerTailF = (await files.read("Agents/ledger.md")).slice(-6000);
    } catch {
      ledgerTailF = "";
    }
    const stillGoneF = rnUnivF.filter((rn) => !(new RegExp("\\b" + rn + "\\b")).test(ledgerTailF));
    log(stillGoneF.length === 0 ? "逐句对账覆盖：补齐后通过" : "逐句对账覆盖仍缺 " + stillGoneF.length + " 条（" + stillGoneF.join("、") + "）——已如实记录");
  }
}
// 疑问句防蒸发（机械）：老板原话含疑问而报告没有答案即视为漏需求——补答一次，仍缺则如实记录
const askedQ = ((idea + " " + focus).match(/？|\?/g) || []).length;
if (askedQ > 0 && (!evalResult.questionAnswers || evalResult.questionAnswers.length === 0)) {
  evalResult = await chief.ask<EvalReport>(
    "老板原话含 " + askedQ + " 处疑问，但报告里 questionAnswers 为空——疑问句在登记环节蒸发属漏需求。逐条补答（问题原文→直接答案，含形态→证据位置；确实无法作答的写「无法作答：原因」），写回 LoopMail/ToBoss.md 最新邮件并 git add -A && git commit（报告提交存在且未推送时可 --amend 并入；绝不改写已推送历史），返回完整 EvalReport。",
  );
  if (!evalResult.questionAnswers || evalResult.questionAnswers.length === 0) log("报告仍缺待答问题（已如实记录，老板原话含 " + askedQ + " 处疑问）");
}
// 评估报告提交由编排器推送并核验（与工程循环同款）
let finalPushR = push0.target === "" ? "跳过推送：" + push0.note : "未推送";
if (push0.target !== "") {
  const headFinalR = await HEADR();
  try {
    const p = await G(["push", push0.target, "HEAD:" + branchR], 300000);
    if (p.exitCode === 0) {
      try {
        const ls = await G(["ls-remote", push0.target, "refs/heads/" + branchR]);
        const rh = ((ls.stdout || "").split("\t")[0] || "").trim();
        finalPushR = rh === headFinalR && headFinalR !== "" ? "已推送并核验（" + headFinalR.slice(0, 7) + "）" : "推送核验失败（如实记录：remote=" + rh.slice(0, 7) + "）";
      } catch {
        finalPushR = "推送已执行，落盘核验不可用（如实记录）";
      }
    } else {
      finalPushR = "推送退出码 " + p.exitCode + "（如实记录：" + (p.stderr || "").slice(0, 200) + "）";
    }
  } catch {
    finalPushR = "推送未启动（如实记录）";
  }
  log("评估报告推送：" + finalPushR);
}
const md = [
  "# 初步评估报告",
  "",
  "正本：LoopMail/ToBoss.md 最新邮件（本件为随运行的投递副本）",
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
  "## 你的问题，答案在这里",
  (evalResult.questionAnswers && evalResult.questionAnswers.length > 0) ? evalResult.questionAnswers.map((x) => "- 「" + x.q + "」→ " + x.a + "（证据：" + x.evidence + "）") : ["- 无（本次没有疑问句）"],
  "",
  "## 自主决定清单（请裁决是否保留）",
  (evalResult.autonomousDecisions && evalResult.autonomousDecisions.length > 0) ? evalResult.autonomousDecisions.map((x) => "- " + x.decision + "｜理由：" + x.reason + "｜若否决：" + x.ifRejected + "｜奥卡姆：" + x.occam) : ["- 无"],
  "",
  "## 延后（deferred）",
  (evalResult.deferred && evalResult.deferred.length > 0) ? evalResult.deferred.map((d) => "- " + d.item + "（理由：" + d.reason + "）") : ["- 无"],
  "",
  "## 否决（declined）",
  (evalResult.declined && evalResult.declined.length > 0) ? evalResult.declined.map((d) => "- " + d.item + "（理由：" + d.reason + "）") : ["- 无"],
  "",
  "## 审稿人原话",
  ...evalResult.reviewerQuotes.map((q) => "> " + q),
  "",
  "## 给老板的建议",
  evalResult.advice,
  "",
  "## 偏离说明",
  (evalResult.deviations && evalResult.deviations.length > 0) ? evalResult.deviations.map((d) => "- " + d) : ["- 无"],
  "",
  "## 流程教训",
  (evalResult.processLessons && evalResult.processLessons.length > 0) ? evalResult.processLessons.map((d) => "- " + d) : ["- 无"],
  "",
  "---",
  "说明：预期成功率是定性判断的数值化表达，非校准概率；审稿人原话未经改写，可能与总判断不一致。",
].join("\n");
await artifact.markdown("report", md, { title: "初步评估报告（投递副本）", description: "正本在 LoopMail/ToBoss.md 最新邮件；" + rounds + " 轮硬停后的 go/no-go 评估", primary: true });

return {
  conclusion: evalResult.advice,
  verdict: evalResult.verdict,
  rounds_completed: rows.length,
  paper_requests: survey.paperRequests || [],
  next_action: "等待老板决策：再次运行本工作流并传 focus 参数反馈（继续/转向/停止）",
};
