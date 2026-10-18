// Chapter bodies of the career guide (/guide/<slug>), Markdown in both languages. Server-only:
// app/guide pages render them; lib/career-guide.ts holds the titles. Written for CSWork; no
// employer is named, and salary figures are deliberately left out.

export const GUIDE_BODIES: Record<string, { zh: string; en: string }> = {
  timeline: {
    zh: `北美大部分软件公司按年度招聘实习生和应届生。下面的月份只是常见情况，不是固定日程：每家公司有自己的节奏，近几年不少岗位开放得比以前更早。把它当作规划参考，具体以各公司招聘页为准。

## 两条线，一张日历
- **实习**（通常是第二年夏天的 10–12 周）和**应届全职**（毕业后入职）基本在同一时间招，主要集中在入职前一年的秋天。
- 实习表现好，结束时常会拿到 **return offer**（下一期实习或全职），所以秋天找实习，也是在为明年的应届求职铺路。

## 一个典型的招聘季
| 时间 | 通常在发生什么 | 你可以做什么 |
|---|---|---|
| 5–7 月 | 岗位不多，少数公司提前开放 | 改好简历，热身常见题型，列出目标公司 |
| 8–10 月 | 大部分岗位开放，简历滚动筛选 | 尽早分批投递，同时找内推 |
| 9–11 月 | 在线笔试（OA）和电话面 | 在期限内完成 OA，保持限时练习 |
| 10–12 月 | 终面（常为线上）和发 offer | 把终面排得紧凑，让几份 offer 的时间重叠 |
| 1–3 月 | 第二波招聘，规模较小；初创和中型公司持续在招 | 继续投递，跟进还在流程中的公司 |
| 4–6 月 | 补录和非常规岗位；实习多在 5–6 月开始 | 准备实习，规划下一季 |

## 滚动筛选是常态
简历通常随到随看，招满就关。同一个岗位，8、9 月投比 12 月投稳妥得多。

## 国内校招的节奏（简述）
国内校招也按年度进行：暑期有**提前批**，**秋招**大约从 8 月到 10 月，**春招**大约在 2 月到 4 月补招剩余岗位；第二年的暑期实习多在春季开始招。各公司时间不同，以官方公告为准。

## 下一步
先把[简历](/guide/resume)改好，再去找[内推](/guide/referrals)。`,
    en: `Most large software employers in the US and Canada hire students and new graduates in a yearly cycle. The months below are typical, not fixed: every company runs its own calendar, and in recent years many roles have opened earlier than they used to. Use it to plan, and check each employer’s careers page.

## Two tracks, one calendar
- **Internships** (usually 10–12 weeks the following summer) and **new-grad roles** (full time, starting after you graduate) are recruited at the same time, mostly in the fall of the year before.
- An internship that goes well often ends with a **return offer** for another internship or a full-time role, so a fall internship search also feeds next year’s new-grad search.

## A typical season
| When | What usually happens | What to do |
|---|---|---|
| May–July | Few postings; some companies open early | Finish your resume, warm up on core patterns, list target companies |
| August–October | Most roles open; applications are reviewed as they arrive | Apply early and in batches; ask for referrals |
| September–November | Online assessments and phone screens | Finish assessments before their deadline; keep practising against the clock |
| October–December | Final rounds (often on video) and offers | Schedule finals close together so offers overlap |
| January–March | A second, smaller wave; startups and mid-size companies hire steadily | Keep applying; follow up on open processes |
| April–June | Late and off-cycle roles; internships start in May–June | Prepare for the internship; plan the next season |

## Rolling review is the rule
Applications are usually read as they arrive, and roles close when they fill. Applying to a role in August or September is much safer than applying in December.

## Campus hiring in China, briefly
Campus hiring in China follows a yearly rhythm too: an **early round** (提前批) in summer, the main **autumn round** (秋招) from about August to October, and a **spring round** (春招) from about February to April for remaining roles. Summer internships for the following year are usually recruited in spring. Dates vary by company; go by each official announcement.

## Next
Get your [resume](/guide/resume) in shape, then line up [referrals](/guide/referrals).`,
  },

  resume: {
    zh: `招聘方看一份简历，往往不到一分钟就决定要不要往下推。所以每一行都要说清楚：你做了什么，结果因此改变了什么。

## 基本规则
- 学生和应届生控制在**一页**。
- 板块顺序：教育、工作/实习经历、项目、技能。有全职经验以后，把经历放到最前面。
- 每个板块内按时间倒序。
- 单栏排版、标准标题、导出 PDF。招聘系统（ATS）最擅长读纯文字，表格、文本框、图标和照片都容易读错。
- 投北美岗位时，不放照片、出生日期、婚姻状况等个人信息（这和国内简历的习惯不同）。

## 用 XYZ 公式写经历
**完成了 [X]，用 [Y] 衡量，方法是 [Z]。**

- 弱：“参与搜索功能开发。”
- 强：“为 4 万日活用户把搜索 p95 延迟从 800 ms 降到 220 ms，方法是加结果缓存、合并索引读取。”

没有精确数字时，写一个站得住的估计（“约 30%”“约 200 名同学使用”），但**不要编造**。面试官会追问数字。

## 项目和面试用 STAR
写项目要点或回答行为面问题时，按**情境（Situation）、任务（Task）、行动（Action）、结果（Result）**组织，把大部分篇幅留给行动和结果。平时可以把故事攒在 [STAR 故事库](/?view=stories) 里。

## 用有力的动词开头
英文简历每条以动词开头，并且说出具体做了什么：built、designed、shipped、reduced、automated、migrated、profiled、led、mentored。少用 responsible for、helped with、worked on。中文简历同理，用“设计”“实现”“将……降低”“主导”代替“参与”“负责”。

## 模板
\`\`\`text
YOUR NAME
email · phone · city · github.com/you · linkedin.com/in/you

EDUCATION
University Name — B.S. Computer Science            Expected May 2027
GPA 3.8/4.0 (optional) · Coursework: Algorithms, Operating Systems, Databases

EXPERIENCE
Company — Software Engineering Intern              Jun 2026 – Aug 2026
- Cut X by Y% for Z users by building ...
- Automated ..., saving N hours a week for ...

PROJECTS
Project Name — Go, PostgreSQL, Docker               github.com/you/project
- Built ... that handles N requests per second ...

SKILLS
Languages: Python, Go, Java, SQL · Tools: Git, Docker, Linux, AWS
\`\`\`

## 先针对岗位改，再检查
在属实的前提下，用职位描述里的原词（同一种语言、框架或业务领域）。改完后，把职位描述贴进 [JD 检查](/career/jd)，和简历生成器里保存的简历比对，看看关键词还缺什么。`,
    en: `A recruiter often decides in under a minute whether to pass your resume on. So every line should say what you did and what changed because of it.

## The basics
- **One page** for students and new graduates.
- Sections in this order: Education, Experience, Projects, Skills. Once you have full-time work, put Experience first.
- Reverse chronological order within each section.
- A plain single-column layout, standard headings and a PDF export. Applicant tracking systems (ATS) read plain text best; tables, text boxes, icons and photos are easy to misread.
- For US and Canadian applications, leave out a photo, date of birth, marital status and similar personal details.

## Write bullets with XYZ
**Accomplished [X], as measured by [Y], by doing [Z].**

- Weak: “Worked on the search feature.”
- Stronger: “Cut search p95 latency from 800 ms to 220 ms for 40k daily users by adding a result cache and batching index reads.”

If you lack an exact number, use an estimate you can defend (“about 30%”, “used by ~200 students”), but **never invent one**. Interviewers ask about numbers.

## STAR for projects and interviews
For a project bullet or a behavioural answer, use **Situation, Task, Action, Result**, and spend most of the words on Action and Result. Collect your stories in the [story bank](/?view=stories).

## Start with a strong verb
Open each bullet with a verb that names the work: built, designed, shipped, reduced, automated, migrated, profiled, led, mentored. Avoid “responsible for”, “helped with” and “worked on”.

## Template
\`\`\`text
YOUR NAME
email · phone · city · github.com/you · linkedin.com/in/you

EDUCATION
University Name — B.S. Computer Science            Expected May 2027
GPA 3.8/4.0 (optional) · Coursework: Algorithms, Operating Systems, Databases

EXPERIENCE
Company — Software Engineering Intern              Jun 2026 – Aug 2026
- Cut X by Y% for Z users by building ...
- Automated ..., saving N hours a week for ...

PROJECTS
Project Name — Go, PostgreSQL, Docker               github.com/you/project
- Built ... that handles N requests per second ...

SKILLS
Languages: Python, Go, Java, SQL · Tools: Git, Docker, Linux, AWS
\`\`\`

## Tailor it, then check it
Where it is true for you, use the posting’s own words (the same language, framework or domain). Then paste the posting into the [JD check](/career/jd) to compare its keywords with the resume saved in the resume builder and see what is missing.`,
  },

  referrals: {
    zh: `内推是指公司员工把你的简历提交进招聘系统，并表示你值得一看。在很多公司，内推的简历会更快被看到；但它**不能跳过面试**，也不保证一定有面试。

## 找谁
1. 了解你工作的人：以前的同事、导师、同学、助教。
2. 在这家公司工作的校友或同项目的学长学姐。
3. 在活动或网上真正聊过的工程师。

给完全陌生的人发请求，成功率低得多。消息短而具体，比长篇大论有效。

## 发什么
- 岗位的准确名称，以及职位链接或编号。
- PDF 版简历。
- 两三句话说明你为什么适合这个岗位。

## 一条好用的消息
> Sam 你好，我是 State University 计算机系大四学生，看到你们的 New Grad Backend Engineer 岗位（编号 12345）。我实习时用 Go 写过一个每秒处理 5000 次请求的限流器，和团队的方向比较接近。方便的话能帮我内推吗？简历附上。无论如何都谢谢你！

## 礼仪
- 让对方容易拒绝；不管结果如何都道谢。
- 不要一次请同一个人推很多岗位，挑最合适的一个。
- 有进展时告诉内推人。很多公司有内推奖励，但大家内推更多是想找到好同事，请尊重对方的时间。`,
    en: `A referral means an employee submits your resume into the company’s hiring system and vouches that you are worth a look. At many companies a referred resume gets read sooner; it **does not skip the interviews**, and it does not guarantee one.

## Who to ask
1. People who know your work: former teammates, managers, classmates, teaching assistants.
2. Alumni of your school or programme who work there.
3. Engineers you have actually talked to at events or online.

Requests to complete strangers work far less often. A short, specific message beats a long one.

## What to send
- The exact job title and the posting link or ID.
- Your resume as a PDF.
- Two or three sentences on why you fit the role.

## A message that works
> Hi Sam, I’m a CS senior at State University and saw the New Grad Backend Engineer posting (ID 12345). In my internship I built a rate limiter in Go that handled 5,000 requests a second, which looks close to the team’s work. Would you be comfortable referring me? Resume attached. Thanks either way!

## Etiquette
- Make it easy to say no, and thank people whatever they decide.
- Don’t ask one person to refer you for many roles at once; pick the best fit.
- Tell your referrer when you hear back. Many companies pay a referral bonus, but people mostly refer because they want good colleagues, so respect their time.`,
  },

  'online-assessment': {
    zh: `在线笔试（OA）是投递后发来的限时编程测试，对学生和应届生来说，常常是第一道筛选。

## 常见形式
- 60–120 分钟内做 2–4 道算法题，用隐藏测试用例判分。
- 有时还有调试题、选择题、工作风格问卷或 SQL 题。
- 有的测试会开摄像头或录屏。开始前读清规则：很多 OA 禁止任何外部帮助（包括 AI 工具），并且会查重。
- 各平台规则不同，见 [面试平台规则对照](/interview-platforms)。

## 考前准备
- 用你写得最快的语言，并熟悉它怎么读标准输入。我们的 [输入模板](/acm-io) 覆盖 Python、C++、Java 和 Go。
- 找一个安静的整块时间；大多数邀请会给你几天期限。
- 限时演练：[模拟 OA](/?view=mock) 会按真实格式出一套限时题。

## 考试时
1. 先通读所有题，从最容易的开始。
2. 先写对一个暴力解，再优化；通过部分用例往往也有分。
3. 看数据范围：元素个数在 10^5 左右，通常就不能用 O(n²)。
4. 自己测边界：空输入、单个元素、重复值、负数、最大值。
5. 留几分钟，把每道题最好的版本再交一遍（每题只能交一次的平台除外）。

## 考完之后
结果一般在一到三周内出来。不要干等，继续投递、继续练习。不知道该练哪些题型，可以从 [解题思路决策树](/flowchart) 和 [每站代码模板](/topics) 开始。`,
    en: `An online assessment (OA) is a timed coding test sent after you apply. For students and new graduates it is often the first filter.

## Common formats
- 2–4 algorithm problems in 60–120 minutes, judged by hidden test cases.
- Sometimes a debugging task, multiple-choice questions, a work-style survey or an SQL question.
- Some tests use the webcam or record the screen. Read the rules before you start: many forbid any outside help, AI tools included, and check for plagiarism.
- Each platform has its own rules; see the [interview platform rules](/interview-platforms).

## Before you start
- Use the language you are fastest in, and know how it reads standard input. Our [input templates](/acm-io) cover Python, C++, Java and Go.
- Find a quiet hour; most invitations give you several days.
- Rehearse against the clock: a [mock OA](/?view=mock) runs a timed set in the real format.

## During the test
1. Read every problem first and start with the easiest.
2. Get a correct brute force working before you optimise; passing some test cases often earns partial credit.
3. Check the input limits: around 10^5 elements usually rules out O(n²).
4. Test edge cases yourself: empty input, one element, duplicates, negative numbers, the largest values.
5. Keep a few minutes to resubmit the best version of each problem, unless the platform takes only one submission per problem.

## After the test
Results usually arrive within one to three weeks. Don’t wait: keep applying and practising. Not sure which patterns to drill? Start with the [pattern decision tree](/flowchart) and the [topic templates](/topics).`,
  },

  'phone-screen': {
    zh: `电话面（技术初面）通常是和一位工程师 45–60 分钟的视频通话，在共享编辑器里写代码。有些公司会先安排 20–30 分钟的招聘方电话，聊背景、时间安排和工作许可。

## 自我介绍模板
**30 秒版**：你是谁、一个亮点、为什么是这个岗位。
> 我是 State University 计算机系大四学生。去年夏天在支付团队实习，用缓存层把一个接口的 p99 延迟降了 40%。我喜欢做后端性能相关的工作，所以对这个岗位很感兴趣。

**2 分钟版**：再加一个项目和你想找的方向。
> 背景（15 秒）→ 最强的一段经历，带数字（45 秒）→ 另一个体现广度的项目（40 秒）→ 接下来想做什么、为什么是这家公司（20 秒）。

两个版本都大声练，练到自然，而不是背诵感。

## 编程部分怎么走
1. 复述题目，问清数据范围、边界情况和期望输出。
2. 先讲一个简单思路和它的复杂度，再动手写。
3. 边写边讲，变量名要清楚。
4. 拿一个例子手动走一遍，发现问题就改。
5. 最后说明时间和空间复杂度。

面试官评你的沟通，和评代码一样多。一直不说话，对方很难给分。

## 结尾可以问的问题
- 新人在团队里一周大致怎么度过？
- 代码怎么评审、怎么上线？
- 前六个月做到什么程度算是做得好？

可以在 [模拟面试](/mock-interview) 里带计时、带面试官练习。共享编辑器能不能运行代码、有没有补全，见 [面试平台规则对照](/interview-platforms)。`,
    en: `A phone screen (technical screen) is usually a 45–60 minute video call with one engineer, coding in a shared editor. Some companies start with a 20–30 minute recruiter call about your background, timing and work authorisation.

## Introduction templates
**30 seconds**: who you are, one highlight, why this role.
> I’m a final-year CS student at State University. Last summer I interned on a payments team, where I cut an API’s p99 latency by 40% with a caching layer. I enjoy backend performance work, which is why this role caught my eye.

**2 minutes**: add one more project and what you are looking for.
> Background (15 s) → your strongest experience, with a number (45 s) → a second project that shows range (40 s) → what you want next and why this company (20 s).

Practise both out loud until they sound natural rather than memorised.

## How the coding part runs
1. Restate the problem; ask about input sizes, edge cases and the expected output.
2. Talk through a simple approach and its complexity before you code.
3. Narrate as you code, with clear variable names.
4. Walk through an example by hand and fix what you find.
5. State the final time and space complexity.

Interviewers grade how you communicate as much as the code. Silence is hard to grade.

## Questions to ask at the end
- What does a typical week look like for a new engineer on the team?
- How is code reviewed and shipped?
- What would a great first six months look like?

Practise with a timer and an interviewer in [mock interviews](/mock-interview). Whether the shared editor runs code or autocompletes is covered in the [interview platform rules](/interview-platforms).`,
  },

  onsite: {
    zh: `终面在英文里仍叫 onsite，但现在很多是线上进行，通常是 3–5 轮、每轮 45–60 分钟，安排在一天或分几天完成。

## 各轮考什么
- **编程**（两到三轮）：和电面类似，追问更难。
- **行为面**（单独一轮，或穿插在每轮里）：用 STAR 讲过去的经历。准备 6–8 个故事，覆盖冲突、失败、领导力、需求不明确，以及你最自豪的项目。可以存在 [STAR 故事库](/?view=stories) 里反复打磨。
- **设计**：应届生多是面向对象设计或一个小系统（比如“设计短链接服务”）；有经验的工程师则是完整的系统设计。
- 有的公司还会加项目深挖，或者移动端、前端、数据等方向的专项轮。

## 职级大致怎么对应
各公司的职级叫法不同，下面只是粗略参考：
- 应届生：入门级（常叫 3 级，或 “SDE I”“Engineer I”）。
- 几年经验：中级（4 级，“SDE II”）。
- 资深：5 级及以上。

具体代号和要求因公司而异，以公司自己的说明和招聘方告诉你的为准。

## 面完之后
有的公司由招聘委员会根据面试官的记录统一决定，有的由用人经理决定。很多大公司会在发 offer 之后再给应届生匹配团队。一般需要一到三周。可以给招聘方发一封简短的感谢信；如果手上有其他 offer，可以问一下时间安排。

## 面试前一天
睡够，检查摄像头和编辑器，准备好水，重读你的故事，不要再刷新算法。`,
    en: `The final round is still called an “onsite”, though it often happens on video. It is usually 3–5 interviews of 45–60 minutes, on one day or spread over a few.

## What the rounds cover
- **Coding** (two or three rounds): like the phone screen, with harder follow-ups.
- **Behavioural** (its own round, or part of every round): past situations told with STAR. Prepare 6–8 stories that cover conflict, failure, leadership, ambiguity and a project you are proud of, and polish them in the [story bank](/?view=stories).
- **Design**: for new graduates usually object-oriented design or a small system (“design a URL shortener”); for experienced engineers, full system design.
- Some companies add a project deep-dive or a specialist round (mobile, front end, data).

## Levels, roughly
Companies name levels differently. As a rough guide only:
- New graduate: entry level (often called level 3, or “SDE I” / “Engineer I”).
- A few years of experience: mid level (level 4, “SDE II”).
- Senior: level 5 and above.

Codes and expectations differ by company; go by the company’s own description and what your recruiter tells you.

## After the interviews
Some companies decide in a hiring committee that reads the interviewers’ notes; at others the hiring manager decides. Many large companies match new graduates to a team after the offer. Expect one to three weeks. A short thank-you note to your recruiter is welcome, and if you hold other offers, ask about the timeline.

## The day before
Sleep, test your camera and editor, keep water nearby, and re-read your stories rather than learning new algorithms.`,
  },

  offer: {
    zh: `拿到 offer 是一段沟通的开始。本章只讲流程和话术；具体数字请查当前、可核实的来源，并对照你的城市和职级。

## 把 offer 读完整
- **基本工资**，按固定周期发放。
- **签字费**（sign-on bonus），通常一次性发放；一年内离职有时需要退还。
- **股票/期权**，分几年归属（vesting），常有一年的 cliff（满一年前什么都不归属）。
- **年度奖金**目标、搬家补贴、入职日期、地点和团队。
- **答复截止日期。**

比较 offer 时，按四年的预期总额算，不要只看第一年；也想想团队和你能学到什么。[Offer 对比计算器](/career/offers) 可以把几份 offer 的归属方式和签字费逐年摊开，算出 4 年税前总额。

## 礼貌地谈
1. 先感谢招聘方，并请对方提供书面 offer，再讨论调整。
2. 需要时间就早点提：“能否给我到 14 号周五？我还有一个流程在收尾。”
3. 只说真实存在的其他 offer 和截止日期，绝不编造。
4. 针对具体部分提问：“签字费或股票部分有没有调整空间？”
5. 所有改动都拿到书面确认后再接受。

应届 offer 的基本工资调整空间往往小于签字费或入职日期，也有公司完全不谈；礼貌地问一句，一般不会让 offer 出问题。

## 截止日期
很短的“爆炸 offer”确实存在。请求延期时给出一个具体日期。一旦接受，就要守约，并撤回其他流程。`,
    en: `An offer is the start of a conversation. This chapter covers the process and the wording only; for figures, look up current, verifiable sources for your city and level.

## Read the whole offer
- **Base salary**, paid on a schedule.
- **Sign-on bonus**, usually paid once and sometimes repayable if you leave within a year.
- **Equity**: stock units or options that vest over several years, often with a one-year cliff (nothing vests before the first anniversary).
- **Annual bonus** target, relocation support, start date, location and team.
- **The deadline.**

Compare offers by their expected total over four years, not the first year alone, and weigh the team and what you will learn. The [offer comparison calculator](/career/offers) lays out each offer’s vesting and sign-on year by year and adds up four years, pre-tax.

## Negotiate politely
1. Thank the recruiter and ask for the offer in writing before you discuss changes.
2. If you need time, ask early: “Could I have until Friday the 14th? I’m finishing another process.”
3. Mention only real competing offers and deadlines; never invent one.
4. Ask about specific parts: “Is there flexibility on the sign-on bonus or the equity?”
5. Get every change in writing before you accept.

New-grad offers often have less room on base salary than on the sign-on bonus or start date, and some companies don’t negotiate at all; a polite question rarely puts an offer at risk.

## Deadlines
Short “exploding” deadlines happen. Ask for an extension with a concrete date. Once you accept an offer, honour it and withdraw from other processes.`,
  },

  internship: {
    zh: `实习通常只有 10–12 周。最后能不能拿到转正（return offer），很大程度上取决于 manager 和 mentor 能不能清楚地看到你做成了什么。本章按时间顺序讲每个阶段该做的事，只讲通用做法；各公司流程不同，以你所在团队的说法为准。

## 入职前
- **先把身份文件办好。** 需要 CPT 或 OPT 的同学，开工前一定要拿到批准（OPT 要等 EAD 卡到手、并且到了卡上的开始日期）。不确定就问学校的国际学生办公室，详见[签证须知](/guide/visa)。
- **及时回复 HR 和招聘方的邮件**，按时交入职材料，完成背景调查，确认设备寄送地址。
- **了解团队在做什么。** 读一读团队公开的博客、文档或开源代码，补一补他们用的语言和工具。不用提前学完，认得这些名词就够了。
- **还没定组的话**，先看本章最后一节「选组电话」。

## 头两周：搭环境、认识人、问清目标
- **第一周的头号任务是把开发环境跑起来**：能拉代码、能在本地构建、能跑测试。卡住超过半天就去问，别一个人硬扛。顺手把踩过的坑补进新人文档，这本身就是一个小贡献。
- **和 manager 约好每周固定的 1:1**，和 mentor 说好平时怎么提问（聊天工具，或者固定的时间段）。
- **第一次 1:1 就问清楚“什么样算一次成功的实习”**：期末要交付什么，谁来评估，看哪些方面（代码质量、独立程度、沟通）。把答案记下来，之后每周拿它对照。
- **和组里每个人各约 15–30 分钟**，听听他们在做什么，你的项目会和谁打交道。
- **从第一周开始写成果日志**：每周五花十分钟，记下做成的事、收到的反馈和学到的东西。到了中期和期末写自评时，你会感谢现在的自己。[实习工具](/career/intern)可以帮你按周记。

## 第一个 PR
- **挑一个小的、边界清楚的任务**：修一个 bug、补一个测试、改一处文档。目的是把整个流程走通一遍（分支、提交、code review、CI、上线），不是证明能力。
- **提交前自己先 review 一遍**：描述里写清改了什么、为什么改、怎么测的。改动越小越好。
- **认真对待 review 意见**：逐条回复，改了就说明改了什么；不同意就讲理由，最后服从团队的约定。同一类意见别让人提第二次。
- **之后尽快接手正式项目**，先写一页设计文档：目标、不做什么、方案、里程碑。和 mentor 对齐范围之后再动手。

## 1:1 议程和周报模板
1:1 是你的会。提前准备议程，别让它变成随便聊聊。
\`\`\`text
1:1 议程（第 N 周）
1. 上周做完了什么（附链接）
2. 这周打算做什么
3. 卡在哪里 / 需要谁帮忙
4. 想听反馈的地方：……
5. 其他（职业发展、团队里的事）
\`\`\`
每周五给 manager 和 mentor 发一份简短的周报，三到五行就够：
\`\`\`text
本周：完成 X（链接），Y 完成约七成
下周：做完 Y，开始 Z
风险：Z 依赖另一个组的接口，已约周二讨论
\`\`\`
周报的内容直接从成果日志里摘，五分钟就能写完。

## 中期自评
很多团队会在实习中段做一次正式或非正式的反馈。没有安排也要主动要一次。
- **先自己写一页**：做成了什么（尽量带数字），收到过哪些反馈，接下来要改进什么。
- **在 1:1 上直接问**：“按现在的表现，我离转正还差什么？后半程最该加强哪一点？”
- **把反馈变成行动**：项目范围太大，就现在和 mentor 商量缩小。期末交付一个能用的版本，远比交一个做了一半的大项目好。
- [实习工具](/career/intern)可以把前半程的日志整理成中期自评草稿。

## 交接文档
你走之后，代码还要有人维护。一份好的交接文档，也是你留给团队最直接的印象。建议在倒数第二周写好，包括：
- 项目背景和目标，最后做到了哪一步
- 代码在哪里，怎么构建、运行和测试
- 设计上的取舍和原因
- 已知问题、没做完的事和建议的下一步
- 相关文档、看板和联系人

最后一周做一次简短的分享或 demo，讲清问题、方案和结果。

## 争取转正
- **转正看什么，第一周就可以问。** 照着这个标准持续交付，比最后几周突击有用得多。
- **倒数第三周左右问清流程**：谁来决定，什么时候出结果，还需要你提供什么。
- **期末自评把成果写清楚**，每一条都说明带来了什么影响。可以从日志导出的期末草稿开始改。
- **离开前当面道谢**，和 manager、mentor 留下联系方式，之后偶尔更新一下近况。
- **拿到转正 offer、手上又有外部 offer 时**，怎么比较、怎么回复见 [Offer 比较与谈薪](/guide/offer)；也可以先在[谈薪对练](/career/negotiation?s=return-plus-external)里把这段对话练一遍。
- 没拿到转正也不等于失败：这段实习和你在其中做成的事，仍是下一轮求职时简历上最有分量的内容。

## 选组电话
有的公司先发 offer，再安排你和几个组的 manager 通电话选组。这种电话是双向的：manager 在看你合不合适，你也在挑团队。
- **准备**：提前查一查每个组在做什么；准备一段一分钟的自我介绍，讲清背景和想做的方向；列好想问的问题。
- **可以问的问题**：实习生一般做什么样的项目，能不能举一个往届的例子；mentor 是谁，多久见一次；用什么技术栈；节奏怎么样，要不要 on-call；怎么判断实习是否成功；往届实习生的转正情况（问个大概就行）。
- **每通电话结束后五分钟内记下来**：manager 是谁，项目是什么，哪些回答让你在意。电话一多，记忆很快就会混在一起。
- **用加权打分来比**：先给几个因素（做的事、manager、成长、技术栈、影响、节奏、转正可能性）定权重，再给每个组打 1–5 分，算加权平均。分数是帮你理清想法的工具，最后也要听听自己的直觉。
- 排好顺序后，按公司要求及时提交意向，并向每位 manager 道谢。

## 下一步
打开[实习工具](/career/intern)：填好实习开始日期和周数，按周记成果，导出中期、期末自评草稿和 XYZ 格式的简历要点。选组电话的记录和加权打分也在那里。`,
    en: `An internship usually lasts 10–12 weeks, and whether it ends with a return offer depends a great deal on whether your manager and mentor can clearly see what you got done. This chapter walks through each stage in order. It covers general practice only: every company runs its own process, so go by what your team tells you.

## Before day one
- **Sort out your work authorisation first.** If you need CPT or OPT, it must be approved before you start work (for OPT, your EAD card must be in hand and its start date reached). If unsure, ask your school’s international student office, and see the [visa notes](/guide/visa).
- **Answer HR and your recruiter promptly**: send the onboarding forms on time, complete the background check and confirm where your equipment should go.
- **Learn what the team works on.** Read anything public, such as the team’s blog posts, docs or open-source code, and warm up on their language and tools. You don’t need to master them; knowing the names is enough.
- **If you have no team yet**, read the last section of this chapter, on team-matching calls.

## The first two weeks: setup, people and a clear goal
- **Your first job in week one is a working dev environment**: you can pull the code, build it locally and run the tests. If you are stuck for more than half a day, ask. Add the snags you hit to the onboarding doc; that is a small contribution in itself.
- **Set up a weekly 1:1 with your manager**, and agree with your mentor how you will ask questions (chat, or a standing time slot).
- **In your first 1:1, ask what a successful internship looks like**: what you should deliver by the end, who evaluates it, and what they look at (code quality, independence, communication). Write the answer down and measure each week against it.
- **Book 15–30 minutes with each teammate** to hear what they work on and who your project will touch.
- **Start a weekly log of your work in week one**: ten minutes every Friday for what you finished, the feedback you got and what you learned. Your midpoint and final self-reviews will thank you. The [internship tool](/career/intern) keeps it week by week.

## Your first PR
- **Pick a small, well-bounded task**: a bug fix, a missing test, a docs correction. The point is to walk the whole path once (branch, commit, code review, CI, deploy), not to prove yourself.
- **Review your own change first**: say in the description what changed, why, and how you tested it. Keep the change small.
- **Take review comments seriously**: reply to each one and say what you changed; if you disagree, give your reason, then follow the team’s convention. Don’t get the same comment twice.
- **Then move to your real project quickly**, starting with a one-page design doc: the goal, what is out of scope, the approach and the milestones. Agree the scope with your mentor before you build.

## A 1:1 agenda and a weekly update
The 1:1 is your meeting. Bring an agenda so it doesn’t drift into small talk.
\`\`\`text
1:1 agenda (week N)
1. Done last week (with links)
2. Plan for this week
3. Where I'm stuck / who I need help from
4. Feedback I'd like on: ...
5. Anything else (career, the team)
\`\`\`
Every Friday, send your manager and mentor a short update; three to five lines is enough:
\`\`\`text
This week: finished X (link); Y is about 70% done
Next week: finish Y, start Z
Risk: Z depends on another team's API; meeting booked for Tuesday
\`\`\`
The update comes straight from your log, so it takes five minutes.

## The midpoint self-review
Many teams hold a formal or informal check-in halfway through. If yours doesn’t, ask for one.
- **Write one page first**: what you got done (with numbers where you can), the feedback you have had, and what you will improve.
- **Ask directly in your 1:1**: “Based on how things are going, what stands between me and a return offer? What should I focus on in the second half?”
- **Turn the feedback into action**: if the project is too big, agree a smaller scope with your mentor now. A working version at the end beats a large project left half done.
- The [internship tool](/career/intern) turns the first half of your log into a midpoint draft.

## The handoff doc
Someone will maintain your code after you leave, and a good handoff doc is the clearest impression you leave behind. Write it in the second-to-last week:
- The project’s background and goal, and how far it got
- Where the code lives, and how to build, run and test it
- The design choices and why
- Known issues, unfinished work and suggested next steps
- Related docs, boards and contacts

In the last week, give a short presentation or demo: the problem, your approach and the result.

## Working toward a return offer
- **What the decision rests on is something you can ask in week one.** Delivering steadily against it beats a sprint in the final weeks.
- **About three weeks before the end, ask how the decision is made**: who decides, when you will hear, and whether they need anything from you.
- **Make your results clear in the final self-review**, each with the difference it made. The final draft exported from your log is a good place to start.
- **Thank people in person before you leave**, swap contact details with your manager and mentor, and send an update now and then.
- **If a return offer arrives while you hold an outside offer**, see [offers and negotiation](/guide/offer) for comparing and replying, and rehearse that conversation in the [negotiation practice](/career/negotiation?s=return-plus-external).
- No return offer doesn’t mean failure: the internship and what you built in it are still the strongest lines on your resume for the next search.

## Team-matching calls
Some companies make the offer first and then set up calls with the managers of a few teams. These calls run both ways: the manager is checking the fit, and you are choosing a team.
- **Prepare**: look up what each team works on; have a one-minute introduction covering your background and the work you want to do; list your questions.
- **Questions worth asking**: what kind of project interns usually get, with a past example; who your mentor would be and how often you would meet; the tech stack; the pace, and whether there is on-call; how the internship’s success is judged; how past interns fared on return offers (a rough picture is enough).
- **Write notes within five minutes of each call**: the manager, the project and any answer that stood out. After a few calls, memories blur.
- **Compare with weighted scores**: weight a few factors (the work, the manager, growth, the tech stack, impact, pace, return-offer odds), score each team 1–5 and take the weighted mean. The numbers help you sort out your thinking; your instinct still gets a say.
- Once you have a ranking, send your preferences when the company asks, and thank each manager.

## Next
Open the [internship tool](/career/intern): set your start date and length, log your work week by week, and export midpoint and final self-review drafts and XYZ resume bullets. Notes from team-matching calls and their weighted scores live there too.`,
  },

  visa: {
    zh: `**以下是一般性信息，不是法律意见。移民规则和费用会变，有时变得很快。行动前请咨询学校的国际学生办公室（美国是 DSO）或移民律师，并以 USCIS（美国）、IRCC（加拿大）官网为准。**

## 美国：F-1 学生
- **CPT（课程实习）**：工作属于课程的一部分时（例如有学分的实习），可在学习期间工作。由学校 DSO 针对具体雇主和日期批准。全职 CPT 累计 12 个月及以上，会失去 OPT 资格。
- **OPT（选择性实习）**：每个学位层级最多 12 个月工作许可，通常在毕业后使用。用 I-765 表向 USCIS 申请，一般在项目结束日前 90 天到结束后 60 天之间提交；必须等 EAD 卡批下来、且到了卡上的开始日期才能上班。毕业后的 OPT 有失业天数上限（90 天）。
- **STEM OPT 延期**：学位在 DHS 的 STEM 专业清单上的毕业生，可以在参加 E-Verify 的雇主处工作，并提交培训计划（I-983 表），把 OPT 延长 24 个月；失业天数上限再加 60 天。
- **H-1B** 是常见的长期工作签证。大多数首次申请要参加每年的注册抽签，通常在 3 月，10 月 1 日起生效；持有美国硕士及以上学位的人多一次机会。“Cap-gap” 规则可以衔接 OPT 结束和 H-1B 生效之间的空档。2025 年美国政府宣布对部分 H-1B 申请加收新费用，并把抽签改为按工资级别加权（FY2027 起）；请以你注册当年 USCIS 公布的规则为准。
- 想把自己的日期排一排：[身份时间线计算器](/career/visa-timeline) 按项目结束日和 OPT 日期算出各个窗口和截止日，数据只存在你的浏览器里。

## 加拿大
- 持学签在读期间可以校外打工，但每周有工时上限，近几年调整过。
- 符合条件的项目毕业后可以申请 **PGWP（毕业工签）**，时长取决于项目长度。2024 年资格收紧（包括语言成绩要求，以及部分项目的专业领域要求）。选项目或申请前请先查 IRCC。

## 申请和面试时
- 申请表常问“现在或将来是否需要签证担保”。如实回答，虚假回答可能让你失去 offer。
- 有的雇主不提供签证担保，职位描述里通常会写明；也可以尽早问招聘方。
- 保存好每份文件，记下每个截止日期。错过递交窗口很难补救。`,
    en: `**This is general information, not legal advice. Immigration rules and fees change, sometimes quickly. Before you act, check with your school’s international student office (your DSO in the US) or an immigration attorney, and go by the official USCIS (US) and IRCC (Canada) pages.**

## United States: F-1 students
- **CPT (Curricular Practical Training)** lets you work during your programme when the work is part of your curriculum, such as a credit-bearing internship. Your school’s DSO authorises it for a specific employer and dates. Twelve months or more of full-time CPT ends your eligibility for OPT.
- **OPT (Optional Practical Training)** gives up to 12 months of work authorisation per degree level, usually used after graduation. You apply to USCIS with Form I-765, typically from 90 days before to 60 days after your programme end date, and you may only start work once your EAD card is approved and its start date has arrived. Post-completion OPT allows a limited number of unemployment days (90).
- **STEM OPT extension**: graduates of degrees on the DHS STEM list can extend OPT by 24 months while working for an employer enrolled in E-Verify, with a training plan (Form I-983). The unemployment allowance grows by 60 days.
- **H-1B** is the usual longer-term work visa. Most first-time petitions go through an annual registration lottery, typically in March, for an October 1 start; holders of a US master’s or higher degree get an extra chance. “Cap-gap” rules can bridge the time between the end of OPT and an H-1B start. In 2025 the US government announced a new fee for some H-1B petitions and moved selection to a lottery weighted by wage level (from FY2027); check USCIS for the rules in force in the year you register.
- To lay out your own dates, the [visa timeline calculator](/career/visa-timeline) works out each window and deadline from your program end and OPT dates, and keeps them in your browser only.

## Canada
- A study permit may allow off-campus work during your studies, up to a weekly hour limit that has changed in recent years.
- An eligible programme can lead to a **Post-Graduation Work Permit (PGWP)**, whose length depends on the programme’s length. Eligibility was tightened in 2024 (including a language-test requirement and, for some programmes, field-of-study requirements). Check IRCC before you choose a programme or apply.

## In applications and interviews
- Forms often ask whether you will now or in the future require sponsorship. Answer truthfully; a false answer can cost you the offer.
- Some employers do not sponsor visas, and their postings usually say so. You can also ask the recruiter early.
- Keep a copy of every document and note every deadline. A missed filing window is hard to undo.`,
  },
};
