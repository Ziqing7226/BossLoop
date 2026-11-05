# Skill: Paper Search

Discipline rules for literature investigation, distilled page-by-page from a university graduate information-literacy lecture series. Consumed by the Chief Engineer's survey stage of the Research Iteration Loop (see `research-iteration-loop/`); usable standalone. Companion skill: [paper-writing.md](paper-writing.md) (what to do once the literature is found).

---

## 0. What literature investigation is

Not just retrieval: a purposeful, planned cycle of **search → organize → analyze → review** that feeds back into topic selection. Its purpose is evidence: put the issue into a wider context and link your findings to the body of knowledge already in existence — you must show evidence of reading and how you used it to inform your work.

## 1. Two investigation modes (match depth to stage)

| Stage | Mode | Bar | How |
|---|---|---|---|
| Topic not yet fixed | **Broad survey (泛调研)** | fast, accurate | A dozen-odd high-relevance journal papers; 3–5 monographs skimmed; read **abstract + introduction + conclusion** only; use **review articles as starter literature** (search the title field for `XX综述` / `XX review`) |
| Topic fixed | **Deep survey (精调研)** | complete, precise | Wide: maximize recall, compare prior work, locate the gap. Deep: prioritize **highly cited, high-impact-factor, recent** work; read classic + frontier papers in full; extract usable viewpoints and methods |

Review articles are the starter literature in both modes: they capture a field's **history** (what was done), **current state** (schools and progress), and **latest trends**.

## 2. The six-step search method

`1 Analyze information need → 2 Choose information source → 3 Choose search terms → 4 Build and run the query → 5 Browse and judge results → 6 Process results` — with feedback arrows from step 5 back to 1–3: **searching is iterative** (trial query → adjust → final).

### Step 1 — Analyze the need
Split the topic into core concepts and keep only words with real retrieval power. Drop generic terms: 展望/发展趋势/现状/影响/方法/制备/机制… Example: "废弃陶瓷对水泥基复合材料力学性能影响与机制的研究综述" → `废弃陶瓷 / 水泥基 / 复合材料 / 力学性能`.

### Step 2 — Choose the source
- **Professional databases first**; know your field's home databases by heart. Prefer **abstract/index databases** (Web of Science, Scopus, Ei) over full-text aggregators: screened sources, citation linkage, evaluation value, full-text links — "find the most important literature in less time". Use full-text libraries (IEEE Xplore, ScienceDirect, Springer, Wiley, CNKI, ProQuest) as complements; field-special libraries (ACM, IEEE, Optica, SPIE) by discipline; incoPat for patents; arXiv for preprints.
- General rule: **abstracts before full text; reviews before single papers; Chinese before foreign; online before print; recent before old**. For recall, search several databases.

### Step 3 — Choose search terms
The essence of retrieval is **matching**, and terms decide what you can match.
- Never literal-translate a term — you will miss many papers. Collect, per concept: synonyms, broader/narrower terms, related words, singular/plural, derived forms of the same root, abbreviations, common names vs formal names, English equivalents of Chinese concepts.
- Find synonyms via: thesauri and dictionaries (e.g. CNKI 工具书总库: 氟橡胶→fluororubber/氟弹性体), reference lists of related papers ("顺藤摸瓜"), web tools. **The more complete the synonym set, the fewer papers missed.** Join all synonyms with `OR`.
- For engineering topics, decompose by the pipeline/concept chain and collect terms per node (e.g. IC chain: EDA tools / equipment / materials / design / manufacturing / packaging-test — each with English keywords, Chinese keywords, and patent classification codes).

### Step 4 — Build and run the query
A query = **field + term + operator**.
- Boolean: `AND` narrows (raises precision), `OR` widens (raises recall), `NOT` excludes (use sparingly — hurts recall). Most databases default un-joined terms to AND.
- Truncation `*`: `bio*` → biology/biochemistry/biophysics. Don't truncate too deep — noise explodes.
- Phrase search `"…"`: `"Surgical Robot*"` exact vs unquoted fuzzy. Real numbers (WoS, 2024): fuzzy 3,336 → exact 449 → proximity `(Surgical near/5 Robot*)` 1,395. Exact = precise but may miss; fuzzy = complete but noisy; proximity in between.
- Proximity: `A near B` / `A near/5 B` (within 5 words); `SAME` joins terms **within one address** (address-field only — `AND` would match across different addresses).
- Field targeting: WoS `TS=` (topic = title + abstract + author keywords + Keywords Plus), CNKI 主题/篇关摘/篇名…, IEEE `"Abstract":ofdm AND "Publication Title":communications` (command-search operators ALL CAPS, ≤25 terms per clause).
- Worked examples to imitate:
  - `TS=("3D bioprint" OR "3D bio-print" OR "Three dimension* bioprint*")`
  - `TS=("Field Programmable Gate Array") OR FPGA`, 2016–2025, SCI-E
  - `cancer OR tumor OR "malignant neoplasm" OR "neoplastic disease"` — the synonym expansion alone added 100k+ hits
  - Long pipeline query: `TS=((chip or semiconductor) near/10 FinFET) or (fin near/3 structure) or …` — OR-groups of proximity pairs per technical node.

### Step 5 — Browse and judge (the iteration point)
Adjust the query when results are off:
- **Too few**: broader/upper-class terms; add synonyms; relax limits (years, languages, types); widen fields (search abstract/full text); change `AND` groups to `OR`.
- **Too many**: the reverse.

### Step 6 — Process results — the three-screen triage
1. **Filter**: database facets — field, years, document type (article/review/…), source category (SCI/EI/北大核心/CSSCI/CSCD; 双一流/优秀论文级别 for theses).
2. **Rank by citation**: highly cited (absolute) > relatively highly cited (new or old) > lightly cited > uncited. Mark **Highly Cited Papers** (top 1% of same-year same-field over 10 y) and **Hot Papers** (top 0.1% recent-2-months) — ESI's Top Papers — as the fast lane to a field's peaks.
3. **Judge the journal**: impact factor and quartile (JCR), core-journal lists (CNKI 期刊导航→核心期刊导航). IF never compares across fields.

Also: sort by date for the frontier; sort by usage (180 days) for what peers are actually reading; use the database's **analyze** function (publication years, authors, institutions, countries, source titles — reveals which journals carry the field) and export the tables if needed.

## 3. Citation tracking (snowballing)

From any pivotal paper, walk its citation network in all directions:
- **References** (what it cites) — walk **backward** to the foundations;
- **Citing literature** (who cites it) — walk **forward** to the follow-ups and the state of the art;
- **Related records / 共引文献 / 同被引文献** — papers sharing references with it (same research background), the co-citation principle; a "(22 shared)" tag means 22 shared references.
CNKI exposes the same network (参考文献/引证文献/共引/同被引/二级参考/二级引证) plus knowledge-network hints (研究起点/来源/分支/去脉). Repeat until new names stop appearing.

## 4. Author and institution search

- Author query format: surname + initial(s); handle spelling variants with truncation or name-variant rows (`O'Brian C* OR OBrian C*`; +Add name variant).
- Disambiguate same-name authors by **institution + discipline + career timeline** (check the person's homepage/CV for affiliation dates); persistent IDs (ResearcherID/ORCID) settle it.
- Address search uses `SAME` to require terms in the same affiliation line.

## 5. Theses as a source

Dissertations bundle a **literature review** (their 序言 is tertiary literature) and an exhaustive **reference list** (secondary) — two ready-made surveys. Domestic: CNKI 博硕士库 (full text), 万方, 中科院学位论文库 (browse-first-16-pages + document delivery); international: ProQuest PQDT (filter to available full text). Quality levers: 双一流/一流学科/优秀论文 filters; advisor field; degree-granting institution distribution analysis.

## 6. After the search

- Manage hits with a reference manager (EndNote/Zotero/…): classify, annotate, deduplicate — the pipeline into writing.
- Keep queries: saved searches/alerts and citation alerts keep the survey alive during the project.
- **Beginner's rule: read reviews first** (database search: topic = `topic AND 综述` / filter Document Type = Review), then classics, then the frontier.

## 7. AI in the loop — propose freely, verify every citation

Three expanding handles on any relevant hit: **similar articles** sideways, its **reference list** backward to the classics, its **corresponding author** to the research group's publications.

The model's literature knowledge is a first-class survey tool, not a suspect one. Its one documented failure mode is narrow: recalled citation details (title, authors, year, venue, DOI) can drift or be invented. The answer is one precise gate, not a ban: **the professional database is the source of record — every citation that enters the survey is confirmed there first, whatever its origin** (a model's memory, a snowballed name, a database hit).

- **Propose from memory, land in the database.** The field's reviews, canonical papers, key authors and research threads — the model knows these cold; raise them as immediate leads. Generate the search strategy the same way (databases → per-concept terms → boolean/proximity query → filters), then iterate the query and land every candidate in a professional database; the database record — not memory — supplies the title, venue, year and DOI the survey prints. A lead the databases cannot confirm is dropped and logged — expected occasionally, never a crisis. Cross-check with several models and time windows to widen recall; every output is a lead, and every lead faces the same gate.
- **Reading aids**: upload a paper for outline/mind-map/QA summarization, multi-document comparison tables, translation and language polish. The review loop is search → read → polish, and digests must trace back to the source papers — cite what you verified, never a summary of a summary.
- Worked strategy example (quantum computing): first pass `("quantum comput*" OR qubit) AND (algorithm OR hardware OR "error correct*")`; refined `TS=((quantum NEAR/2 comput*) OR (quantum NEAR/2 algorithm*) OR … OR "quantum Circuit") AND PY=(2019-2023) AND DT=(Article OR Review)`.

## 8. Academic integrity (non-negotiable)

- Every claim that rests on someone else's work carries a citation at the point of use; quoted text is quoted. AI-assisted brainstorming must be **verified against the literature** — never copied.
- One manuscript, one venue: never submit to multiple journals at once; a rejected paper is improved and submitted fresh elsewhere.
- Salami-slicing (series titles "…III") and duplicate publication are misconduct, not strategy.
- **AI use is governed by the target venue's current policy — read the author kit at submission time, never rely on year-old rules.** Recent top-venue policies state it plainly: CVPR's guidelines let LLMs help authors, reviewers and area chairs while keeping humans fully responsible for every claim; ICLR requires the use of LLMs to be stated explicitly, in the paper and in the submission form. Standing rules across venues: AI is never an author; the authors own every word, including everything AI drafted, suggested or found; every citation is verified in a database regardless of where it came from; the disclosure says what tool was used, for what, and appears where the venue prescribes (methods/acknowledgements).
- The third-party rules apply with or without AI: no ghost-writing, no proxy submission, no third-party content edits, no fake reviewer information, no citation-cartel games. Fabricated or "beautified" data — including interview content reworded by a chatbot until it no longer matches the originals — leads to retractions and expulsion; the famous AI-generated-figure retractions happened within days of publication.

---

*Distilled page-by-page from a university graduate information-literacy lecture series, sessions 1–3 (topic selection & search methodology; CNKI / Web of Science / IEEE Xplore / theses database practice; academic norms), 2026-11.*
