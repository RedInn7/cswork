// The career guide (/guide): chapter list and the recruiting-season strip. Client-safe and
// small, so lib/seo.ts can list the pages; the chapter bodies live in lib/content/career-guide.ts.

export type GuideChapter = {
  slug: string;
  title: [string, string];
  /** One line for the index and the meta description. */
  summary: [string, string];
};

export const GUIDE_CHAPTERS: GuideChapter[] = [
  {
    slug: 'timeline',
    title: ['北美校招与实习时间线', 'The North American recruiting calendar'],
    summary: [
      '实习和应届岗位几月开放、几月考 OA、几月发 offer，以及国内秋招春招的节奏。',
      'When internship and new-grad roles open, when assessments and finals happen, and how campus hiring in China lines up.',
    ],
  },
  {
    slug: 'resume',
    title: ['简历：用 XYZ 公式写出成果', 'Resume: show results with the XYZ formula'],
    summary: [
      '一页纸的结构、XYZ 与 STAR 写法、强动词、ATS 友好排版，附可直接套用的模板。',
      'One-page structure, XYZ and STAR bullets, strong verbs, ATS-friendly layout and a template to copy.',
    ],
  },
  {
    slug: 'referrals',
    title: ['内推：找谁、怎么开口', 'Referrals: who to ask and how'],
    summary: [
      '内推能做什么、不能做什么，找谁更有效，消息怎么写，以及基本礼仪。',
      'What a referral does and does not do, who to ask, a message that works and the etiquette.',
    ],
  },
  {
    slug: 'practice',
    title: ['怎么练习：计时、提示、复习与模拟 OA', 'How to practise: timing, hints, reviews and mock OAs'],
    summary: [
      '一道题的节奏、提示怎么用、什么时候看题解和补题、复习自评、每天新题与复习的配比，以及每周一场模拟 OA。',
      'The rhythm of one problem, using hints, when to read the editorial and upsolve, grading reviews, mixing new problems with reviews, and a weekly mock OA.',
    ],
  },
  {
    slug: 'online-assessment',
    title: ['在线笔试 OA', 'Online assessments'],
    summary: [
      '常见题量与时长、监考与规则、考前准备和考场上的做题顺序。',
      'Typical formats and time limits, proctoring rules, how to prepare and how to work through the test.',
    ],
  },
  {
    slug: 'phone-screen',
    title: ['电话面与自我介绍', 'Phone screens and your introduction'],
    summary: [
      '30 秒和 2 分钟自我介绍模板、技术电面的流程，以及结尾可以问的问题。',
      '30-second and 2-minute introduction templates, how a technical screen runs and questions to ask at the end.',
    ],
  },
  {
    slug: 'onsite',
    title: ['终面（Onsite）、行为面与职级', 'Final rounds, behavioural interviews and levels'],
    summary: [
      '终面各轮考什么、STAR 故事怎么准备、职级大致怎么对应，以及面完之后的流程。',
      'What each final round covers, preparing STAR stories, how levels roughly map and what happens afterwards.',
    ],
  },
  {
    slug: 'offer',
    title: ['Offer 比较与谈薪基础', 'Offers and negotiation basics'],
    summary: [
      '读懂 offer 的各个部分、按四年总额比较、礼貌谈薪的流程和话术、截止日期怎么处理。只讲流程，不收录薪资数据。',
      'Reading every part of an offer, comparing four-year totals, polite negotiation steps and wording, and deadlines. Process only, no salary data.',
    ],
  },
  {
    slug: 'internship',
    title: ['实习手册：从入职到转正', 'The internship: from day one to a return offer'],
    summary: [
      '入职前、头两周、第一个 PR、1:1 和周报模板、中期自评、交接文档、争取转正，以及选组电话怎么准备、怎么打分。',
      'Before you start, the first two weeks, your first PR, 1:1 and weekly update templates, the midpoint review, the handoff doc, the return offer, and how to prepare for and score team-matching calls.',
    ],
  },
  {
    slug: 'visa',
    title: ['国际学生签证须知', 'Visa notes for international students'],
    summary: [
      'F-1 的 CPT、OPT、STEM OPT 与 H-1B 抽签，加拿大的 PGWP，以及申请表上的担保问题。仅供参考，以官方为准。',
      'F-1 CPT, OPT, STEM OPT and the H-1B lottery, Canada’s PGWP, and the sponsorship question on applications. General information only; official sources rule.',
    ],
  },
];

export const guidePath = (slug?: string) => (slug ? `/guide/${slug}` : '/guide');
export const guideChapter = (slug: string) => GUIDE_CHAPTERS.find((c) => c.slug === slug);

/** The recruiting season on the index page: [months zh, en, phase zh, en, what to do zh, en]. Typical, not fixed. */
export const SEASON: [string, string, string, string, string, string][] = [
  ['5–7 月', 'May–Jul', '准备', 'Prepare', '改好简历，热身常见题型，列出目标公司', 'Finish the resume, warm up on core patterns, list target companies'],
  ['8–10 月', 'Aug–Oct', '网申开放', 'Applications open', '尽早分批投递，同时找内推', 'Apply early and in batches; ask for referrals'],
  ['9–11 月', 'Sep–Nov', 'OA 与电面', 'Assessments & screens', '在期限内完成 OA，保持限时练习', 'Finish assessments in time; keep practising against the clock'],
  ['10–12 月', 'Oct–Dec', '终面与 offer', 'Finals & offers', '把终面排得紧凑，让 offer 时间重叠', 'Schedule finals close together so offers overlap'],
  ['1–3 月', 'Jan–Mar', '第二波招聘', 'Second wave', '继续投递，跟进还在流程中的公司', 'Keep applying; follow up on open processes'],
  ['4–6 月', 'Apr–Jun', '补录与入职', 'Late roles & start', '留意补录和非常规岗位；实习多在 5–6 月开始', 'Watch for off-cycle roles; internships start in May–June'],
];
