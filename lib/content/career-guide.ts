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

  practice: {
    zh: `练习的效果主要看怎么练，而不只是做了多少道。下面这套节奏用的都是 CSWork 里现成的工具：题目计时器、三条提示、复习队列和模拟 OA。

## 一道题的节奏
1. 读完题面和数据范围，用自己的话把要求复述一遍。
2. 打开题目计时器。它默认正计时；切成倒计时，会按难度预设时长：简单题 15 分钟、中等 25 分钟、困难 40 分钟。
3. 先独立想 25–40 分钟。这段时间只看题面，不看提示，也不搜题解。想不到最优解，就先写一个正确的暴力解。
4. 写完先用样例和自己构造的边界数据测一遍，再正式提交。
5. 通过后用一两句话写下关键思路，复习时最先看到的就是它。

面试时要边写边讲。说不出某个术语的英文，可以查 [算法术语中英对照](/topics/glossary)，每条都配了一句能照着说的例句。

## 提示一次只升一级
500 路的每道题都有三条提示，由浅到深：
- 第 1 条随时能看，一般只指个方向；
- 第 2 条在一次正式提交没通过、或者在这道题上花满 10 分钟后解锁；
- 第 3 条在两次正式提交没通过后解锁，通常已经很接近完整思路。

每看一条，先回去自己再想几分钟，确实还卡着再看下一条。三条一口气看完，和直接看题解没什么区别。

## 什么时候看题解，怎么补题
三条提示都看过、也认真想过，还是没有思路，就去看题解，不用硬耗。看题解有三步：
1. 看懂思路后关掉题解，从空白的编辑器重新写，直到通过。
2. 想清楚自己卡在哪一步：没认出题型、想到了写不对，还是漏了边界情况。
3. 把这一站的模板默写一遍。各站模板可以在线看，也可以 [打印成手册](/topics/print)。

比赛或模拟结束后，把没做出来的题按这三步补完，这就是补题（upsolve）。补一道题，常常比多做一道新题学到的更多。

## 独立做出和借助提示的区别
系统会记下每道题是怎么通过的：只要用过提示或看过题解，就算「借助提示」通过。
- 独立通过的题按 3、7、21、60 天的间隔回来复习；
- 借助提示通过的题，第一次复习提前到 1 天后，之后再走同样的间隔，所以要多复习一次才算掌握。

这不是惩罚。需要提示才做出来，说明这道题还没真正掌握，早一点再做一遍记得更牢。所以既不用为了「独立通过」硬撑，也别看完题解就当自己会了。

## 复习自评
到期的题会出现在 [今日复习](/?view=review-session) 里，和你的记忆卡、选择题在同一个队列。复习时不看旧代码，重新写一遍并通过，然后给自己打分：
- 「重来」：明天再做；
- 「困难」：间隔不变；
- 「良好」：进入下一档；
- 「简单」：跳过一档。

不打分按「良好」算。连续两次、或累计三次评「重来」的题会被列为顽固题，最好回到对应的专题页，把模板和要点重新过一遍。记忆卡另有一套间隔：1、3、7、21 天。

## 每天新题和复习的配比
- 先做到期的复习，再做新题。复习花时间少、收益高，拖着不做只会越积越多。
- 时间紧的日子，做完复习再做一道 [每日一题](/daily) 就够了。
- 新题按 [500 路题单](/?view=problems) 的专题顺序往下做，同一时间只集中练一两个专题。不知道从哪开始，先做一次 [题型识别测验](/placement)，已经掌握的专题可以跳过。
- 到期的复习一天做不完时，停一两天新题，先把积压清掉。

## 每周一场模拟 OA
每周找一段固定的整块时间，做一场限时模拟：
- 在 [模拟 OA](/?view=mock) 开一场限时模拟；想按某家公司的题量和时长来练，就从 [公司模拟 OA](/mock-oa) 里挑一套。
- 按考试的规矩来：中途不查资料、不看提示，时间到就停笔。
- 结束后先看丢分的是哪几题、为什么丢，再按上面的步骤补题。

每周一场足够熟悉时间压力，又不会挤掉平时的练习；离真实 OA 近了，可以加到每周两场。考试当天要注意什么，见 [在线笔试 OA](/guide/online-assessment)。

## 卡住了、倦怠了怎么办
- 同一个专题连着几天都做不出来，就往回退一站，把前置专题的模板练熟再回来。
- 换一种方式学同一个知识点：看专题页的动画和要点，做做模板练习，比一道接一道硬做新题有效。
- 状态差的日子把量降到最低，只做复习或每日一题。保持连续，比偶尔猛刷一天更重要。
- 累了就歇一两天。复习队列会等你，回来先清复习，节奏很快就能找回来。`,
    en: `How you practise matters more than how many problems you get through. The routine below uses tools that are already in CSWork: the problem timer, three hints per problem, the review queue and mock OAs.

## The rhythm of one problem
1. Read the statement and the input limits, then restate the task in your own words.
2. Start the problem timer. It runs as a stopwatch by default; switch it to a countdown and it presets 15 minutes for Easy, 25 for Medium and 40 for Hard.
3. Think on your own for 25–40 minutes. Look only at the statement: no hints and no searching for solutions. If the optimal idea doesn't come, write a correct brute force first.
4. Test with the samples and edge cases you make up yourself, then submit.
5. Once it passes, write the key idea in a sentence or two. It is the first thing you will see when the problem comes back for review.

In an interview you explain while you code. When you can't find the English word for a technique, look it up in the [Chinese–English glossary](/topics/glossary); every term comes with a sentence you can say as it is.

## Climb the hints one step at a time
Every Line 500 problem has three hints, from light to strong:
- hint 1 is open at any time and usually just points a direction;
- hint 2 unlocks after one failed submission or after 10 minutes on the problem;
- hint 3 unlocks after two failed submissions and is usually close to the full idea.

After each hint, go back and think for a few more minutes. Open the next one only if you are still stuck. Reading all three in a row is no different from reading the editorial.

## When to read the editorial, and how to upsolve
If you have read all three hints and thought hard and still have no idea, read the editorial instead of grinding on. Then:
1. Once you understand the idea, close the editorial and write the solution from an empty editor until it passes.
2. Name where you got stuck: you didn't recognise the pattern, you had the idea but couldn't code it, or you missed an edge case.
3. Write the stop's template from memory. The templates are online, or [printed as one handbook](/topics/print).

After a contest or a mock, finish the problems you missed the same way. That is upsolving, and one upsolved problem often teaches more than one more new problem.

## Solved alone or with help
CSWork records how each problem was solved: if you opened a hint or read the editorial, it counts as solved with help.
- Problems solved alone come back for review after 3, 7, 21 and 60 days.
- Problems solved with help come back after one day first and then follow the same steps, so mastering them takes one review more.

This is not a penalty. Needing help means the problem isn't yours yet, and seeing it again sooner makes it stick. So don't hold out just to keep a clean record, and don't treat a read editorial as a solved problem.

## Grading your reviews
Due problems show up in the [review session](/?view=review-session), in the same queue as your cards and multiple-choice questions. Review without looking at your old code: write it again until it passes, then grade yourself:
- Again: it comes back tomorrow;
- Hard: the wait stays the same;
- Good: it moves one step on;
- Easy: it skips a step.

No grade counts as Good. A problem graded Again on two reviews in a row, or on three in all, is marked as a leech; go back to its topic page and run through the template and key points again. Review cards follow their own steps: 1, 3, 7 and 21 days.

## Mixing new problems and reviews each day
- Do the due reviews first, then new problems. Reviews are quick and pay off well; put them off and they pile up.
- On a busy day, the reviews plus the [daily problem](/daily) are enough.
- Take new problems from the [Line 500 list](/?view=problems) in topic order, and focus on one or two topics at a time. Not sure where to start? Take the [placement quiz](/placement) first and skip the topics you already know.
- When there are more due reviews than you can finish in a day, pause new problems for a day or two and clear the backlog.

## One mock OA a week
Pick a fixed block of time each week for one timed mock:
- Start a timed set in [mock OA](/?view=mock); to match one company's question count and time limit, pick a set from the [company mock OAs](/mock-oa).
- Follow test rules: no looking things up, no hints, and stop when time runs out.
- Afterwards, see which problems lost points and why, then upsolve them as above.

One a week is enough to get used to the clock without crowding out regular practice; close to a real OA you can do two. For the day of the test itself, see [online assessments](/guide/online-assessment).

## When you are stuck or worn out
- If one topic beats you several days running, step back one stop and drill the prerequisite's template before you return.
- Learn the same idea another way: watch the topic page's animation, reread its key points and do its template drills. That works better than forcing one new problem after another.
- On a bad day, cut the load to the minimum: only reviews, or only the daily problem. A steady streak beats the occasional marathon.
- When you are tired, take a day or two off. The review queue will wait; clear it first when you come back and the rhythm returns quickly.`,
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
