// A checklist at the end of six career guide chapters (components/guide-checklist.tsx). Every item
// restates advice from its chapter (lib/content/career-guide.ts) and adds no new claims. Item ids
// are saved in the learner's note checklist:<chapter>, so keep them once shipped.

export type ChecklistItem = {
  id: string;
  text: [string, string];
  /** The why, from the chapter. */
  detail: [string, string];
  /** A page on the site that helps with it. */
  href?: string;
};

export const CAREER_CHECKLISTS: Record<string, ChecklistItem[]> = {
  resume: [
    {
      id: 'one-page',
      text: ['学生和应届生的简历控制在一页', 'Keep it to one page as a student or new graduate'],
      detail: [
        '招聘方往往不到一分钟就决定要不要往下推，一页纸逼你只留最有分量的内容。',
        'A recruiter often decides in under a minute; one page keeps only your strongest lines.',
      ],
    },
    {
      id: 'section-order',
      text: ['板块顺序：教育、经历、项目、技能', 'Order the sections: Education, Experience, Projects, Skills'],
      detail: [
        '有全职工作经验以后，把经历放到最前面。每个板块内按时间倒序。',
        'Once you have full-time work, put Experience first. Within each section, newest first.',
      ],
    },
    {
      id: 'ats-layout',
      text: ['单栏排版、标准标题，导出 PDF', 'Single column, standard headings, exported as PDF'],
      detail: [
        '招聘系统（ATS）最擅长读纯文字，表格、文本框、图标和照片都容易读错。',
        'Applicant tracking systems read plain text best; tables, text boxes, icons and photos are easy to misread.',
      ],
    },
    {
      id: 'no-personal',
      text: ['投北美岗位时去掉照片、出生日期和婚姻状况', 'For US and Canadian roles, remove photo, date of birth and marital status'],
      detail: ['这和国内简历的习惯不同。', 'This differs from resume habits in some other countries.'],
    },
    {
      id: 'xyz',
      text: ['每条经历按 XYZ 写：做了什么、怎么衡量、怎么做到', 'Write each bullet as XYZ: what, measured how, done how'],
      detail: [
        '“完成了 X，用 Y 衡量，方法是 Z。”比“参与某功能开发”能说明得多。',
        '“Accomplished X, as measured by Y, by doing Z” says far more than “worked on a feature”.',
      ],
    },
    {
      id: 'honest-numbers',
      text: ['每个数字都说得清来源，绝不编造', 'Every number is one you can explain; none invented'],
      detail: [
        '没有精确数字时写一个站得住的估计（“约 30%”）。面试官会追问数字。',
        'Without an exact figure, use an estimate you can defend (“about 30%”). Interviewers ask about numbers.',
      ],
    },
    {
      id: 'strong-verbs',
      text: ['每条以有力的动词开头', 'Start every bullet with a strong verb'],
      detail: [
        '用设计、实现、上线、降低、主导这类说出具体工作的词，少用“参与”“负责”。',
        'Built, designed, shipped, reduced, led: verbs that name the work. Avoid “responsible for” and “helped with”.',
      ],
    },
    {
      id: 'star',
      text: ['把项目故事按 STAR 整理好', 'Have your project stories in STAR form'],
      detail: [
        '情境、任务、行动、结果，篇幅主要留给行动和结果。攒在故事库里，面试也用得上。',
        'Situation, Task, Action, Result, with most words on Action and Result. Keep them in the story bank for interviews too.',
      ],
      href: '/?view=stories',
    },
    {
      id: 'tailor',
      text: ['针对每个岗位改一版', 'Tailor it to each posting'],
      detail: [
        '在属实的前提下，用职位描述里的原词：同一种语言、框架或业务领域。',
        'Where it is true for you, use the posting’s own words: the same language, framework or domain.',
      ],
    },
    {
      id: 'check-against-jd',
      text: ['对照职位描述再检查一遍', 'Check it against the posting once more'],
      detail: [
        '看成果有没有量化、动词够不够有力、关键词有没有漏。',
        'Look at whether results are measured, verbs are strong and keywords are covered.',
      ],
      href: '/career/jd',
    },
  ],
  referrals: [
    {
      id: 'know-limits',
      text: ['清楚内推能做什么、不能做什么', 'Know what a referral does and doesn’t do'],
      detail: [
        '内推的简历往往更快被看到，但不能跳过面试，也不保证一定有面试。',
        'A referred resume often gets read sooner; it doesn’t skip the interviews or guarantee one.',
      ],
    },
    {
      id: 'people-who-know',
      text: ['先问了解你工作的人', 'Ask people who know your work first'],
      detail: ['以前的同事、导师、同学、助教。', 'Former teammates, managers, classmates, teaching assistants.'],
    },
    {
      id: 'alumni',
      text: ['再找在这家公司的校友', 'Then alumni who work there'],
      detail: [
        '同校或同项目的学长学姐，或者在活动、网上真正聊过的工程师。',
        'Alumni of your school or programme, or engineers you have actually talked to at events or online.',
      ],
    },
    {
      id: 'not-strangers',
      text: ['少给完全陌生的人群发请求', 'Don’t mass-message complete strangers'],
      detail: ['陌生请求的成功率低得多，短而具体的消息更有效。', 'Those work far less often; a short, specific message does better.'],
    },
    {
      id: 'job-id',
      text: ['附上岗位准确名称和链接或编号', 'Include the exact job title and link or ID'],
      detail: ['让对方不用再去找你说的是哪个岗位。', 'So they don’t have to work out which role you mean.'],
    },
    {
      id: 'resume-pdf',
      text: ['附上 PDF 简历', 'Attach your resume as a PDF'],
      detail: ['要发的三样东西之一：岗位、简历、你为什么适合。', 'One of the three things to send: the role, your resume, and why you fit.'],
    },
    {
      id: 'why-fit',
      text: ['用两三句话说明为什么适合', 'Say why you fit in two or three sentences'],
      detail: [
        '挑一段最相关的经历，最好带一个数字，和团队的方向对上。',
        'Pick your most relevant experience, ideally with a number, that matches the team’s work.',
      ],
      href: '/career/templates',
    },
    {
      id: 'easy-no',
      text: ['让对方容易拒绝，无论结果都道谢', 'Make it easy to say no, and thank them either way'],
      detail: [
        '大家内推更多是想找到好同事，请尊重对方的时间。',
        'People mostly refer because they want good colleagues; respect their time.',
      ],
    },
    {
      id: 'one-role',
      text: ['不请同一个人一次推很多岗位', 'Don’t ask one person for many roles at once'],
      detail: ['挑最合适的一个。', 'Pick the best fit.'],
    },
    {
      id: 'update-referrer',
      text: ['有进展时告诉内推人', 'Tell your referrer when you hear back'],
      detail: [
        '在联系人里记下谁帮你推了哪个岗位，设一个跟进日期。',
        'Note in your contacts who referred you for which role, with a follow-up date.',
      ],
      href: '/career/contacts',
    },
  ],
  'online-assessment': [
    {
      id: 'read-rules',
      text: ['开始前读清规则', 'Read the rules before you start'],
      detail: [
        '有的测试会开摄像头或录屏；很多 OA 禁止任何外部帮助（包括 AI 工具），并且会查重。',
        'Some tests use the webcam or record the screen; many forbid any outside help, AI tools included, and check for plagiarism.',
      ],
    },
    {
      id: 'fast-language',
      text: ['用你写得最快的语言，熟悉它怎么读输入', 'Use your fastest language and know how it reads input'],
      detail: ['输入模板覆盖 Python、C++、Java 和 Go。', 'The input templates cover Python, C++, Java and Go.'],
      href: '/acm-io',
    },
    {
      id: 'quiet-hour',
      text: ['在期限内留出一段安静的整块时间', 'Set aside a quiet hour before the deadline'],
      detail: ['大多数邀请会给你几天期限。', 'Most invitations give you several days.'],
    },
    {
      id: 'mock',
      text: ['限时做一套模拟 OA', 'Rehearse a timed mock OA'],
      detail: ['按真实格式出一套限时题，提前适应节奏。', 'A timed set in the real format, so the pace isn’t new on the day.'],
      href: '/?view=mock',
    },
    {
      id: 'read-all',
      text: ['先通读所有题，从最容易的开始', 'Read every problem first; start with the easiest'],
      detail: ['常见形式是 60–120 分钟 2–4 道题，用隐藏用例判分。', 'Often 2–4 problems in 60–120 minutes, judged by hidden tests.'],
    },
    {
      id: 'brute-force',
      text: ['先写对暴力解，再优化', 'Get a correct brute force first, then optimise'],
      detail: ['通过部分用例往往也有分。', 'Passing some test cases often earns partial credit.'],
    },
    {
      id: 'limits',
      text: ['看数据范围定复杂度', 'Let the input limits set the complexity'],
      detail: ['元素个数在 10^5 左右，通常就不能用 O(n²)。', 'Around 10^5 elements usually rules out O(n²).'],
    },
    {
      id: 'edge-cases',
      text: ['自己测边界情况', 'Test the edge cases yourself'],
      detail: ['空输入、单个元素、重复值、负数、最大值。', 'Empty input, one element, duplicates, negative numbers, the largest values.'],
    },
    {
      id: 'resubmit',
      text: ['留几分钟把每题最好的版本再交一遍', 'Keep a few minutes to resubmit each best version'],
      detail: ['确保最后记录的是你最好的那份代码。', 'So what counts is your best code for each problem.'],
    },
    {
      id: 'keep-going',
      text: ['考完不干等，继续投递和练习', 'After it, keep applying and practising'],
      detail: [
        '结果一般一到三周出来。不知道练什么，可以从解题思路决策树开始。',
        'Results usually take one to three weeks. Not sure what to drill? Start with the pattern decision tree.',
      ],
      href: '/flowchart',
    },
  ],
  'phone-screen': [
    {
      id: 'intro-30',
      text: ['准备 30 秒自我介绍', 'Prepare a 30-second introduction'],
      detail: ['你是谁、一个亮点、为什么是这个岗位。', 'Who you are, one highlight, why this role.'],
    },
    {
      id: 'intro-2min',
      text: ['准备 2 分钟版本', 'Prepare a 2-minute version'],
      detail: [
        '背景 → 最强的一段经历（带数字）→ 另一个体现广度的项目 → 接下来想做什么、为什么是这家公司。',
        'Background → your strongest experience, with a number → a second project that shows range → what you want next and why this company.',
      ],
    },
    {
      id: 'out-loud',
      text: ['两个版本都大声练到自然', 'Practise both out loud until they sound natural'],
      detail: ['目标是自然，而不是背诵感。', 'Natural, not memorised.'],
    },
    {
      id: 'recruiter-call',
      text: ['准备好招聘方电话会问的事', 'Be ready for the recruiter call'],
      detail: [
        '有些公司会先安排 20–30 分钟的招聘方电话，聊背景、时间安排和工作许可。',
        'Some companies start with a 20–30 minute recruiter call about your background, timing and work authorisation.',
      ],
    },
    {
      id: 'clarify',
      text: ['先复述题目，问清范围和边界', 'Restate the problem; ask about sizes and edge cases'],
      detail: ['包括数据范围、边界情况和期望输出。', 'Input sizes, edge cases and the expected output.'],
    },
    {
      id: 'approach-first',
      text: ['写代码前先讲思路和复杂度', 'Explain an approach and its complexity before coding'],
      detail: ['先说一个简单思路，对方认可后再动手。', 'Start with a simple approach before you write anything.'],
    },
    {
      id: 'narrate',
      text: ['边写边讲，变量名清楚', 'Narrate as you code, with clear names'],
      detail: [
        '面试官评你的沟通和评代码一样多，一直不说话很难给分。',
        'Interviewers grade communication as much as the code; silence is hard to grade.',
      ],
    },
    {
      id: 'walk-through',
      text: ['拿一个例子手动走一遍', 'Walk through an example by hand'],
      detail: ['发现问题就改，最后说明时间和空间复杂度。', 'Fix what you find, then state the time and space complexity.'],
    },
    {
      id: 'questions',
      text: ['准备两三个结尾要问的问题', 'Have two or three questions for the end'],
      detail: [
        '比如新人一周怎么过、代码怎么评审和上线、前六个月做到什么程度算好。',
        'For example: a new engineer’s typical week, how code is reviewed and shipped, what a great first six months looks like.',
      ],
    },
    {
      id: 'mock',
      text: ['带计时、带面试官练一次', 'Practise once with a timer and an interviewer'],
      detail: ['模拟面试按真实节奏来。', 'Mock interviews follow the real pace.'],
      href: '/mock-interview',
    },
  ],
  onsite: [
    {
      id: 'rounds',
      text: ['弄清楚各轮考什么', 'Find out what each round covers'],
      detail: [
        '通常 3–5 轮、每轮 45–60 分钟：编程、行为面、设计，有时还有项目深挖或专项轮。',
        'Usually 3–5 interviews of 45–60 minutes: coding, behavioural, design, sometimes a deep-dive or specialist round.',
      ],
    },
    {
      id: 'coding-follow-ups',
      text: ['编程轮准备好更难的追问', 'Expect harder follow-ups in the coding rounds'],
      detail: ['形式和电面类似，但追问更深。', 'Like the phone screen, with harder follow-ups.'],
    },
    {
      id: 'stories',
      text: ['准备 6–8 个 STAR 故事', 'Prepare 6–8 STAR stories'],
      detail: [
        '覆盖冲突、失败、领导力、需求不明确，以及你最自豪的项目。',
        'Cover conflict, failure, leadership, ambiguity and a project you are proud of.',
      ],
      href: '/?view=stories',
    },
    {
      id: 'design',
      text: ['按级别准备设计轮', 'Prepare the design round for your level'],
      detail: [
        '应届生多是面向对象设计或一个小系统（比如短链接服务）；有经验的工程师是完整的系统设计。',
        'New graduates usually get object-oriented design or a small system (a URL shortener); experienced engineers get full system design.',
      ],
      href: '/system-design',
    },
    {
      id: 'level',
      text: ['弄清楚应聘的职级', 'Know which level you are interviewing for'],
      detail: [
        '各公司职级叫法不同，以公司自己的说明和招聘方告诉你的为准。',
        'Companies name levels differently; go by the company’s description and what your recruiter tells you.',
      ],
    },
    {
      id: 'setup',
      text: ['前一天检查摄像头和编辑器', 'Test your camera and editor the day before'],
      detail: ['线上终面很常见，准备好水。', 'Final rounds are often on video; keep water nearby.'],
    },
    {
      id: 'rest',
      text: ['前一天睡够，重读故事，不再刷新算法', 'Sleep, re-read your stories, skip new algorithms'],
      detail: ['复习已经准备好的内容，而不是学新东西。', 'Review what you have prepared rather than learning anything new.'],
    },
    {
      id: 'thank-you',
      text: ['面完给招聘方发一封简短的感谢信', 'Send your recruiter a short thank-you note'],
      detail: ['几句话就好。', 'A few lines are enough.'],
      href: '/career/templates?template=thank-you',
    },
    {
      id: 'timeline',
      text: ['手上有其他 offer 时问清时间安排', 'If you hold other offers, ask about the timeline'],
      detail: [
        '结果一般需要一到三周；很多大公司在发 offer 后再给应届生匹配团队。',
        'Expect one to three weeks; many large companies match new graduates to a team after the offer.',
      ],
    },
  ],
  offer: [
    {
      id: 'in-writing',
      text: ['先道谢，请对方提供书面 offer', 'Thank the recruiter and ask for the offer in writing'],
      detail: ['讨论任何调整之前先拿到书面版本。', 'Before you discuss any changes.'],
    },
    {
      id: 'base',
      text: ['读清基本工资和发放周期', 'Read the base salary and pay schedule'],
      detail: ['它是每期固定发放的部分。', 'The part paid on a fixed schedule.'],
    },
    {
      id: 'sign-on',
      text: ['读清签字费和退还条件', 'Read the sign-on bonus and when it is repayable'],
      detail: ['通常一次性发放；一年内离职有时需要退还。', 'Usually paid once; sometimes repayable if you leave within a year.'],
    },
    {
      id: 'equity',
      text: ['读清股票或期权的归属方式', 'Read how the equity vests'],
      detail: [
        '通常分几年归属，常有一年 cliff：满一年前什么都不归属。',
        'Usually over several years, often with a one-year cliff: nothing vests before the first anniversary.',
      ],
    },
    {
      id: 'the-rest',
      text: ['核对奖金、搬家补贴、入职日期、地点和团队', 'Check bonus, relocation, start date, location and team'],
      detail: ['这些都写在 offer 里，也都可能影响你的选择。', 'All of them are in the offer and can change your choice.'],
    },
    {
      id: 'deadline',
      text: ['记下答复截止日期', 'Note the deadline'],
      detail: [
        '很短的“爆炸 offer”确实存在。把它记到投递卡的跟进日期上。',
        'Short “exploding” deadlines happen. Put it on the card as the follow-up date.',
      ],
      href: '/career/tracker',
    },
    {
      id: 'four-years',
      text: ['按四年预期总额比较，不只看第一年', 'Compare four-year totals, not the first year'],
      detail: ['也想想团队和你能学到什么。', 'And weigh the team and what you will learn.'],
      href: '/career/offers',
    },
    {
      id: 'ask-time',
      text: ['需要时间就早点提，给出具体日期', 'Need time? Ask early, with a concrete date'],
      detail: ['比如“能否给我到 14 号周五？”', 'For example: “Could I have until Friday the 14th?”'],
      href: '/career/templates?template=extension',
    },
    {
      id: 'real-only',
      text: ['只提真实存在的其他 offer 和截止日期', 'Mention only real competing offers and deadlines'],
      detail: ['绝不编造。', 'Never invent one.'],
    },
    {
      id: 'specific-ask',
      text: ['针对具体部分提问', 'Ask about a specific part'],
      detail: [
        '比如签字费或股票。应届 offer 的基本工资调整空间往往更小，也有公司完全不谈。',
        'Such as the sign-on bonus or equity. New-grad base salary often has less room, and some companies don’t negotiate at all.',
      ],
      href: '/career/templates?template=counter-no-competing',
    },
    {
      id: 'confirm',
      text: ['所有改动拿到书面确认后再接受', 'Get every change in writing before you accept'],
      detail: ['口头答应的调整要出现在最终的书面 offer 里。', 'Anything agreed on a call belongs in the final written offer.'],
    },
    {
      id: 'honour',
      text: ['接受后守约，撤回其他流程', 'Once you accept, honour it and withdraw elsewhere'],
      detail: ['尽早通知其他公司，让他们能安排别的候选人。', 'Tell the others early so they can move on.'],
      href: '/career/templates?template=decline-interview',
    },
  ],
};
