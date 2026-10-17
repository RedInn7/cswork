// Branching practice scripts for a recruiter screen and offer negotiation, no AI needed
// (/career/negotiation, components/negotiation-scripts.tsx). Written for CSWork in both languages.
// Each script's setting is one of the AI role-play scenarios, resolved on the server by
// scenarioSetting (lib/server/) so the company's floor, concessions and notes never reach the
// client: never import the scenario JSON here, and keep the floor's numbers out of these lines
// (tests/negotiation-scripts.test.ts).
import type { Text } from '../mock-interview';

export type Choice = { say: Text; score: 0 | 1 | 2; why: Text; next: string };
/** A step; no choices means an ending, and `line` is the recruiter's last word. */
export type Node = { id: string; line: Text; choices: Choice[] };
export type Script = {
  id: string;
  kind: 'recruiter' | 'negotiation';
  title: Text;
  /** The AI role-play scenario's id. */
  scenario: string;
  start: string;
  nodes: Node[];
};
/** What the candidate may see of a scenario; a recruiter screen's planned offer stays hidden. */
export type Setting = {
  company: Text;
  role: Text;
  level: Text;
  location: Text;
  brief: Text;
  offer?: { base: number; bonus?: number; equity: number; signOn: number };
};

const end = (id: string, line: Text): Node => ({ id, line, choices: [] });

const VISA: Choice[] = [
  {
    say: [
      "需要。我现在是 F-1 学生签证，毕业后用 OPT 工作，加上 STEM 延期一共大约三年，之后需要公司办 H-1B。",
      "Yes. I'm on an F-1 visa. After graduation I'll work on OPT, and with the STEM extension that covers about three years; after that I'd need H-1B sponsorship.",
    ],
    score: 2,
    why: [
      "照实回答，说清身份和时间。这个问题每个人都会被问，给出明确的时间线，对方能马上确认担保政策，不用猜。（请按你自己的真实情况回答，这里只是一个例子。）",
      "Answer plainly, with your status and dates. Everyone gets this question, and a clear timeline lets the recruiter check the sponsorship policy right away instead of guessing. (Use your own real situation; this is one example.)",
    ],
    next: 'salary',
  },
  {
    say: ["现在先不聊这个吧。", "I'd rather not get into that yet."],
    score: 0,
    why: [
      "对很多岗位来说，担保是一道是或否的门槛。回避只会拖后，还显得你在隐瞒。越早说清越好。",
      "Sponsorship is a yes-or-no gate for many roles. Dodging only delays it and looks like you're hiding something; better to settle it now.",
    ],
    next: 'salary',
  },
  {
    say: ["不需要。（其实你将来需要担保）", "No, I won't. (You actually will.)"],
    score: 0,
    why: [
      "工作许可绝不能说假话。入职时的 I-9 和签证材料都会核对，基于不实回答发的 offer 可以被撤回。",
      "Never misstate your work authorization. The I-9 and visa paperwork at onboarding will show it, and an offer made on a false answer can be withdrawn.",
    ],
    next: 'salary',
  },
  {
    say: ["现在不需要，毕业后先用 OPT。以后可能需要，还不太确定。", "Not right now; after graduation I'll be on OPT. Maybe later, I'm not sure."],
    score: 1,
    why: [
      "是真话，但含糊。问题里有“将来”两个字：如果以后要办 H-1B，就直接说，并说明 OPT 和 STEM 延期的时间。",
      "Truthful but vague. The question says 'in the future': if you'll need an H-1B later, say so, with your OPT and STEM extension dates.",
    ],
    next: 'salary',
  },
];

const SALARY_ASK: Script = {
  id: 'salary-ask',
  kind: 'recruiter',
  title: ['初筛电话里被问期望薪资', 'Asked for your number on a first call'],
  scenario: 'rec-cloud-newgrad',
  start: 'open',
  nodes: [
    {
      id: 'open',
      line: [
        "你好，谢谢抽时间。我们大概有 20 分钟。先请你简单介绍一下自己，以及为什么对这个岗位感兴趣？",
        "Hi, thanks for making the time. We have about twenty minutes. Could you start by telling me a bit about yourself and what drew you to this role?",
      ],
      choices: [
        {
          say: [
            "我五月硕士毕业，计算机专业。去年暑假在一家中型公司的后端组实习，课上做过一个带副本复制的分布式键值存储。我最喜欢存储和可靠性方面的工作，这也是你们云存储这个组吸引我的原因。",
            "I finish my master's in CS in May. Last summer I interned on a backend team at a mid-size company, and at school I built a replicated key-value store. Storage and reliability are what I enjoy most, which is why your cloud storage team caught my eye.",
          ],
          score: 2,
          why: [
            "一分钟左右讲清四件事：现在的身份、什么时候能入职、一两个证据、为什么是这个岗位。初筛看的是匹配度和时间，不是技术细节。",
            "About a minute covering four things: where you are, when you can start, one or two pieces of proof, and why this role. A first call checks fit and timing, not technical depth.",
          ],
          next: 'visa',
        },
        {
          say: [
            "好的，我从本科一年级讲起……（按时间顺序把每门课和每个项目都讲一遍）",
            "Sure, let me start from my first year of undergrad… (and go through every course and project in order)",
          ],
          score: 0,
          why: [
            "按时间记流水账会把电话时间耗光。招聘方 20 分钟里有一串问题要问完，先给短版本，让对方追问细节。",
            "A chronological tour eats the call. The recruiter has a list to get through in twenty minutes; give the short version and let them ask for more.",
          ],
          next: 'visa-rushed',
        },
        {
          say: ["说实话我投了很多家，只想找份大公司的后端工作。", "Honestly, I've applied to a lot of places. I just want a backend job at a big company."],
          score: 0,
          why: [
            "很多人确实如此，但这句话等于告诉对方你去哪都行。答案要落到这个组做的事情上。",
            "True for many people, but it tells them any job will do. Tie your answer to what this team does.",
          ],
          next: 'visa-rushed',
        },
        {
          say: ["我是五月毕业的后端工程师，喜欢大公司，因为规模大、能学到东西。", "I'm a backend engineer graduating in May. I like big companies for the scale and the learning."],
          score: 1,
          why: [
            "没错，但太泛，听不出你了解过这个组。加一个具体证据，再说一个只属于这个岗位的理由。",
            "Fine, but generic: nothing shows you looked at this team. Add one piece of proof and one reason that belongs to this role.",
          ],
          next: 'visa',
        },
      ],
    },
    {
      id: 'visa',
      line: [
        "好的，谢谢。接下来是每个候选人都会问的问题：你现在或将来需要公司担保工作签证吗？",
        "Great, thanks. Next is a question we ask everyone: will you now or in the future need visa sponsorship to work in the US?",
      ],
      choices: VISA,
    },
    {
      id: 'visa-rushed',
      line: [
        "我先打断一下，免得时间不够。每个候选人都要问的一个问题：你现在或将来需要公司担保工作签证吗？",
        "Let me jump in so we cover everything in time. A question we ask everyone: will you now or in the future need visa sponsorship to work in the US?",
      ],
      choices: VISA,
    },
    {
      id: 'salary',
      line: ["好，记下了。你对这个岗位的期望薪资是多少？", "Thanks, noted. What are your salary expectations for this role?"],
      choices: [
        {
          say: [
            "我想先多了解一下岗位和级别。方便说一下这个级别的预算范围吗？我看到职位描述里列了一个范围。",
            "I'd like to learn more about the role and level first. Could you share the budgeted range for this level? I saw the posting lists one.",
          ],
          score: 2,
          why: [
            "先问对方的范围，避免自己报低了被锚住。华盛顿州法律要求职位描述写明薪资范围，问这个很正常。",
            "Asking for their range first keeps you from anchoring yourself low. Washington law requires job postings to include a pay range, so asking about it is routine.",
          ],
          next: 'range',
        },
        {
          say: ["12 万美元左右就很好了。", "Around $120,000 would be great."],
          score: 0,
          why: [
            "谁先报数字，谁就定下了锚点。这个数比西雅图大厂新毕业生常见的 base 还低，对方没有理由给得比你要的更多。",
            "The first number named becomes the anchor, and this one is below typical new grad base pay at big tech in Seattle. The recruiter has no reason to offer more than you asked for.",
          ],
          next: 'lowball',
        },
        {
          say: [
            "我查过西雅图新毕业生后端岗位的行情，base 大概在 14 万到 15 万，不过要看整体待遇，可以商量。",
            "From what I've read about new grad backend roles in Seattle, roughly $140k to $150k base, but I'm flexible depending on the whole package.",
          ],
          score: 1,
          why: [
            "查过行情的范围比随口一说好，但你还是在听到对方的数字之前先报了价，而且对方只会记住范围的下限。",
            "A researched range beats a guess, but you still named a number before hearing theirs, and the bottom of your range is the part they'll remember.",
          ],
          next: 'anchored',
        },
      ],
    },
    {
      id: 'range',
      line: [
        "可以。这个级别职位描述里的范围比较宽，base 大约 12 万到 18.5 万，具体看面试结果和定级。你觉得自己在哪个位置？",
        "Sure. The posted range for this level is fairly wide, about $120k to $185k base, depending on interview results and leveling. Where do you see yourself in it?",
      ],
      choices: [
        {
          say: [
            "谢谢。考虑到我的实习和存储项目，我希望在范围的中上部分。具体数字等面试后看到完整 offer 再谈吧。",
            "Thanks. Given my internship and the storage project, I'd expect the upper half. I'd rather settle the exact number once there's a full offer after the interviews.",
          ],
          score: 2,
          why: [
            "把期望锚在中上段，又没有说死一个数字，还给出了理由。真正的谈判在拿到 offer 以后。",
            "You anchor to the upper half without committing to a number, and you give a reason. The real negotiation happens once there's an offer.",
          ],
          next: 'others',
        },
        {
          say: ["范围的下限对我来说就可以。", "The low end of that works for me."],
          score: 0,
          why: ["你主动把下限让了出去，第一版 offer 就会从那里起步。", "You just handed over the low end; the first offer will start there."],
          next: 'others',
        },
        {
          say: ["我最少要 18.5 万，低于这个数我不考虑。", "I need $185k minimum, or I won't consider it."],
          score: 0,
          why: [
            "还没面试就按顶格下最后通牒，可能让流程就此停下，或者被标成难谈的人。施压留到手里有 offer 的时候。",
            "An ultimatum at the very top of the range before you've even interviewed can stall the process or mark you as hard to close. Save the pressure for when you hold an offer.",
          ],
          next: 'hardline',
        },
        {
          say: ["能先介绍一下这个级别的奖金和股票是怎么算的吗？", "Could you first tell me how bonus and stock work at this level?"],
          score: 1,
          why: [
            "看总包的意识是对的，但你既没回答也没锚定。这一步问问无妨，等 offer 来了再细问。",
            "Looking at total pay is the right instinct, but you neither answered nor anchored. Fine at this stage; ask in detail when the offer comes.",
          ],
          next: 'others',
        },
      ],
    },
    {
      id: 'lowball',
      line: ["太好了，这完全在我们的预算之内，没问题。我记下了。", "Great, that's comfortably within our budget, no concerns there. I'll note it down."],
      choices: [
        {
          say: [
            "记之前我想补充一句：刚才那个数是在不了解级别和整体待遇的情况下说的。我更希望等到 offer 阶段再定数字。",
            "Before you note it: I gave that number without knowing the level or the full package. I'd rather settle the number at the offer stage.",
          ],
          score: 2,
          why: [
            "offer 还没写出来之前，礼貌地收回一个过早的数字是可以的。要收就现在收，别等对方照着它写好 offer。",
            "You can politely walk back an early number before any offer exists. Do it now, not after they've written the offer around it.",
          ],
          next: 'others',
        },
        {
          say: ["好的，谢谢！", "Sounds good, thanks!"],
          score: 0,
          why: [
            "对方说“完全在预算之内”，意思就是你要少了。这个数会写进记录，跟着你进入后面每一轮。",
            "'Comfortably within budget' means you asked for too little. That number goes into your file and follows you through every round.",
          ],
          next: 'others',
        },
        {
          say: ["那改成 15 万吧。", "Actually, make it $150k."],
          score: 1,
          why: [
            "比放着不管好，但这是自己跟自己竞价，锚点还是你定的。更好的做法是说清楚到 offer 阶段再谈。",
            "Better than leaving it, but you're bidding against yourself and still setting the anchor. Better to say you'll settle it at the offer stage.",
          ],
          next: 'others',
        },
      ],
    },
    {
      id: 'anchored',
      line: [
        "很有帮助。那我记 14 万。确认一下，这个 base 你能接受，对吧？",
        "That's helpful. I'll put down $140k. Just to set expectations, you'd be comfortable with that base, right?",
      ],
      choices: [
        {
          say: [
            "我说的是一个范围，现在还不想定死一个数。级别和整体待遇对我更重要，到 offer 阶段我会更清楚。",
            "I gave a range, and I'd rather not lock in a figure yet. The level and the whole package matter more to me; I'll know better at the offer stage.",
          ],
          score: 2,
          why: [
            "招聘方抓住了你范围的下限。温和地拒绝被定在一个数上，把讨论推迟到 offer。",
            "The recruiter grabbed the bottom of your range. Decline, politely, to be pinned to a number, and move the talk to the offer.",
          ],
          next: 'others',
        },
        {
          say: ["嗯，14 万可以。", "Yes, $140k is okay."],
          score: 0,
          why: [
            "你刚刚亲口确认了一个比自己范围上限低 1 万的数。第一版 offer 很可能就停在这里。",
            "You just confirmed $10k less than the top of your own range. The first offer may well stop right there.",
          ],
          next: 'others',
        },
        {
          say: ["那就按 15 万记吧。", "Let's say $150k, then."],
          score: 1,
          why: ["把数字往上调了，但还是被定在了一个具体数上。", "You moved the number up, but you're still pinned to a specific figure."],
          next: 'others',
        },
      ],
    },
    {
      id: 'hardline',
      line: [
        "这已经是范围的最顶端了，通常给更有经验的人。我会记下来，但先跟你说清楚，新毕业生的 offer 很少到这个数。这是硬性底线吗？",
        "That's the very top of the band, usually for people with more experience. I'll note it, but to be upfront, new grad offers rarely land there. Is that a firm minimum?",
      ],
      choices: [
        {
          say: [
            "不算硬性底线。我定得高是因为觉得自己的经历有竞争力，但我是开放的，等有了 offer 再看整体。",
            "Not a firm minimum. I aimed high because I think my experience is competitive, but I'm open; I'll weigh the whole package once there's an offer.",
          ],
          score: 2,
          why: ["体面地退回来，保住了继续面试的机会，也没有给出新的数字。", "A graceful step back: you keep the interviews going without naming a new number."],
          next: 'end-soft',
        },
        {
          say: ["是的，低于这个数我不会考虑。", "Yes, I won't consider anything below it."],
          score: 0,
          why: [
            "坚持一个对方刚说很少给到的数，等于让招聘方在面试前就替团队把你筛掉。",
            "Holding to a number they've just said rarely happens invites the recruiter to screen you out before you've interviewed.",
          ],
          next: 'end-hardline',
        },
        {
          say: ["那你觉得多少比较现实？", "What would be realistic, then?"],
          score: 1,
          why: [
            "算是补救，但你已经当着对方让步了一次，对方会预期你还会继续往下降。",
            "A fair recovery, but you've visibly backed down once, and they'll expect you to keep coming down.",
          ],
          next: 'end-soft',
        },
      ],
    },
    {
      id: 'others',
      line: [
        "谢谢。你现在还在面其他公司吗？有什么时间线需要我知道的？",
        "Thanks. Are you interviewing with other companies, and is there a timeline I should know about?",
      ],
      choices: [
        {
          say: [
            "在面另外几家，有的在早期，有的在中期，目前没有带截止日期的 offer。有变化我会第一时间告诉你。另外想问一下，接下来的流程是怎样的？",
            "I'm in process with a few other companies, some early, some further along, with no offer deadlines yet. I'll tell you right away if that changes. And could you walk me through the next steps here?",
          ],
          score: 2,
          why: [
            "真实、简短、有用：招聘方知道了你的进度，也知道你有截止日期时会告诉她。公司名字和细节可以先不说。最后问下一步，是每次通话都该做的事。",
            "True, short and useful: the recruiter learns your pace and that you'll flag any deadline. Company names and details can wait. Asking about next steps belongs at the end of every call.",
          ],
          next: 'end-next',
        },
        {
          say: ["没有，还没有别的公司对我感兴趣。", "No, nobody else is interested in me yet."],
          score: 0,
          why: [
            "就算这是你本季第一个流程，也别说成“没人要我”。照实说进度就好：“我的求职刚开始，正在投几个后端岗位。”",
            "Even if this is your first process of the season, don't frame it as nobody wanting you. State where you are: 'I'm early in my search and applying to a few backend roles.'",
          ],
          next: 'end-early',
        },
        {
          say: ["在面，我手上已经有三个 offer 了，都是这周五到期。（其实没有）", "Yes, I already have three offers, all expiring Friday. (You don't.)"],
          score: 0,
          why: [
            "编造 offer 或截止日期风险很大：招聘方可能要细节，或者逼你马上决定。谎话一戳破，信任就没了。",
            "Inventing offers or deadlines is a bad bet: recruiters may ask for details or push you to decide now, and a bluff that collapses costs you their trust.",
          ],
          next: 'bluff',
        },
        {
          say: ["在面几家，但具体情况不方便说。", "A few, but I'd rather not share anything about them."],
          score: 1,
          why: [
            "你没有义务透露细节，但一口回绝会让招聘方没法帮你排时间。说进度和时间，不说公司名和数字。",
            "You don't owe details, but a flat no leaves the recruiter nothing to plan around. Share stages and timing, not names or numbers.",
          ],
          next: 'end-guarded',
        },
      ],
    },
    {
      id: 'bluff',
      line: [
        "哦，那我们得抓紧了。你能把 offer 信转给我吗？我好去申请加快你的面试。",
        "Oh, then we need to move fast. Could you forward me the offer letters so I can get approval to speed up your interviews?",
      ],
      choices: [
        {
          say: [
            "抱歉，我刚才说过头了。我在面几家公司，但还没有 offer。不过我还是希望流程能尽快推进。",
            "Sorry, I overstated that. I'm interviewing at a few places but don't have offers yet. I'd still like to keep things moving.",
          ],
          score: 2,
          why: [
            "这是现在能做的最好选择：马上、直接地更正。这一步的分是给更正的，上一步的谎话已经扣过分了。",
            "The best move left: correct it at once, plainly. The points here are for the correction; the bluff already cost you the step before.",
          ],
          next: 'end-bluff-fixed',
        },
        {
          say: ["那些是保密的，我不能给你看。", "They're confidential, I can't share them."],
          score: 0,
          why: [
            "招聘方常会要求看书面 offer，“保密”听起来像在找借口。一个谎要用更多的谎来圆。",
            "Recruiters often ask to see written offers, and 'confidential' sounds like an excuse. One bluff now needs another to cover it.",
          ],
          next: 'end-bluff',
        },
        {
          say: ["我确认一下再回复你。", "Let me check and get back to you."],
          score: 0,
          why: [
            "拖延不会让问题消失：对方会等着那几封信，你迟早得承认，或者继续编。",
            "Stalling doesn't make it go away: they'll wait for those letters, and you'll have to admit it or keep inventing.",
          ],
          next: 'end-bluff',
        },
      ],
    },
    end('end-next', [
      "好问题。下一步是和工程师的一轮技术电面，我今天会发邮件给你几个可选时间，后面的流程也会在邮件里写清楚。谢谢你，聊得很愉快！",
      "Good question. Next is a technical phone screen with an engineer. I'll email you some time slots today, along with the rest of the process. Thanks, this was great!",
    ]),
    end('end-early', ["明白。下一步是技术电面，我会发邮件约时间。祝你求职顺利。", "Understood. Next is a technical phone screen; I'll email you to schedule it. Good luck with your search."]),
    end('end-guarded', [
      "好的，理解。如果有截止日期，记得提前告诉我，我好帮你协调。下一步的安排我会发邮件。",
      "Okay, I understand. If a deadline comes up, let me know early so I can help with timing. I'll email you about next steps.",
    ]),
    end('end-hardline', [
      "了解。我会把这个数字转给招聘团队，但不能保证我们会按这个数继续推进。有消息我再联系你。",
      "Understood. I'll pass that number to the hiring team, but I can't promise we'll move forward at that level. I'll be in touch.",
    ]),
    end('end-soft', [
      "谢谢你说明。我会把这些写进记录。下一步是技术电面，我会发邮件约时间。",
      "Thanks for clarifying. I'll put that in my notes. Next is a technical phone screen; I'll email you to set it up.",
    ]),
    end('end-bluff-fixed', [
      "谢谢你说清楚，没关系。我们按正常节奏走，下一步是技术电面，我会发邮件约时间。",
      "Thanks for being straight with me, no problem. We'll keep the normal pace; next is a technical phone screen, and I'll email you to schedule it.",
    ]),
    end('end-bluff', ["好吧。等你方便时把材料发给我，我再看怎么安排。", "All right. Send them over when you can, and I'll see what I can do."]),
  ],
};

const EXPLODING_OFFER: Script = {
  id: 'exploding-offer',
  kind: 'negotiation',
  title: ['48 小时限时 offer', 'A 48-hour exploding offer'],
  scenario: 'neg-trading-exploding',
  start: 'open',
  nodes: [
    {
      id: 'open',
      line: [
        "恭喜！团队很希望你加入。offer 已经发到你的邮箱：base 22.5 万，第一年目标奖金 7.5 万，签字费 5 万。不过我们需要你在 48 小时内答复。",
        "Congratulations! The team really wants you. The offer is in your inbox: $225k base, a $75k first-year target bonus and a $50k sign-on. We do need your answer within 48 hours.",
      ],
      choices: [
        {
          say: [
            "谢谢，我真的很兴奋！我还在等另一家公司的终面结果，对方说下周内出。我想做一个签了就不会反悔的决定，能把答复期延到那时候吗？",
            "Thank you, I'm really excited! I'm still waiting on one other final round, with results due within the next week. I want to make a decision I'll stand by. Could I have until then to reply?",
          ],
          score: 2,
          why: [
            "先表达热情，再提延期，并给出真实的理由和时间。“签了不反悔”对公司也有好处：它最怕的就是你签了以后又毁约。",
            "Enthusiasm first, then the ask, with a real reason and a timeframe. 'A decision I'll stand by' helps them too: what a firm fears most is a signed candidate backing out later.",
          ],
          next: 'when',
        },
        {
          say: ["太好了，我接受！", "Amazing, I accept!"],
          score: 0,
          why: [
            "限时 offer 的目的就是不让你比较。当场答应，等于放弃了另一家的结果，也放弃了谈任何条件的机会。",
            "An exploding offer exists to stop you comparing. Saying yes on the spot gives up the other firm's answer and any chance to negotiate.",
          ],
          next: 'accepted',
        },
        {
          say: ["48 小时太不合理了，我不接受这种施压。", "Forty-eight hours is unreasonable. I won't be pressured like this."],
          score: 0,
          why: [
            "心情可以理解，但指责会把招聘方推到对立面。期限往往不是她定的，你需要她替你去争取。",
            "Understandable, but accusing them puts the recruiter on the other side. She often doesn't set the deadline, and you need her to argue for you.",
          ],
          next: 'policy',
        },
        {
          say: ["好的，我 48 小时内答复。（心里打算这两天去催另一家）", "Okay, I'll reply within 48 hours. (You plan to rush the other firm meanwhile.)"],
          score: 1,
          why: [
            "冷静、不得罪人，但你连问都没问就接受了期限。礼貌地请求延期几乎没有成本。",
            "Calm and polite, but you accepted the deadline without even asking. A polite request for more time costs almost nothing.",
          ],
          next: 'quiet',
        },
      ],
    },
    {
      id: 'when',
      line: ["谢谢你坦白。那家大概什么时候能出结果？", "Thanks for being upfront. When exactly do you expect to hear from them?"],
      choices: [
        {
          say: [
            "终面是上周，对方说 10 天内给结果，也就是下周五之前。我今天就去问能不能提前，一有消息马上告诉你。",
            "My final round was last week and they said results within 10 days, so by next Friday. I'll ask them today to speed up, and I'll tell you the moment I hear.",
          ],
          score: 2,
          why: [
            "具体的日期让延期容易批下来；主动去催另一家、承诺同步消息，说明你不是在拖时间。",
            "A concrete date makes an extension easy to approve. Offering to push the other firm and keep her posted shows you aren't just stalling.",
          ],
          next: 'extended',
        },
        {
          say: ["这个我不太方便说。", "I'd rather not say."],
          score: 0,
          why: [
            "公司名可以不说，但时间线是她申请延期的唯一依据。不给时间，她就没法替你去争取。",
            "You needn't name the firm, but the timeline is the only basis she has for an extension. Without it she has nothing to take to her manager.",
          ],
          next: 'no-ext',
        },
        {
          say: ["不太确定，可能要几周吧。", "Not sure, maybe a few weeks."],
          score: 0,
          why: [
            "又模糊又长，听起来像想无限期拖着。给一个具体日期，哪怕要先去问清楚。",
            "Vague and long sounds like you want to wait indefinitely. Give a specific date, even if you have to check first.",
          ],
          next: 'no-ext',
        },
      ],
    },
    {
      id: 'accepted',
      line: [
        "太好了，欢迎加入！我今晚把文件发给你签。签之前还有什么想聊的吗？",
        "Wonderful, welcome aboard! I'll send the paperwork tonight. Anything you'd like to discuss before you sign?",
      ],
      choices: [
        {
          say: [
            "谢谢！其实我刚才答应得太快了。我想先把合同完整读一遍，也想聊聊签字费。另外还有一家的终面结果下周出，能给我到那时候吗？",
            "Thank you! Honestly, I said yes too fast. I'd like to read the full contract first and talk about the sign-on. I also have one more final round result coming next week. Could I have until then?",
          ],
          score: 2,
          why: [
            "口头答应但还没签字，现在收回来还算体面，越早越好。签了再反悔，代价要大得多。",
            "A verbal yes with nothing signed can still be walked back gracefully, the sooner the better. Backing out after signing costs far more.",
          ],
          next: 'extended',
        },
        {
          say: ["没有了，发过来吧！", "Nothing, send it over!"],
          score: 0,
          why: [
            "合同条款你还没看：签字费要不要退、竞业限制多长，在交易公司都很常见，签之前一定要读清楚。",
            "You haven't read the terms yet: sign-on clawbacks and non-compete periods are common at trading firms and worth reading before you sign.",
          ],
          next: 'signing',
        },
        {
          say: ["好的，不过能给我一天时间把合同读一遍吗？", "Sure, but could I have a day to read the contract first?"],
          score: 1,
          why: [
            "先读合同是对的，但你已经放弃了另一家的结果和谈条件的机会。",
            "Reading first is right, but you've already given up the other firm's answer and any room to negotiate.",
          ],
          next: 'signing',
        },
      ],
    },
    {
      id: 'policy',
      line: ["我理解，但 48 小时是我们给所有新毕业生 offer 的统一期限。", "I understand, but 48 hours is our standard window for every new grad offer."],
      choices: [
        {
          say: [
            "明白，我也不想浪费你们的时间。我在等的那家下周五前出结果。能不能请你问问招聘经理，有没有可能多给几天？",
            "Understood, and I don't want to waste your time. The other firm decides by next Friday. Could you ask the hiring manager whether a few more days are possible?",
          ],
          score: 2,
          why: [
            "“统一期限”常常也有例外，但要有人去申请。给她一个具体日期，请她去问能做决定的人。",
            "'Standard' windows often have exceptions, but someone has to ask. Give her a specific date and ask her to check with whoever decides.",
          ],
          next: 'extended',
        },
        {
          say: ["那好吧，我接受。", "All right then, I accept."],
          score: 0,
          why: [
            "一句“统一期限”就让你放弃了另一家的结果。至少再问一次能不能例外。",
            "One 'standard window' and you gave up the other result. At least ask once whether an exception is possible.",
          ],
          next: 'signing',
        },
        {
          say: ["好吧，那我两天内答复。", "Okay, I'll answer within two days."],
          score: 1,
          why: [
            "保住了 offer，但放弃了争取时间。接下来至少要去催另一家加快。",
            "You keep the offer but give up on more time. At the very least, ask the other firm to speed up now.",
          ],
          next: 'no-ext',
        },
      ],
    },
    {
      id: 'quiet',
      line: ["好的。在你考虑的这段时间，对 offer 本身还有什么问题吗？", "Great. While you think it over, do you have any questions about the offer itself?"],
      choices: [
        {
          say: [
            "有。签字费如果一年内离职需要退吗？奖金是怎么定的？另外，我在等另一家的终面结果，下周五之前出，如果能多给几天，我能做一个更踏实的决定。",
            "Yes. Is the sign-on repayable if I leave within a year, and how is the bonus decided? Also, I'm waiting on another final round result due by next Friday; a few more days would let me make a decision I'm sure of.",
          ],
          score: 2,
          why: [
            "问清签字费返还和奖金规则，再顺势把延期提出来。现在提也不晚。",
            "You check the sign-on clawback and how the bonus works, then raise the extension after all. It's not too late to ask.",
          ],
          next: 'extended',
        },
        {
          say: ["没有，都很清楚。", "No, it's all clear."],
          score: 0,
          why: [
            "第一年的奖金写的是“目标”，不是保证。签字费有没有返还条款也要问清楚。",
            "The first-year bonus is a target, not a guarantee, and you should know whether the sign-on can be clawed back.",
          ],
          next: 'no-ext',
        },
        {
          say: ["第一年的奖金有保证吗？", "Is the first-year bonus guaranteed?"],
          score: 1,
          why: ["问到了关键：目标奖金不等于到手的钱。但时间的问题还没解决。", "The right question: a target bonus isn't money in hand. But the deadline is still unsolved."],
          next: 'no-ext',
        },
      ],
    },
    {
      id: 'extended',
      line: ["我去问过了。等那么久不行，但可以给你到下周二。这样可以吗？", "I checked. We can't wait that long, but I can give you until next Tuesday. Does that work?"],
      choices: [
        {
          say: [
            "谢谢，这帮了大忙。我会请另一家在那之前给结果。趁现在，能聊一下签字费吗？",
            "Thank you, that really helps. I'll ask the other firm to answer before then. While we're talking, could we discuss the sign-on?",
          ],
          score: 2,
          why: [
            "收下让步并道谢，然后马上转到下一个话题。新的截止日期记得让对方发邮件确认。",
            "Take the concession with thanks, then move to the next item. And ask for the new deadline in an email.",
          ],
          next: 'comp',
        },
        {
          say: ["还是太短了，我需要整整十天。", "That's still too short. I need the full ten days."],
          score: 0,
          why: [
            "对方刚让了一步，你却当它不存在。收下这次让步，转头去催另一家更有效。",
            "She just gave ground and you treated it as nothing. Take the concession and push the other firm instead.",
          ],
          next: 'firm',
        },
        {
          say: ["可以，谢谢。我周二前答复。", "That works, thanks. I'll reply by Tuesday."],
          score: 1,
          why: [
            "时间争取到了，但钱的事一个字没提。刚拿到延期，正是谈条件的好时机。",
            "You got the time but said nothing about money. Right after an extension is a good moment to discuss terms.",
          ],
          next: 'close',
        },
      ],
    },
    {
      id: 'no-ext',
      line: [
        "好的。那 offer 的有效期还是 48 小时，周四这个时候之前给我答复。",
        "Okay. Then the offer stays open for 48 hours; I'll need your answer by this time Thursday.",
      ],
      choices: [
        {
          say: [
            "明白。那趁这两天，能聊一下签字费和奖金吗？我也会请另一家尽量加快。",
            "Understood. While we have these two days, could we go over the sign-on and the bonus? I'll also ask the other firm to move faster.",
          ],
          score: 2,
          why: [
            "期限没争取到，还有别的可以谈。同时去催另一家，两条线一起推进。",
            "No extension, but other terms are still open. Push the other firm at the same time and work both lines.",
          ],
          next: 'comp',
        },
        {
          say: ["好的，周四见。", "Okay, Thursday it is."],
          score: 0,
          why: [
            "你接受了期限，也放弃了谈条件。限时 offer 里签字费和奖金通常还有空间。",
            "You accepted the deadline and gave up on the terms too. With exploding offers, the sign-on and bonus often still have room.",
          ],
          next: 'close',
        },
        {
          say: ["那签字费能再加一点吗？", "Could the sign-on go up a bit, then?"],
          score: 1,
          why: [
            "提了总比没提好，但没有数字也没有理由，对方很容易只给一点点。",
            "Better than nothing, but with no number and no reason, it's easy for them to give very little.",
          ],
          next: 'comp',
        },
      ],
    },
    {
      id: 'signing',
      line: [
        "好的，文件马上发给你。按惯例，签字后我们希望你停止其他公司的面试。",
        "Great, the paperwork is on its way. As usual, once you sign, we ask that you withdraw from other interview processes.",
      ],
      choices: [
        {
          say: [
            "好的。我会先把合同完整读一遍，特别是签字费返还和竞业条款，明天之前签好发回。",
            "Of course. I'll read the full contract first, especially the sign-on clawback and the non-compete, and send it back signed by tomorrow.",
          ],
          score: 2,
          why: [
            "已经决定接受，就把能做的做好：签之前看清条款，签了就守约。",
            "Once you've decided to accept, do it well: read the terms before signing, and keep your word once you have.",
          ],
          next: 'close',
        },
        {
          say: ["好，我现在就签。（打算另一家给得更多就毁约）", "Sure, I'll sign now. (You plan to renege if the other firm pays more.)"],
          score: 0,
          why: [
            "签了再毁约会伤害你的信誉。交易圈子很小，招聘方之间也会交流。",
            "Signing and then reneging damages your reputation. The trading world is small, and recruiters talk.",
          ],
          next: 'close',
        },
        {
          say: ["签之前，我还想问问签字费有没有调整空间。", "Before I sign, I'd like to ask whether there's any room on the sign-on."],
          score: 1,
          why: [
            "签之前问是对的，但已经答应了接受，谈判的空间小了很多。",
            "Right to ask before signing, but after saying yes, there's much less room to negotiate.",
          ],
          next: 'comp',
        },
      ],
    },
    {
      id: 'comp',
      line: ["签字费可以聊聊。你有什么想法？", "We can talk about the sign-on. What did you have in mind?"],
      choices: [
        {
          say: [
            "我很想加入。交易公司第一年的总包差别主要在签字费和奖金上。如果签字费能到 8 万，第一年奖金再保证一部分，我会很有信心尽快签。",
            "I really want to join. At trading firms, first-year pay differs mostly in sign-on and bonus. If the sign-on could reach $80k, with part of the first-year bonus guaranteed, I'd feel confident signing soon.",
          ],
          score: 2,
          why: [
            "提出具体数字，并且放在公司通常有空间的地方：签字费和保底奖金。“尽快签”是你拿来交换的筹码。",
            "A specific number, aimed where firms usually have room: the sign-on and a guaranteed bonus. 'Signing soon' is what you offer in return.",
          ],
          next: 'counter',
        },
        {
          say: ["能多给一点就行，你看着办。", "Whatever more you can do. I'll leave it to you."],
          score: 0,
          why: [
            "不给数字，对方就会给最小的让步，比如加几千块，然后说已经尽力了。",
            "Without a number, you'll get the smallest bump, a few thousand dollars, and hear that it's the best they can do.",
          ],
          next: 'counter-small',
        },
        {
          say: ["我更想要 base 加 3 万。", "I'd rather have $30k more on the base."],
          score: 1,
          why: [
            "给了具体数字是好事，但交易公司新毕业生的 base 往往全届统一，很难动。把要求放在签字费和奖金上更容易成功。",
            "A number is good, but new grad base at trading firms is often the same for the whole class and rarely moves. Sign-on and bonus asks land more often.",
          ],
          next: 'counter-small',
        },
      ],
    },
    {
      id: 'firm',
      line: ["下周二已经是我能争取到的最晚时间了。", "Next Tuesday is the latest I can get."],
      choices: [
        {
          say: [
            "明白，谢谢你帮我争取。我周二前答复，也会请另一家加快。顺便问一下，签字费还有调整的空间吗？",
            "Understood, thank you for pushing for it. I'll reply by Tuesday and ask the other firm to hurry. While we're at it, is there any room on the sign-on?",
          ],
          score: 2,
          why: [
            "及时收手，保住了关系，还把话题转到还能谈的地方。下次记得带上具体数字。",
            "You stopped in time, kept the goodwill and moved to something still open. Next time, bring a specific number.",
          ],
          next: 'counter-small',
        },
        {
          say: ["那算了，我不要了。", "Then forget it, I'm out."],
          score: 0,
          why: ["为了几天的差距放弃 offer，而另一家还不一定会给你。", "You dropped an offer over a few days, and the other firm may not even come through."],
          next: 'end-declined',
        },
        {
          say: ["好吧。", "Fine."],
          score: 1,
          why: ["接受了，但气氛有点僵，也没有利用这个机会谈别的条件。", "Accepted, but the mood soured, and you didn't use the moment to raise other terms."],
          next: 'end-verbal',
        },
      ],
    },
    {
      id: 'close',
      line: ["好的。结束之前还有别的问题吗？", "Sounds good. Anything else before we wrap up?"],
      choices: [
        {
          say: [
            "有一个：签字费如果一年内离职需要退吗？另外，能把今天谈好的内容发邮件确认一下吗？",
            "One thing: is the sign-on repayable if I leave within a year? And could you confirm what we agreed today by email?",
          ],
          score: 2,
          why: [
            "问清返还条款，并把谈好的内容落到书面上，这两件事签之前都要做。",
            "Checking the clawback and getting what you agreed in writing are both worth doing before you sign.",
          ],
          next: 'end-confirmed',
        },
        {
          say: ["没有了，谢谢。", "No, thanks."],
          score: 0,
          why: ["到现在为止都只是口头说的。最好让对方用邮件确认一遍。", "Everything so far is only verbal. Ask for it in an email."],
          next: 'end-verbal',
        },
        {
          say: ["签字费还能谈吗？", "Is there any room on the sign-on?"],
          score: 1,
          why: [
            "现在问也行，但没给数字和理由，对方很容易只给一点点。",
            "Fine to ask now, but with no number or reason, it's easy for her to offer very little.",
          ],
          next: 'counter-small',
        },
      ],
    },
    {
      id: 'counter',
      line: [
        "我和团队商量过了。签字费可以提到 6.5 万，7.5 万目标奖金里保证 5 万。这是我们能给的最好方案了。",
        "I talked with the team. We can raise the sign-on to $65k and guarantee $50k of the $75k first-year target bonus. That's the best we can do.",
      ],
      choices: [
        {
          say: [
            "谢谢，这很有诚意。能把新的签字费、保底奖金和截止日期写进一份更新后的书面 offer 发给我吗？收到后我会尽快回复。",
            "Thank you, that's a real improvement. Could you send an updated written offer with the new sign-on, the guaranteed bonus and the deadline? I'll reply soon after I get it.",
          ],
          score: 2,
          why: [
            "口头答应的条件要落到纸面上。拿到书面版本，你就能在截止前对比两家。",
            "Verbal terms belong on paper. With the written version in hand, you can compare both firms before the deadline.",
          ],
          next: 'end-written',
        },
        {
          say: ["签字费还能再高一点吗？比如 9 万？", "Could the sign-on go a bit higher, say $90k?"],
          score: 1,
          why: [
            "对方已经说了“最好方案”，再试一次可以，但别期望太多，而且要准备好接受现在的数字。",
            "She said 'the best we can do'. One more try is allowed, but don't expect much, and be ready to take what's on the table.",
          ],
          next: 'end-pushed',
        },
        {
          say: ["好，我现在就接受。", "Okay, I accept right now."],
          score: 1,
          why: [
            "条件不错，但你在另一家出结果之前就定了，新条件也还没落到书面上。",
            "Good terms, but you decided before hearing from the other firm, and without the new terms in writing.",
          ],
          next: 'end-accepted',
        },
      ],
    },
    {
      id: 'counter-small',
      line: ["我能做的是签字费加 5000，变成 5.5 万。", "What I can do is add $5k to the sign-on, making it $55k."],
      choices: [
        {
          say: [
            "谢谢。坦白说，我对第一年的总包期望更高一些。如果签字费能到 7 万，或者第一年奖金能保证一部分，我就能很快决定。",
            "Thank you. Honestly, I hoped for more in the first year. If the sign-on could reach $70k, or part of the first-year bonus were guaranteed, I could decide quickly.",
          ],
          score: 2,
          why: [
            "现在才给出具体数字，但还来得及。给出两种方案，对方选哪种你都有收获。",
            "You're naming a number late, but not too late. Two options let them pick either, and you gain either way.",
          ],
          next: 'end-improved',
        },
        {
          say: ["好的，可以。", "Okay, deal."],
          score: 0,
          why: ["第一次让步很少是最后一次。至少再提一次具体的要求。", "The first concession is rarely the last. Make at least one specific counter."],
          next: 'end-accepted',
        },
        {
          say: ["才 5000？这也太少了吧。", "Only $5k? That's insulting."],
          score: 0,
          why: [
            "情绪化的反应换不来更多钱。说出你要的数字和理由，比抱怨有用得多。",
            "An emotional reaction won't bring more money. A number and a reason work far better than a complaint.",
          ],
          next: 'end-pushed',
        },
      ],
    },
    end('end-written', ["没问题，今天就把更新后的书面 offer 发给你。等你的好消息！", "No problem, I'll send the updated written offer today. Looking forward to hearing from you!"]),
    end('end-improved', ["我再去争取一下……好，签字费可以到 6.5 万。我把更新后的 offer 发给你。", "Let me try… Okay, I can get the sign-on to $65k. I'll send you the updated offer."]),
    end('end-pushed', ["这已经是我能做到的了。现在的条件在截止前都有效，你再考虑一下。", "That's as far as I can go. The current terms stand until the deadline; think it over."]),
    end('end-accepted', ["太好了，欢迎加入！我今天就把文件发给你。", "Fantastic, welcome aboard! I'll send the paperwork today."]),
    end('end-confirmed', [
      "好问题。签字费的条款写在合同里，我会把今天谈好的内容连同这一条整理成邮件发给你。",
      "Good questions. The sign-on terms are in the contract; I'll email you a summary of what we agreed today, including that clause.",
    ]),
    end('end-verbal', ["好的，那等你的答复。", "Great, I'll wait for your answer."]),
    end('end-declined', ["理解。谢谢你的时间，祝你一切顺利。", "Understood. Thanks for your time, and best of luck."]),
  ],
};

const COMPETING_OFFER: Script = {
  id: 'competing-offer',
  kind: 'negotiation',
  title: ['用竞争 offer 争取更好的条件', 'Using a competing offer'],
  scenario: 'neg-cloud-newgrad',
  start: 'open',
  nodes: [
    {
      id: 'open',
      line: ["很高兴给你发 offer！书面的内容你应该已经看过了，有什么想法？", "We're thrilled to make you this offer! You've seen the written details. What are your thoughts?"],
      choices: [
        {
          say: [
            "谢谢，我很兴奋，你们是我的第一选择。我手上还有一份书面 offer，在做决定之前想看看还有没有调整的空间，特别是 base。",
            "Thank you, I'm really excited, and you're my first choice. I do hold another written offer, and before deciding I'd like to see if there's any flexibility, especially on base.",
          ],
          score: 2,
          why: [
            "先说清你的意愿，再亮出竞争 offer。“第一选择”只在是真话时说，它告诉招聘方：条件到位你就会签。",
            "Lead with your interest, then mention the competing offer. Say 'first choice' only if it's true; it tells the recruiter you'll sign once the terms work.",
          ],
          next: 'which',
        },
        {
          say: ["我在别家拿到了好得多的 offer，你们得大幅提高才行。", "I have a much better offer elsewhere, so you'll need to improve this a lot."],
          score: 0,
          why: [
            "按四年总额算，另一份其实更低：这边约 79 万，那边约 74 万。夸大竞争 offer 很容易被戳穿，招聘方常会要求看书面材料。",
            "Over four years the other offer is actually lower: about $790k here versus $740k there. Inflating a competing offer is easy to expose, and recruiters often ask to see it in writing.",
          ],
          next: 'bigger',
        },
        {
          say: ["这些数字还有调整的空间吗？", "Is there any flexibility in these numbers?"],
          score: 1,
          why: ["问是对的，但没有理由也没有方向，招聘方不知道该去争取什么。", "Right to ask, but with no reason and no direction, the recruiter doesn't know what to fight for."],
          next: 'flex',
        },
      ],
    },
    {
      id: 'which',
      line: ["谢谢你告诉我。方便说说另一份 offer 的具体构成吗？", "Thanks for telling me. Could you walk me through what the other offer includes?"],
      choices: [
        {
          say: [
            "可以：base 15.5 万，四年股票 10 万，签字费 2 万。它的 base 比你们高，这是我最想谈的部分。",
            "Sure: $155k base, $100k in stock over four years and a $20k sign-on. Its base is higher than yours, and that's the part I'd most like to discuss.",
          ],
          score: 2,
          why: [
            "如实说出构成，并指出对方真正领先的那一项。总额比不过，就比单项。",
            "Give the real breakdown and point to the one line where it's ahead. When the total doesn't win, compare line by line.",
          ],
          next: 'ask',
        },
        {
          say: ["base 大概 18 万，股票也多很多。", "About $180k base, and a lot more stock."],
          score: 0,
          why: [
            "夸大的数字一旦被要求出示书面 offer 就藏不住，而且会让招聘方不再相信你说的任何数字。",
            "Inflated numbers fall apart the moment they ask for the letter, and the recruiter stops believing any number you give.",
          ],
          next: 'proof',
        },
        {
          say: ["具体的不方便说，但很有竞争力。", "I'd rather keep the details private, but it's competitive."],
          score: 1,
          why: [
            "不想说细节可以理解，但“有竞争力”给不了招聘方任何可以拿去申请的东西。",
            "Keeping details private is understandable, but 'competitive' gives the recruiter nothing to take to the comp team.",
          ],
          next: 'vague',
        },
      ],
    },
    {
      id: 'bigger',
      line: ["哦？方便说说那份 offer 的内容吗？", "Oh? What does it look like?"],
      choices: [
        {
          say: [
            "我更正一下：整体上并没有更好。它是 base 15.5 万，四年股票 10 万，签字费 2 万。base 更高，这是我想谈的部分。",
            "Let me correct myself: it isn't better overall. It's $155k base, $100k in stock over four years and a $20k sign-on. The base is higher, and that's what I'd like to discuss.",
          ],
          score: 2,
          why: [
            "说过头了就马上更正。如实给出构成，再聚焦在真正领先的那一项。",
            "If you overstated, correct it at once. Give the real breakdown, then focus on the line that's actually ahead.",
          ],
          next: 'ask',
        },
        {
          say: ["base 大概 18 万，股票也多很多。", "About $180k base, and a lot more stock."],
          score: 0,
          why: ["继续夸大只会越陷越深。招聘方很可能要求看书面 offer。", "Doubling down digs deeper. The recruiter may well ask to see the letter."],
          next: 'proof',
        },
        {
          say: ["具体的不方便说，但确实更好。", "I'd rather not share, but it really is better."],
          score: 1,
          why: ["既不说细节又坚持“更好”，招聘方没法申请，也会开始怀疑。", "No details but still 'better': the recruiter can't get approval and starts to doubt."],
          next: 'vague',
        },
      ],
    },
    {
      id: 'flex',
      line: ["可能有一点空间。你希望在哪方面调整？", "There may be a little room. What are you hoping to change?"],
      choices: [
        {
          say: [
            "主要是 base。我有另一份书面 offer，base 是 15.5 万。你们是我的第一选择，所以希望这边至少能对齐，最好稍高一点。",
            "Mainly base. I hold another written offer at $155k base. You're my first choice, so I'd love this one to at least match it, ideally a bit more.",
          ],
          score: 2,
          why: ["有方向、有依据、有意愿。招聘方拿着这三样就能去申请。", "A direction, a reason and your intent: with those three, the recruiter can go ask for approval."],
          next: 'ask',
        },
        {
          say: ["都想调吧，base、股票、签字费都多一点。", "Everything, really. More base, more stock, more sign-on."],
          score: 0,
          why: ["什么都要等于没有重点，招聘方不知道该先争取哪一项。", "Asking for everything means no priority; the recruiter can't tell what to push for first."],
          next: 'vague',
        },
        {
          say: ["base 能到 17 万吗？", "Could base go to $170k?"],
          score: 1,
          why: ["给了具体数字是好事，但没有理由，招聘方很难拿去申请。", "A specific number is good, but without a reason it's hard for the recruiter to justify."],
          next: 'why-number',
        },
      ],
    },
    {
      id: 'ask',
      line: ["谢谢你说得这么清楚。那要怎样你才会签？", "Thanks for laying it out. What would it take for you to sign with us?"],
      choices: [
        {
          say: ["如果 base 能到 16.5 万，签字费到 4 万，我这周就签。", "If base came to $165k and the sign-on to $40k, I'd sign this week."],
          score: 2,
          why: [
            "一个具体的组合，加上签约承诺。要价比你满意的数字稍高一点，对方通常会往中间走。只在你真心愿意时才承诺签。",
            "A specific package plus a commitment. Ask a bit above what you'd be happy with, since they'll usually meet you partway. Only promise to sign if you mean it.",
          ],
          next: 'counter',
        },
        {
          say: ["你们觉得合适就行。", "Whatever you think is fair."],
          score: 0,
          why: ["把定价权交给对方，结果通常就是最小的让步。", "Handing them the pricing usually gets you the smallest concession."],
          next: 'counter-small',
        },
        {
          say: ["把 base 对齐到 15.5 万就行。", "Just match the base at $155k."],
          score: 1,
          why: [
            "要求明确，但正好把自己限定在对方最容易给的数字上，没给对方往中间走的空间。",
            "Clear, but it caps you at the easiest number for them to give, with no room to meet in the middle.",
          ],
          next: 'counter-match',
        },
      ],
    },
    {
      id: 'proof',
      line: [
        "可以把那份书面 offer 转给我吗？薪酬团队批任何调整之前都要看到。",
        "Could you forward the written offer? Our comp team needs to see it before approving any change.",
      ],
      choices: [
        {
          say: [
            "我得更正一下刚才的说法：实际是 base 15.5 万，四年股票 10 万，签字费 2 万。我可以把信发给你，我最想谈的是 base。",
            "I need to correct what I said: it's actually $155k base, $100k in stock over four years and a $20k sign-on. I'm happy to send the letter. Base is what I'd most like to discuss.",
          ],
          score: 2,
          why: ["在被拆穿之前主动更正，能挽回大部分信任。这是现在最好的选择。", "Correcting it before you're caught saves most of the trust. It's the best move left."],
          next: 'counter-match',
        },
        {
          say: ["那是保密的，我不能给你看。", "It's confidential, I can't share it."],
          score: 0,
          why: [
            "可以把个人信息涂掉再发，“保密”听起来像借口。没有材料，薪酬团队不会批。",
            "You can black out personal details and send it; 'confidential' sounds like an excuse. Without it, the comp team won't approve anything.",
          ],
          next: 'stall',
        },
        {
          say: ["好的，我晚点发你。（但信上的数字和你说的对不上）", "Sure, I'll send it later. (The letter won't match what you said.)"],
          score: 0,
          why: ["拖延不会让数字变得对得上。信一发过去，信任就没了。", "Stalling won't make the numbers match. The moment you send it, the trust is gone."],
          next: 'stall',
        },
      ],
    },
    {
      id: 'vague',
      line: [
        "没有具体信息，我很难去申请调整。你心里有一个数字吗？",
        "Without specifics, it's hard for me to get approval for a change. Do you have a number in mind?",
      ],
      choices: [
        {
          say: [
            "有道理。另一份是 base 15.5 万，四年股票 10 万，签字费 2 万。如果 base 能到 16.5 万，签字费到 4 万，我这周就签。",
            "Fair. The other offer is $155k base, $100k in stock over four years and a $20k sign-on. If base came to $165k and the sign-on to $40k, I'd sign this week.",
          ],
          score: 2,
          why: [
            "给出构成、具体要求和承诺，招聘方现在终于有东西可以拿去申请了。",
            "The breakdown, a specific ask and a commitment: now the recruiter has something to take upstairs.",
          ],
          next: 'counter',
        },
        {
          say: ["没有，你们看着多给点就行。", "No, just make it better."],
          score: 0,
          why: ["没有数字也没有依据，招聘方没法替你申请。", "No number and no basis: the recruiter has nothing to ask for on your behalf."],
          next: 'stall',
        },
        {
          say: ["base 16.5 万左右吧。", "Around $165k base."],
          score: 1,
          why: ["有数字了，但没有依据，也没有说条件到了你会不会签。", "A number at last, but no basis, and no word on whether you'd sign at that point."],
          next: 'counter-small',
        },
      ],
    },
    {
      id: 'why-number',
      line: ["这跳得有点多。这个数字是怎么来的？", "That's quite a jump. Where does that number come from?"],
      choices: [
        {
          say: [
            "我有另一份书面 offer，base 15.5 万，加上我的实习经历，所以要得高了一点。对我来说，最重要的是 base 能对齐或者超过那份。",
            "I hold another written offer at $155k base, and with my internship I aimed a bit higher. What matters most to me is matching or beating that base.",
          ],
          score: 2,
          why: ["补上了依据，也说清了你真正在乎的是什么。", "You add the basis and make clear what you really care about."],
          next: 'counter',
        },
        {
          say: ["我在网上查了西雅图新毕业生的薪资数据。", "From salary data I found online for new grads in Seattle."],
          score: 1,
          why: ["市场数据有一定说服力，但不如一份真实的书面 offer。", "Market data carries some weight, but less than a real written offer."],
          next: 'counter-small',
        },
        {
          say: ["就是我想要的数。", "It's just what I want."],
          score: 0,
          why: ["没有依据的数字，招聘方没法拿去申请。", "A number without a basis gives the recruiter nothing to take upstairs."],
          next: 'stall',
        },
      ],
    },
    {
      id: 'counter',
      line: [
        "我去争取过了。base 可以到 15.5 万，签字费到 4.5 万，股票不变。你看怎么样？",
        "I went to bat for you. We can do $155k base and a $45k sign-on, with the stock unchanged. How does that sound?",
      ],
      choices: [
        {
          say: ["谢谢，这是很大的改善。股票能不能也加一点？如果可以，我就准备签了。", "Thank you, that's a real improvement. Could the stock move a little too? If so, I'm ready to sign."],
          score: 2,
          why: [
            "收下进展，再就还没谈的一项礼貌地提一次。一次就够，别反复加码。",
            "Take the progress, then make one polite ask on the item not yet discussed. Once is enough; don't keep adding.",
          ],
          next: 'final',
        },
        {
          say: ["好的，我接受。", "Great, I accept."],
          score: 1,
          why: ["结果不错。股票还没问过，再礼貌地问一次是很正常的。", "A good result. You never asked about the stock, and one more polite ask is normal."],
          next: 'end-accept',
        },
        {
          say: ["还是比我想要的少，我不接受。", "That's still less than I wanted, so no."],
          score: 0,
          why: ["对方已经让了两项，一口回绝又不给新方案，谈判就卡住了。", "They moved on two lines; a flat no with no counter stalls the whole thing."],
          next: 'end-firm',
        },
      ],
    },
    {
      id: 'counter-small',
      line: ["我能做的是签字费加 1 万，到 4 万。base 不变。", "What I can do is add $10k to the sign-on, to $40k. The base stays as is."],
      choices: [
        {
          say: [
            "谢谢。另一份领先的是 base，15.5 万。如果能对齐，我这周就签。",
            "Thank you. Where the other offer is ahead is base, at $155k. If you could match it, I'd sign this week.",
          ],
          score: 2,
          why: ["把话题拉回真正有差距的地方，并给出签约承诺。", "You bring it back to the real gap and offer a commitment to sign."],
          next: 'final',
        },
        {
          say: ["好吧，可以。", "Okay, fine."],
          score: 0,
          why: ["第一次让步很少是最后一次。至少再提一次具体的要求。", "The first concession is rarely the last. Make at least one specific counter."],
          next: 'end-accept',
        },
        {
          say: ["这不够，那我就去另一家了。", "That's not enough. I'll go with the other company, then."],
          score: 0,
          why: [
            "另一份四年总额更低，而且这里是你的第一选择。用你不打算兑现的威胁，对方可能真的会放手。",
            "The other offer is lower over four years, and this is your first choice. Threaten something you won't do and they may simply let you go.",
          ],
          next: 'end-walk',
        },
      ],
    },
    {
      id: 'counter-match',
      line: ["base 可以对齐到 15.5 万，其他不变。", "We can match the base at $155k. Everything else stays the same."],
      choices: [
        {
          say: ["谢谢。签字费能不能也提到 4 万？这样我这周就签。", "Thank you. Could the sign-on also go to $40k? Then I'll sign this week."],
          score: 2,
          why: ["在已经拿到的基础上，就一项再提一个具体要求，并附上承诺。", "Build on what you got: one specific ask on one more line, with a commitment."],
          next: 'final',
        },
        {
          say: ["好的，我接受。", "Okay, I accept."],
          score: 1,
          why: ["拿到了想要的 base。再礼貌地问一次签字费也很正常。", "You got the base you asked for. One more polite ask on the sign-on would be normal."],
          next: 'end-accept',
        },
        {
          say: ["那 base 能到 18 万吗？", "Could base go to $180k, then?"],
          score: 0,
          why: ["刚对齐就要求一个远超的数字，会让人觉得前面的理由不是真的。", "Asking for far more right after a match makes your earlier reasons look hollow."],
          next: 'end-firm',
        },
      ],
    },
    {
      id: 'stall',
      line: ["这样的话我没法调整什么，offer 只能维持原样。", "Then I'm afraid I can't change anything; the offer stands as is."],
      choices: [
        {
          say: [
            "明白。那我说具体一点：另一份是 base 15.5 万，四年股票 10 万，签字费 2 万，信可以发给你。如果 base 能对齐，我这周就签。",
            "Understood. Let me be specific then: the other offer is $155k base, $100k in stock over four years and a $20k sign-on, and I can send the letter. If you can match the base, I'll sign this week.",
          ],
          score: 2,
          why: [
            "迟到的具体信息总比没有好。真实数字、书面材料、签约承诺，三样齐了。",
            "Late specifics beat none: real numbers, the letter and a commitment to sign.",
          ],
          next: 'final',
        },
        {
          say: ["那我就去另一家了。", "Then I'll take the other offer."],
          score: 0,
          why: ["这里是你的第一选择，而且四年总额更高。赌气放弃不划算。", "This is your first choice and pays more over four years. Walking away out of frustration doesn't add up."],
          next: 'end-walk',
        },
        {
          say: ["好吧，那我按原样接受。", "All right, I'll accept as is."],
          score: 1,
          why: ["拿到了 offer，但放弃了一次真实的谈判机会。", "You keep the offer but gave up a real chance to negotiate."],
          next: 'end-asis',
        },
      ],
    },
    {
      id: 'final',
      line: [
        "我又去争取了一次，还能再往上调一点，具体数字会写进更新后的书面 offer。这是最终方案了，你看可以吗？",
        "I went back once more and got a little more; the exact numbers will be in an updated written offer. That's our final position. Does that work?",
      ],
      choices: [
        {
          say: [
            "谢谢你帮我争取。收到更新后的 offer 我会仔细看，没问题就这周签。",
            "Thank you for pushing for it. Once I have the updated offer, I'll review it and sign this week if all is well.",
          ],
          score: 2,
          why: ["感谢对方，并且在看到书面数字之后再确认。", "Thank the recruiter, and confirm once you've seen the numbers in writing."],
          next: 'end-written',
        },
        {
          say: ["可以，我接受。", "Yes, I accept."],
          score: 1,
          why: ["还没看到具体数字就口头接受有风险。等书面 offer 到了再确认。", "Accepting before seeing the numbers is risky. Confirm once the written offer arrives."],
          next: 'end-accept',
        },
        {
          say: ["还能再多一点吗？", "Can you do any more?"],
          score: 0,
          why: ["对方已经说了“最终方案”。再压只会消耗好感。", "She said 'final'. Pushing again only burns goodwill."],
          next: 'end-final',
        },
      ],
    },
    end('end-written', ["太好了。更新后的 offer 今天就发给你，欢迎加入！", "Wonderful. The updated offer will be in your inbox today. Welcome aboard!"]),
    end('end-accept', ["太好了，欢迎加入！更新后的 offer 今天发给你签。", "Great, welcome aboard! I'll send the updated offer for signature today."]),
    end('end-firm', ["抱歉，这已经是我们能做到的了。offer 这周内都有效。", "Sorry, that's as far as we can go. The offer stands through the end of the week."]),
    end('end-walk', [
      "理解。不过说一句，按四年算我们的 offer 其实更高。如果改变主意，这周内告诉我。",
      "I understand. For what it's worth, our offer is higher over four years. If you change your mind, let me know this week.",
    ]),
    end('end-asis', ["好的，欢迎加入！我把签字链接发给你。", "Great, welcome aboard! I'll send you the signing link."]),
    end('end-final', ["这真的是最终方案了。更新后的 offer 今天会发到你的邮箱。", "That really is final. The updated offer will be in your inbox today."]),
  ],
};

const BASE_TO_SIGNON: Script = {
  id: 'base-to-signon',
  kind: 'negotiation',
  title: ['base 不动，换成签字费', 'Base is capped, sign-on offered instead'],
  scenario: 'neg-adtech-signon',
  start: 'open',
  nodes: [
    {
      id: 'open',
      line: ["很高兴给你发 offer！你说想聊聊待遇，请讲。", "We're excited to have you! You said you wanted to talk about the package. Go ahead."],
      choices: [
        {
          say: [
            "谢谢，我很喜欢这个团队，这里是我的首选。我还有一家大厂的书面 offer：base 17 万，四年股票 20 万，签字费 5 万。希望能找到办法把差距补上，特别是第一年的。",
            "Thank you. I really like this team; it's my top choice. I also hold a written offer from a big tech company: $170k base, $200k in stock over four years and a $50k sign-on. I'd love to find a way to close the gap, especially in the first year.",
          ],
          score: 2,
          why: [
            "意愿、真实的构成、你想解决的问题，一次说清。你也已经看出差距主要在第一年。",
            "Your interest, the real breakdown and the problem you want solved, all at once. You've also spotted that the gap is mostly in year one.",
          ],
          next: 'see-it',
        },
        {
          say: ["另一家给得多得多，你们得超过它才行。", "The other company is offering way more, so you'll need to beat it."],
          score: 0,
          why: [
            "没有数字的“多得多”，招聘方既没法核实也没法申请。何况按四年算，两份几乎一样。",
            "'Way more' with no numbers can't be checked or taken to approval. And over four years, the two offers are nearly equal.",
          ],
          next: 'specifics',
        },
        {
          say: ["base 能提到 18.5 万吗？", "Could you raise the base to $185k?"],
          score: 1,
          why: ["有具体数字，但没有依据，而且离这个级别的范围太远。", "A specific number, but no basis, and well beyond what this level pays."],
          next: 'cap',
        },
      ],
    },
    {
      id: 'see-it',
      line: [
        "谢谢你说得这么具体。方便把那份书面 offer 发给我吗？另外先说一句，你的 base 已经接近这个级别的上限了。",
        "Thanks for the detail. Could you send me that written offer? And to be upfront, your base is already near the top of the band for this level.",
      ],
      choices: [
        {
          say: [
            "当然，今天就发。base 的情况我理解。那能看看签字费和股票吗？第一年的差距主要在签字费：5 万对 2 万。",
            "Of course, I'll send it today. Understood on base. Then could we look at the sign-on and stock? Most of the first-year gap is the sign-on: $50k versus $20k.",
          ],
          score: 2,
          why: ["爽快地提供材料，接受对方说的限制，然后把要求转到有空间的地方。", "Share the letter readily, accept the stated limit, and move the ask to where there's room."],
          next: 'levers',
        },
        {
          say: ["我不想发，你们得相信我。", "I'd rather not send it. You'll have to trust me."],
          score: 0,
          why: [
            "很多公司调整前都要看书面 offer，可以涂掉个人信息再发。拒绝提供会让申请卡住。",
            "Many companies need to see the written offer before changing theirs; you can black out personal details. Refusing stalls the request.",
          ],
          next: 'trust',
        },
        {
          say: ["接近上限不等于到顶。能试着申请 18.5 万吗？", "Near the top isn't the top. Could you try for $185k anyway?"],
          score: 1,
          why: ["对方刚说了限制，你却原地不动。可以问，但最好同时转向别的杠杆。", "She just named the limit and you didn't move. Asking is fine, but also turn to other levers."],
          next: 'cap-firm',
        },
      ],
    },
    {
      id: 'specifics',
      line: ["能具体说说吗？哪些部分更高，高多少？", "Can you be specific? Which parts are higher, and by how much?"],
      choices: [
        {
          say: [
            "可以：base 17 万，四年股票 20 万，签字费 5 万，信我可以发给你。我更喜欢你们的团队，所以想在这边把差距补上。",
            "Sure: $170k base, $200k in stock over four years and a $50k sign-on, and I can send the letter. I like your team more, so I'd like to close the gap here.",
          ],
          score: 2,
          why: ["补上了具体数字和材料，也说清了你更想来这里。", "You add the numbers and the letter, and make clear you'd rather be here."],
          next: 'levers',
        },
        {
          say: ["就是多很多，具体数字我不想说。", "Just a lot more. I'd rather not get into numbers."],
          score: 0,
          why: ["不给数字，招聘方什么也申请不了。", "Without numbers, the recruiter can't request anything."],
          next: 'trust',
        },
        {
          say: ["base 更高，17 万，你们是 16.5 万。", "The base is higher: $170k versus your $165k."],
          score: 1,
          why: [
            "是真话，但只说了一项，而且是最难动的那一项。签字费差 3 万，差距最大；算上 10% 奖金，这边的现金其实已经比那边的 base 高。",
            "True, but only one line, and the hardest to move. The sign-on gap ($30k) is the biggest, and with the 10% bonus this offer's cash pay is already ahead of their base.",
          ],
          next: 'cap-firm',
        },
      ],
    },
    {
      id: 'cap',
      line: [
        "这个级别的 base 到不了 18.5 万，你现在的 16.5 万已经接近上限了。这个数字是怎么来的？",
        "The band for this level doesn't reach $185k; your $165k is already near the top. What's behind that number?",
      ],
      choices: [
        {
          say: [
            "明白。我有一家大厂的书面 offer：base 17 万，四年股票 20 万，签字费 5 万。如果 base 有上限，能不能用签字费和股票来补差距？",
            "Fair enough. I hold a written offer from a big tech company: $170k base, $200k in stock over four years and a $50k sign-on. If base is capped, could we close the gap with sign-on and stock?",
          ],
          score: 2,
          why: ["接受限制，补上依据，并主动提出别的方案。", "You accept the limit, add the basis and propose another route."],
          next: 'levers',
        },
        {
          say: ["我觉得自己值这个数。", "That's what I think I'm worth."],
          score: 0,
          why: [
            "“我值这个数”没法拿去申请。招聘方需要的是一个可以写进申请里的理由。",
            "'I'm worth it' can't go into an approval request. The recruiter needs a reason she can write down.",
          ],
          next: 'trust',
        },
        {
          say: ["那能接近一点吗？比如 18 万？", "Could you get closer, say $180k?"],
          score: 1,
          why: ["自己跟自己降价，还是没有依据。", "You're bidding against yourself, still with no basis."],
          next: 'cap-firm',
        },
      ],
    },
    {
      id: 'levers',
      line: [
        "base 动不了多少，签字费是我最有空间的地方。怎样才能让你觉得差距补上了？",
        "Base can't move much, but the sign-on is where I have the most room. What would close the gap for you?",
      ],
      choices: [
        {
          say: [
            "差距主要在第一年：那边大约 27 万，这边大约 24.7 万，主要差在签字费。签字费到 4.5 万，股票再加一点，就差不多了，我这周就能签。",
            "The gap is mostly year one: about $270k there versus about $247k here, mainly the sign-on. A $45k sign-on plus a small stock bump would get us close, and I could sign this week.",
          ],
          score: 2,
          why: [
            "你算过账：按四年算两份很接近（这边约 92.6 万，那边约 93 万，奖金只算了这边的），差距集中在第一年，正好是签字费能补的。具体数字加签约承诺。",
            "You did the math: over four years the offers are close (about $926k here versus $930k there, counting the bonus here only), so the gap sits in year one, which the sign-on can fix. A specific ask plus a commitment.",
          ],
          next: 'counter',
        },
        {
          say: ["签字费加多少都行。", "Any sign-on increase is fine."],
          score: 0,
          why: ["“多少都行”通常换来的就是最少的那一档。", "'Anything is fine' usually gets you the smallest amount."],
          next: 'counter-small',
        },
        {
          say: ["我还是更想要 base，签字费只发一次。", "I'd still rather have base; a sign-on is paid only once."],
          score: 1,
          why: [
            "道理没错：这里奖金是 base 的 10%，base 每加 5000，四年就是 2.2 万。但对方刚说了 base 没空间，坚持只会换来最小的让步。",
            "The logic is sound: the bonus here is 10% of base, so each $5k of base is $22k over four years. But she just said base has no room, and insisting gets you the smallest concession.",
          ],
          next: 'counter-small',
        },
      ],
    },
    {
      id: 'trust',
      line: [
        "我相信你，但没有具体数字和书面材料，薪酬团队不会批任何调整。",
        "I believe you, but without numbers and something in writing, our comp team won't approve any change.",
      ],
      choices: [
        {
          say: ["有道理。是 base 17 万，四年股票 20 万，签字费 5 万，信今天发给你。", "Fair enough. It's $170k base, $200k in stock over four years and a $50k sign-on. I'll send the letter today."],
          score: 2,
          why: ["给出数字和材料，申请就能往前走了。", "With the numbers and the letter, the request can move forward."],
          next: 'counter',
        },
        {
          say: ["那就不调了。", "Then forget the changes."],
          score: 0,
          why: ["为了不发一封信，放弃了一次真实的加钱机会。", "You gave up a real raise to avoid sending one letter."],
          next: 'close',
        },
        {
          say: ["数字可以说，但信不想发。", "I can share the numbers, but not the letter."],
          score: 1,
          why: [
            "说数字有帮助，但不少公司一定要看信（个人信息可以涂掉）。不给信，能批的就有限。",
            "Numbers help, but many companies insist on the letter (personal details can be blacked out). Without it, what they can approve is limited.",
          ],
          next: 'counter-small',
        },
      ],
    },
    {
      id: 'cap-firm',
      line: ["base 已经接近上限，再加很难。除了 base，还有什么对你重要的吗？", "Base is close to the cap, and more is hard. Besides base, what matters to you?"],
      choices: [
        {
          say: [
            "那就是签字费和股票。另一家签字费 5 万，四年股票 20 万。签字费到 4.5 万，股票再加一点，差距就补上大半了。",
            "Then the sign-on and stock. The other offer has a $50k sign-on and $200k in stock over four years. A $45k sign-on and a bit more stock would close most of the gap.",
          ],
          score: 2,
          why: ["接受限制，换到有空间的杠杆，并且给出具体数字。", "You accept the limit, switch to levers with room, and give specific numbers."],
          next: 'counter',
        },
        {
          say: ["对我来说只有 base 重要。", "Only base matters to me."],
          score: 0,
          why: ["对方已经说了 base 没空间。只盯一项，就把别的路都堵死了。", "She said base has no room. Fixating on one line closes every other route."],
          next: 'close',
        },
        {
          say: ["签字费能多一点吗？", "Maybe a bit more sign-on?"],
          score: 1,
          why: ["方向对了，但没有数字。", "The right direction, but no number."],
          next: 'counter-small',
        },
      ],
    },
    {
      id: 'counter',
      line: [
        "我拿到批准了：签字费提到 4 万，四年股票提到 19 万，base 不变。",
        "I got approval: the sign-on goes to $40k and the four-year stock to $190k. Base stays the same.",
      ],
      choices: [
        {
          say: [
            "谢谢。签之前问两件事：签字费如果一年内离职要不要退？是一次性发还是分期发？然后麻烦把更新后的 offer 发给我。",
            "Thank you. Two questions before I sign: is the sign-on repayable if I leave within a year, and is it paid at once or in parts? Then please send me the updated offer.",
          ],
          score: 2,
          why: [
            "签字费常常带返还条款，一年内离职可能要退。条款问清楚，新数字落到书面上。",
            "Sign-on bonuses often carry a clawback if you leave within a year. Know the terms, and get the new numbers in writing.",
          ],
          next: 'end-written',
        },
        {
          say: ["太好了，我接受。", "Great, I accept."],
          score: 1,
          why: ["结果不错。只是签之前还该问清签字费的返还条款，并拿到书面版本。", "A good result. Just check the sign-on clawback and get it in writing before you sign."],
          next: 'end-accept',
        },
        {
          say: [
            "base 能不能哪怕加 5000？这里奖金是 base 的 10%，四年下来就是 2.2 万。",
            "Could the base move even $5k? The bonus here is 10% of base, so that's $22k over four years.",
          ],
          score: 1,
          why: ["账算得对，但对方刚在两项上让了步，再要一项要有心理准备听到“不行”。", "The math is right, but she just gave ground on two lines; be ready to hear no on a third."],
          next: 'last',
        },
      ],
    },
    {
      id: 'counter-small',
      line: ["我能做的是签字费加 1 万，到 3 万。我的空间主要在这里。", "What I can do is raise the sign-on by $10k, to $30k. That's where my room is."],
      choices: [
        {
          say: [
            "谢谢。第一年的差距大部分还在：另一家签字费是 5 万。如果能到 4.5 万，股票再加一点，我这周就签。",
            "Thank you. Most of the first-year gap is still there: their sign-on is $50k. If you could get to $45k with a small stock bump, I'd sign this week.",
          ],
          score: 2,
          why: ["把差距说清楚，提出具体数字和承诺。", "Name the remaining gap, then give a specific number and a commitment."],
          next: 'last',
        },
        {
          say: ["好的，可以。", "Okay, deal."],
          score: 0,
          why: ["第一次让步很少是最后一次，至少再提一次具体要求。", "The first concession is rarely the last. Make at least one specific counter."],
          next: 'end-accept',
        },
        {
          say: ["这点钱没用，我去大厂算了。", "That's nothing. I'll just take the big company."],
          score: 0,
          why: [
            "你更喜欢这里的团队，而且四年总额几乎一样。为了第一年的一点差距赌气离开不值得。",
            "You prefer this team, and the four-year totals are nearly equal. Leaving in a huff over a year-one gap isn't worth it.",
          ],
          next: 'end-walk',
        },
      ],
    },
    {
      id: 'close',
      line: ["好的，那就按原来的 offer。还有别的问题吗？", "Okay, then the original offer stands. Anything else?"],
      choices: [
        {
          say: [
            "我想了想，还是把具体情况告诉你：base 17 万，四年股票 20 万，签字费 5 万，信也可以发你。签字费还有空间吗？",
            "On second thought, let me give you the specifics: $170k base, $200k in stock over four years and a $50k sign-on, and I can send the letter. Is there room on the sign-on?",
          ],
          score: 2,
          why: ["转回来还来得及。数字加材料，申请才能开始。", "It's not too late to turn back. Numbers plus the letter are what get the request started."],
          next: 'last',
        },
        {
          say: ["没有了。", "No, nothing."],
          score: 0,
          why: [
            "你更喜欢这个团队，却在第一年少拿 2 万多美元的情况下什么也没争取。",
            "You prefer this team, yet you're leaving over $20k of year-one money on the table without trying.",
          ],
          next: 'end-asis',
        },
        {
          say: ["我能考虑几天吗？", "Can I think about it for a few days?"],
          score: 1,
          why: ["给自己留时间是对的，但什么都没谈成，回来时还是原来的条件。", "Taking time is fine, but nothing changed; you'll come back to the same terms."],
          next: 'end-think',
        },
      ],
    },
    {
      id: 'last',
      line: [
        "我又试了一次：签字费最多到 4.5 万，股票不能再动了。这是最终方案。",
        "I tried once more: the sign-on can go to $45k at most, and the stock can't move further. That's final.",
      ],
      choices: [
        {
          say: [
            "谢谢你帮我争取。请把更新后的 offer 发给我，也想确认一下签字费有没有返还条款。",
            "Thank you for pushing for it. Please send the updated offer, and could you confirm whether the sign-on has a clawback?",
          ],
          score: 2,
          why: ["收下最终方案，问清条款，拿到书面版本。", "Take the final terms, check the clawback, and get it in writing."],
          next: 'end-written',
        },
        {
          say: ["好的，我接受。", "Okay, I accept."],
          score: 1,
          why: ["可以接受，但签之前先拿到书面版本，并问清签字费的返还条款。", "Fine to accept, but get it in writing and check the sign-on clawback before you sign."],
          next: 'end-accept',
        },
        {
          say: ["那 base 再加 5000 吧。", "Then add $5k to the base."],
          score: 0,
          why: ["对方已经说了“最终方案”。再提新要求只会消耗好感。", "She said 'final'. A new demand now only burns goodwill."],
          next: 'end-firm',
        },
      ],
    },
    end('end-written', [
      "当然。签字费的条款写在 offer 里，我会在邮件里标出来，今天就把更新后的 offer 发你。",
      "Of course. The sign-on terms are in the offer; I'll point them out in my email and send the updated offer today.",
    ]),
    end('end-accept', ["太好了，欢迎加入！更新后的 offer 今天发给你。", "Great, welcome aboard! The updated offer will be in your inbox today."]),
    end('end-walk', ["理解。不过按四年算，两份其实很接近。祝你一切顺利。", "I understand. For what it's worth, over four years the two offers are very close. Best of luck."]),
    end('end-asis', ["好的，那我把签字链接发给你。", "Okay, I'll send you the signing link."]),
    end('end-think', ["当然，周五前告诉我就行。", "Of course. Just let me know by Friday."]),
    end('end-firm', ["抱歉，这真的是我能做到的全部了。", "Sorry, that really is all I can do."]),
  ],
};

const RETURN_PLUS_EXTERNAL: Script = {
  id: 'return-plus-external',
  kind: 'negotiation',
  title: ['转正 offer 加一份外部 offer', 'A return offer next to an outside offer'],
  scenario: 'neg-return-intern',
  start: 'open',
  nodes: [
    {
      id: 'open',
      line: [
        "恭喜拿到转正 offer！团队对你的实习评价很好。书面 offer 给了三周答复期，不过团队希望这周就能定下来。你怎么想？",
        "Congratulations on your return offer! The team loved your internship. The letter gives you three weeks to decide, but the team is hoping to settle it this week. What do you think?",
      ],
      choices: [
        {
          say: [
            "谢谢，我很喜欢和团队一起工作。我想用满信里给的时间，认真做决定。我手上还有一份书面 offer，所以也想聊聊待遇。",
            "Thank you, I loved working with the team. I'd like to use the time in the letter to decide carefully. I also hold another written offer, so I'd like to talk about the package too.",
          ],
          score: 2,
          why: [
            "书面期限才算数，“希望这周定”只是希望。礼貌地守住期限，同时表明你在意这份工作。",
            "The written deadline is what counts; 'hoping for this week' is just a hope. Hold to it politely while showing you care about the job.",
          ],
          next: 'other',
        },
        {
          say: ["好的，我这周就签。", "Sure, I'll sign this week."],
          score: 0,
          why: ["你放弃了书面给你的三周，也放弃了用另一份 offer 谈条件的机会。", "You gave up the three weeks in writing and the chance to use your other offer."],
          next: 'this-week',
        },
        {
          say: ["我需要用满三周。", "I'll need the full three weeks."],
          score: 1,
          why: [
            "守住期限是对的，但不解释原因，听起来有点冷，团队会担心你根本不想回来。",
            "Right to hold the deadline, but with no reason it sounds cold, and the team may worry you don't want to come back.",
          ],
          next: 'why-wait',
        },
      ],
    },
    {
      id: 'other',
      line: ["理解。能说说另一份 offer 的情况吗？", "Understood. Could you tell me about the other offer?"],
      choices: [
        {
          say: [
            "是另一家大厂的新毕业生 offer：base 15 万，四年股票 15 万，签字费 4 万。base、股票和签字费都比这边高，但我更想回来。",
            "It's a new grad offer from another big tech company: $150k base, $150k in stock over four years and a $40k sign-on. It's ahead on base, stock and sign-on, but I'd prefer to come back.",
          ],
          score: 2,
          why: [
            "如实给出构成，再说清你更想回来。这边有 10% 的奖金，四年约 5.8 万，算上它两边四年总额只差约 7000 美元，所以别说差距很大，最简单的要求是把 base、股票和签字费逐项对齐。",
            "Give the real breakdown and say you'd prefer to come back. This offer's 10% bonus (about $58k over four years) brings the four-year totals within about $7k, so don't claim a big gap: the simplest ask is to match base, stock and sign-on line by line.",
          ],
          next: 'ask',
        },
        {
          say: ["高很多，base 有 18 万。", "It's much higher, $180k base."],
          score: 0,
          why: ["夸大的数字很容易被戳穿，招聘方通常会要求看书面 offer。", "Inflated numbers are easy to expose; recruiters usually ask to see the letter."],
          next: 'doubt',
        },
        {
          say: ["具体的不方便说，但比这边高。", "I'd rather not share specifics, but it's higher."],
          score: 1,
          why: ["可以理解，但没有数字，招聘方没法去申请调整。", "Understandable, but without numbers the recruiter can't ask for a change."],
          next: 'doubt',
        },
      ],
    },
    {
      id: 'this-week',
      line: ["太好了！我去准备签字文件。在那之前还有什么问题吗？", "Wonderful! I'll get the signing documents ready. Any questions before then?"],
      choices: [
        {
          say: [
            "其实，我想还是用满信里的时间。我还有一份书面 offer：base 15 万，四年股票 15 万，签字费 4 万。我更想回来，所以想看看能不能把差距补上。",
            "Actually, I'd like to use the time in the letter after all. I also hold another written offer: $150k base, $150k in stock over four years and a $40k sign-on. I'd prefer to come back, so I'd like to see if we can close the gap.",
          ],
          score: 2,
          why: ["还没签字，改口还来得及。说清理由，团队通常能理解。", "Nothing is signed, so you can still change course. Give the reason and the team will usually understand."],
          next: 'ask',
        },
        {
          say: ["没有了，都很好！", "No, all good!"],
          score: 0,
          why: ["另一份 offer 的 base、股票和签字费都更高，你一句都没提。", "Your other offer is higher on base, stock and sign-on, and you didn't mention it."],
          next: 'signing',
        },
        {
          say: ["签字费能稍微高一点吗？", "Could the sign-on be a little higher?"],
          score: 1,
          why: ["提了总比没提好，但没有依据，也没说另一份 offer 的存在。", "Better than nothing, but there's no basis, and you didn't mention your other offer."],
          next: 'ask',
        },
      ],
    },
    {
      id: 'why-wait',
      line: ["可以问问原因吗？团队真的很想早点定下来。", "Can I ask why? The team would really like to settle it soon."],
      choices: [
        {
          say: [
            "当然。我还有一份书面 offer：base 15 万，四年股票 15 万，签字费 4 万。我更想回来，所以想看看能不能把差距补上。信里给了三周，我想用这段时间把事情谈清楚。",
            "Of course. I hold another written offer: $150k base, $150k in stock over four years and a $40k sign-on. I'd prefer to come back, so I'd like to see if we can close the gap. The letter gives me three weeks, and I'd like to use them to sort it out.",
          ],
          score: 2,
          why: ["原因、数字、意愿都说清了，守住期限也就不显得冷淡。", "Reason, numbers and intent are all on the table, so holding the deadline no longer sounds cold."],
          next: 'ask',
        },
        {
          say: ["算了，那我这周就定吧。", "Never mind, I'll decide this week then."],
          score: 0,
          why: ["一句“团队希望”就让你放弃了书面给你的三周。", "One 'the team would like' and you gave up the three weeks in writing."],
          next: 'signing',
        },
        {
          say: ["我手上还有别的 offer，想比较一下。", "I have another offer and want to compare."],
          score: 1,
          why: ["说出了原因，但没有数字，对方没法据此调整。", "A reason at last, but with no numbers they can't adjust anything."],
          next: 'doubt',
        },
      ],
    },
    {
      id: 'ask',
      line: ["谢谢你坦诚。你希望我们怎么调整？", "Thanks for being open. What would you like us to change?"],
      choices: [
        {
          say: [
            "如果能和另一份对齐，事情就简单了：base 15 万，四年股票 15 万，签字费 4 万。我的实习评价也很好，如果能对齐，我这周就签。",
            "Matching the other offer would make this easy: $150k base, $150k in stock over four years and a $40k sign-on. My internship review was strong too, and if you can match it, I'll sign this week.",
          ],
          score: 2,
          why: [
            "一个清晰的要求（逐项对齐），一个理由（实习表现），再加签约承诺。“对齐”是招聘方最容易拿去申请的说法。",
            "One clear ask (match line by line), a reason (your internship) and a commitment. 'Match' is the easiest story for a recruiter to take to the comp team.",
          ],
          next: 'counter',
        },
        {
          say: ["你们看着办吧。", "Whatever you can do."],
          score: 0,
          why: ["把定价权交给对方，通常只会换来最小的让步。", "Leaving the pricing to them usually gets the smallest concession."],
          next: 'counter-small',
        },
        {
          say: ["把 base 提到 15 万就行。", "Just raise the base to $150k."],
          score: 1,
          why: ["具体，但只要了一项。另一份在股票和签字费上的领先更多。", "Specific, but only one line. The other offer leads by more on stock and sign-on."],
          next: 'counter-small',
        },
      ],
    },
    {
      id: 'doubt',
      line: [
        "我们一般要看到书面 offer 才能申请调整。方便发给我吗？",
        "We usually need to see the written offer before asking for any change. Could you send it?",
      ],
      choices: [
        {
          say: [
            "可以，今天就发。准确地说是 base 15 万，四年股票 15 万，签字费 4 万。",
            "Yes, I'll send it today. To be precise, it's $150k base, $150k in stock over four years and a $40k sign-on.",
          ],
          score: 2,
          why: [
            "给出准确的数字和材料，前面说得含糊或夸大的地方也一并更正了。",
            "Accurate numbers and the letter, correcting anything vague or inflated you said before.",
          ],
          next: 'counter-small',
        },
        {
          say: ["我不太想发。", "I'd rather not."],
          score: 0,
          why: ["没有材料，薪酬团队不会批。个人信息可以涂掉再发。", "Without the letter, the comp team won't approve anything. You can black out personal details."],
          next: 'stands',
        },
        {
          say: ["数字可以告诉你，信就不发了。", "I can tell you the numbers, but not send the letter."],
          score: 1,
          why: ["数字有帮助，但没有信，能批的就有限。", "The numbers help, but without the letter what they can approve is limited."],
          next: 'counter-small',
        },
      ],
    },
    {
      id: 'signing',
      line: [
        "太好了，我来准备签字文件。签了以后，记得告诉其他公司你不再继续了。",
        "Great, I'll get the signing documents ready. Once you sign, please let the other companies know you're withdrawing.",
      ],
      choices: [
        {
          say: [
            "好的。不过签之前我想再多想几天：我还有一份书面 offer，base 15 万，四年股票 15 万，签字费 4 万。能看看差距能不能补上吗？",
            "Will do. But before signing I'd like a few more days: I hold another written offer, $150k base, $150k in stock over four years and a $40k sign-on. Could you see whether the gap can be closed?",
          ],
          score: 2,
          why: ["还没签就还能谈。现在提出来，比签了以后后悔好得多。", "Until you sign, you can still negotiate. Raising it now beats regretting it later."],
          next: 'counter-small',
        },
        {
          say: ["好的，我会告诉他们。", "Sure, I'll tell them."],
          score: 0,
          why: ["另一份 offer 的 base、股票和签字费都更高，你却一句没提就放弃了。", "Your other offer is higher on base, stock and sign-on, and you let it go without a word."],
          next: 'wrap',
        },
        {
          say: [
            "签之前，能把入职日期和签字费的条款书面确认一下吗？包括一年内离职要不要退。",
            "Before I sign, could you confirm the start date and the sign-on terms in writing, including whether it's repaid if I leave within a year?",
          ],
          score: 1,
          why: ["签之前看清条款是好习惯，只是钱的部分已经错过了谈的机会。", "Checking terms before signing is a good habit; you've just missed the chance to negotiate the money."],
          next: 'wrap',
        },
      ],
    },
    {
      id: 'counter',
      line: [
        "我和薪酬团队谈过了，可以做到：base 15 万，四年股票 14 万，签字费 3.5 万。",
        "I spoke with the comp team. We can do $150k base, $140k in stock over four years and a $35k sign-on.",
      ],
      choices: [
        {
          say: [
            "谢谢，已经很接近了。股票和签字费还比另一份低一点。如果这两项也能对齐，股票 15 万、签字费 4 万，我今天就签。",
            "Thank you, that's very close. The stock and sign-on are still a bit below the other offer. If those can match too, $150k in stock and a $40k sign-on, I'll sign today.",
          ],
          score: 2,
          why: ["差距已经很小，礼貌地把剩下的部分说清楚，再加一个更强的承诺。", "The gap is small now; name what's left politely, with an even firmer commitment."],
          next: 'last',
        },
        {
          say: ["谢谢，我接受。", "Thank you, I accept."],
          score: 1,
          why: ["结果不错。剩下的差距再礼貌地问一次是很正常的，也记得要书面版本。", "A good result. One more polite ask for the remaining gap is normal; and get it in writing."],
          next: 'end-accept',
        },
        {
          say: ["既然这么快就加了，base 能到 16.5 万吗？", "Since you moved so fast, could base go to $165k?"],
          score: 0,
          why: ["你的要求是对齐，对方基本做到了。这时突然加码，前面的理由就站不住了。", "Your ask was to match, and they nearly did. Raising the bar now undercuts your own reasoning."],
          next: 'end-firm',
        },
      ],
    },
    {
      id: 'counter-small',
      line: ["base 可以提到 15 万，其他部分保持不变。", "We can bring the base to $150k. Everything else stays the same."],
      choices: [
        {
          say: [
            "谢谢。另一份在股票和签字费上还领先：15 万和 4 万。如果这两项也能补上，我这周就签。",
            "Thank you. The other offer still leads on stock and sign-on: $150k and $40k. If you can close those too, I'll sign this week.",
          ],
          score: 2,
          why: ["把剩下的差距逐项说清，再给出签约承诺。", "Lay out the remaining gaps line by line, with a commitment to sign."],
          next: 'last',
        },
        {
          say: ["好的，可以。", "Okay, fine."],
          score: 0,
          why: ["股票差 3 万、签字费差 1.5 万，你一句没提就接受了。", "You accepted $30k less stock and $15k less sign-on without a word."],
          next: 'end-accept',
        },
        {
          say: ["那我就去另一家了。", "Then I'll take the other offer."],
          score: 0,
          why: [
            "你说过更想回来。用不打算兑现的威胁，对方可能真的会放手。",
            "You said you'd prefer to come back. Threaten something you won't do, and they may just let you go.",
          ],
          next: 'end-walk',
        },
      ],
    },
    {
      id: 'stands',
      line: ["那恐怕 offer 只能维持原样了。", "Then I'm afraid the offer stays as it is."],
      choices: [
        {
          say: [
            "明白，我今天还是把信发给你吧。是 base 15 万，四年股票 15 万，签字费 4 万。",
            "Understood. I'll send the letter today after all. It's $150k base, $150k in stock over four years and a $40k sign-on.",
          ],
          score: 2,
          why: ["转回来还来得及，材料一到，申请就能开始。", "It's not too late to turn back; once the letter arrives, the request can start."],
          next: 'last',
        },
        {
          say: ["好吧，那我按原样签。", "Fine, I'll sign it as is."],
          score: 0,
          why: ["base、股票和签字费都比另一份低，你却什么也没争取。", "It's lower on base, stock and sign-on than your other offer, and you didn't try for anything."],
          next: 'end-asis',
        },
        {
          say: ["那我就用满三周再决定。", "Then I'll take the full three weeks to decide."],
          score: 1,
          why: ["守住了期限，但条件一点没变。", "You kept the deadline, but the terms didn't change at all."],
          next: 'end-time',
        },
      ],
    },
    {
      id: 'wrap',
      line: ["好的，文件马上发给你。还有别的事吗？", "Okay, the documents are on their way. Anything else?"],
      choices: [
        {
          say: ["谢谢这个暑假的照顾。我会把合同完整读一遍，周五前签好发回。", "Thanks for all your help this summer. I'll read the whole contract and send it back signed by Friday."],
          score: 2,
          why: ["已经决定接受，就把它做好：读清条款，按时签回，并且守约。", "Once you've decided to accept, do it well: read the terms, sign on time and keep your word."],
          next: 'end-signed',
        },
        {
          say: ["没有了。我会签，不过另一家的流程我先留着，万一呢。", "No. I'll sign, but I'll keep my other process open just in case."],
          score: 0,
          why: [
            "签了还留着后路，往往就是毁约的开始。毁约会伤害你在这家公司和同行里的信誉。",
            "Signing while keeping a back door open is often how reneging starts, and reneging hurts your name with this company and beyond.",
          ],
          next: 'end-signed',
        },
        {
          say: ["发之前，签字费能再加一点吗？", "Before you send it, could the sign-on go up a bit?"],
          score: 1,
          why: ["签前问一句不算错，但前面已经答应了，现在能变的很少。", "Asking before signing isn't wrong, but having said yes, there's little left to change."],
          next: 'end-firm',
        },
      ],
    },
    {
      id: 'last',
      line: [
        "我又去问了一次。股票可以到 15 万，签字费最多 3.5 万，不能再多了。这是最终方案。",
        "I asked once more. Stock can go to $150k, but the sign-on stays at $35k at most. That's our final offer.",
      ],
      choices: [
        {
          say: [
            "谢谢你帮我争取，这样我可以接受。请把更新后的 offer 发给我，我读完就签。",
            "Thank you for pushing for it; that works for me. Please send the updated offer and I'll sign once I've read it.",
          ],
          score: 2,
          why: ["差距只剩 5000，收下最终方案，拿到书面版本再签。", "Only $5k apart now: take the final terms, and sign once they're in writing."],
          next: 'end-written',
        },
        {
          say: ["好的，成交。", "Okay, deal."],
          score: 1,
          why: ["可以接受，记得先拿到书面版本再签。", "Fine to accept; just get it in writing before you sign."],
          next: 'end-accept',
        },
        {
          say: ["签字费真的不能到 4 万吗？不然我就去另一家。", "Can't you really do the $40k sign-on? Otherwise I'll go elsewhere."],
          score: 0,
          why: ["为了 5000 美元威胁离开一个你更想回去的地方，得不偿失。", "Threatening to leave a place you'd rather join over $5k isn't worth it."],
          next: 'end-firm',
        },
      ],
    },
    end('end-written', ["太好了！更新后的 offer 今天发给你。欢迎回来！", "Wonderful! The updated offer will be in your inbox today. Welcome back!"]),
    end('end-accept', ["太好了，欢迎回来！我今天把文件发给你。", "Great, welcome back! I'll send the documents today."]),
    end('end-firm', ["抱歉，这已经是我们能做到的了。", "Sorry, that's as far as we can go."]),
    end('end-walk', [
      "理解，很遗憾。如果改变主意，在信里的期限之前告诉我都可以。",
      "I understand, and I'm sorry to hear it. If you change your mind, let me know before the deadline in the letter.",
    ]),
    end('end-asis', ["好的，欢迎回来！签字文件马上发给你。", "Great, welcome back! The signing documents are on their way."]),
    end('end-time', ["当然，信里的期限有效。想好了随时告诉我。", "Of course, the deadline in the letter stands. Let me know whenever you've decided."]),
    end('end-signed', ["收到，欢迎回来！入职材料过几天发给你。", "Got it, welcome back! Onboarding details will follow in a few days."]),
  ],
};

export const SCRIPTS: Script[] = [SALARY_ASK, EXPLODING_OFFER, COMPETING_OFFER, BASE_TO_SIGNON, RETURN_PLUS_EXTERNAL];

/**
 * Plays `picks` (choice indexes) from the start; stops at an ending or an out-of-range pick.
 * `at` is where the walk stands: the next step, or the ending once `ended`.
 */
export function walk(s: Script, picks: number[]) {
  const byId = new Map(s.nodes.map((n) => [n.id, n]));
  let at = byId.get(s.start)!;
  const steps: { node: Node; pick: number }[] = [];
  let total = 0;
  for (const pick of picks) {
    const choice = at.choices[pick];
    if (!choice) break;
    steps.push({ node: at, pick });
    total += choice.score;
    at = byId.get(choice.next)!;
  }
  return { steps, at, total, max: steps.length * 2, ended: !at.choices.length };
}
