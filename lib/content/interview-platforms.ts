// /interview-platforms: what each interview platform's own candidate help pages say, row by row.
// Every fact or employer cell names the official pages it was read from (checked October 2026,
// in our own words); 'none' means we found nothing official. Pure data: no imports.

export const CHECKED = '2026-10';

export type RowKey = 'format' | 'scoring' | 'feedback' | 'resubmit' | 'editor' | 'resources' | 'proctoring';

/** fact: the platform's fixed rule. employer: each employer sets it (text = the default or the range). none: not stated. */
export type Cell = { k: 'fact' | 'employer'; zh: string; en: string; src: string[] } | { k: 'none' };

export type Platform = {
  id: string;
  name: string;
  domain: string;
  languagesSrc: string;
  cells: Record<RowKey, Cell>;
  practice: { href: string; zh: string; en: string }[];
};

export const ROWS: { key: RowKey; zh: string; en: string }[] = [
  { key: 'format', zh: '形式与轮次', en: 'Format' },
  { key: 'scoring', zh: '计分与部分分', en: 'Scoring and partial credit' },
  { key: 'feedback', zh: '交卷前能看到的反馈', en: 'Feedback before you hand in' },
  { key: 'resubmit', zh: '能否重交', en: 'Resubmitting' },
  { key: 'editor', zh: '编辑器（补全 / 运行 / 画图）', en: 'Editor (completion, running, drawing)' },
  { key: 'resources', zh: '允许查的资料', en: 'Outside resources' },
  { key: 'proctoring', zh: '监考（摄像头 / 录屏 / 切屏检测）', en: 'Proctoring (camera, recording, leaving the tab)' },
];

const HR = 'https://candidatesupport.hackerrank.com/articles/';
const CS = 'https://support.codesignal.com/hc/en-us/articles/';
const CO = 'https://support.codility.com/hc/en-us/articles/';
const CP = 'https://coderpad.io/resources/docs/';
const CP_GUIDE = `${CP}for-candidates/interview-preparation-guide/`;
const KA_CANDIDATE = 'https://karat.com/candidate-experience/';
const KA_FAQ = 'https://karat.com/customer-faq';
const HE = 'https://help.hackerearth.com/hc/en-us/articles/';

export const PLATFORMS: Platform[] = [
  {
    id: 'hackerrank',
    name: 'HackerRank',
    domain: 'hackerrank.com',
    languagesSrc: `${HR}2201684846-execution-environment`,
    cells: {
      format: {
        k: 'fact',
        zh: '公司发来的在线限时测评，自己一个人做；题型按岗位定，可能有编程题、选择题等。登录页写明时长和题目结构。',
        en: 'An online timed test a company sends you, taken alone; question types depend on the role (coding, multiple choice and others). The login page shows the duration and the test format.',
        src: [`${HR}9881337709-getting-familiar-with-hackerrank-tests`],
      },
      scoring: {
        k: 'fact',
        zh: '按通过的测试用例给分：全过满分，过一部分就拿这部分用例的分。输出格式必须和期望完全一致。',
        en: 'Scored by test case: all pass for full marks, some pass for the points of those cases. The output format must match the expected one exactly.',
        src: [`${HR}4513323466-evaluation-method-of-coding-questions`],
      },
      feedback: {
        k: 'employer',
        zh: '默认点 Run Code 也会跑隐藏用例，能看到你的输出和调试输出，看不到期望输出；出题方可以把隐藏用例的输出关掉。',
        en: 'By default Run Code also runs the hidden cases and shows your output and debug prints, never the expected output; the test setter can switch that output off.',
        src: [`${HR}6052652546-hidden-test-cases`],
      },
      resubmit: {
        k: 'fact',
        zh: '考试结束前可以回到已交的题，改了再交，次数不限；算的是最后一次提交，不是得分最高的那次。改完先点 Run Code 再提交，不然算的是上一次编译过的版本。',
        en: 'Until the test ends you can reopen a submitted question and resubmit as often as you like; the last submission counts, not the best one. Run the changed code before submitting, or the last compiled version is what counts.',
        src: [`${HR}5994519354-modifying-the-code-submissions-in-a-test`],
      },
      editor: {
        k: 'fact',
        zh: '编辑器有类似 IDE 的自动补全，可以在菜单里关掉，也能按 Ctrl+Space 手动唤出；语法错误会在代码下面划线提示。',
        en: 'The editor has IDE-style autocomplete you can switch off in its menu or call up with Ctrl+Space, and it underlines syntax errors as you type.',
        src: [`${HR}5333090786-using-code-auto-complete`],
      },
      resources: {
        k: 'employer',
        zh: '默认只能自己做：抄书本或网上的代码、找人帮忙都算违规。测试可能内置 AI 助手，开不开、只答语法和概念还是能直接写代码，由雇主设定；开考前的说明会写，没看到 AI 面板就是没开。',
        en: 'By default you work alone: copying code from books or websites and getting help from someone count as malpractice. A test may include a built-in AI assistant; the employer decides whether it is on and whether it only explains syntax and concepts or writes code too. The instructions say so before you start, and no AI panel means it is off.',
        src: [`${HR}9579706989-malpractices-in-tests`, `${HR}7634558376-ai-assistant-in-tests`],
      },
      proctoring: {
        k: 'employer',
        zh: '默认就记录复制粘贴（粘贴的内容会进报告），以及离开考试窗口的次数和时长。雇主还可以加开：强制全屏并禁止复制粘贴、摄像头定时拍照、用 AI 分析截图和摄像头画面，最严的要装桌面客户端锁定电脑。',
        en: 'By default every copy and paste is logged (pasted text goes into the report), and so are how often and how long you leave the test window. The employer can add more: forced full screen with copy and paste blocked, periodic webcam snapshots, AI analysis of screenshots and webcam images, and at the strictest a desktop app that locks the computer down.',
        src: ['https://support.hackerrank.com/articles/1079706165-proctoring-hackerrank-tests'],
      },
    },
    practice: [{ href: '/?view=mock', zh: '模拟 OA：按 HackerRank 平台筛选公司预设', en: 'Mock OA: filter the presets to HackerRank' }],
  },
  {
    id: 'codesignal',
    name: 'CodeSignal',
    domain: 'codesignal.com',
    languagesSrc: `${CS}360039872514-What-languages-can-I-use`,
    cells: {
      format: {
        k: 'fact',
        zh: '限时在线测评，开始后要一次做完、不能暂停，题目可以按任意顺序做；时长和题量由出题方设定，开考前能看到。标准化的 GCA 是 4 题 70 分钟。',
        en: 'A timed online assessment taken in one sitting with no pause, questions in any order; the administrator sets the time and question count, shown before you start. The standardised GCA is 4 questions in 70 minutes.',
        src: [
          `${CS}360045953873-Taking-an-assessment-on-CodeSignal`,
          `${CS}360040370853-What-should-I-expect-when-I-take-the-General-Coding-Assessment-GCA-and-how-is-it-structured`,
        ],
      },
      scoring: {
        k: 'fact',
        zh: '按通过的测试用例（样例加隐藏）数量计分，过一部分也有分。GCA、ICA 这类认证测评另给一个 200–600 的 Coding Score。',
        en: 'Scored on how many test cases you pass, sample and hidden together, so partial passes count. Certified assessments such as the GCA and ICA also give a Coding Score from 200 to 600.',
        src: [
          `${CS}360039872914-What-is-the-CodeSignal-Cloud-IDE-Coding-Environment`,
          `${CS}19116922232983-What-are-the-Industry-Coding-Assessment-ICA-rules`,
        ],
      },
      feedback: {
        k: 'fact',
        zh: '能看到样例用例的结果，也可以自己加用例（不计分）；点 Submit 才连同隐藏用例一起跑。',
        en: 'You see results on the sample cases and can add your own (they do not count); Submit runs the full suite, hidden cases included.',
        src: [
          `${CS}360039872914-What-is-the-CodeSignal-Cloud-IDE-Coding-Environment`,
          `${CS}8105682814487-Creating-custom-test-cases-for-single-function-questions`,
        ],
      },
      resubmit: {
        k: 'fact',
        zh: '考试时间内可以随时重交，每题按你得分最高的那次提交算；时间到后还有 1 分钟把答案交上去。',
        en: 'Resubmit as often as you like before time runs out; each question keeps your highest-scoring submission. When time is up you get one more minute to submit.',
        src: [`${CS}360040370573-Can-I-change-my-answer-after-I-submit-it`],
      },
      editor: {
        k: 'fact',
        zh: '用平台自带的编辑器写，设置里有自动补全等选项；多数测评不允许用自己的 IDE，测评规则会写明。',
        en: 'You code in the built-in editor, with autocomplete among its settings; most assessments do not allow an outside IDE, and the rules say whether yours does.',
        src: [`${CS}360039872914-What-is-the-CodeSignal-Cloud-IDE-Coding-Environment`, `${CS}360039872874-Can-I-use-my-own-IDE`],
      },
      resources: {
        k: 'employer',
        zh: '每场测评的规则不同，开考前会列出来让你逐条确认。以 GCA 为例：可以查语法和文档，不能搜解法，也不能用 AI。',
        en: 'Rules differ per assessment and are listed for you to confirm before you start. The GCA, for example, allows syntax and documentation lookups but not searching for solutions, and no AI.',
        src: [
          `${CS}360051960134-General-Coding-Assessment-GCA-Rules-and-Setup`,
          `${CS}360040370993-How-do-I-prepare-for-this-coding-assessment-Am-I-allowed-to-use-Google-to-help-me-research`,
        ],
      },
      proctoring: {
        k: 'employer',
        zh: '部分测评有远程监考，开考前在测评页能看到是否需要。监考要全程共享摄像头、麦克风和屏幕，并出示有效的带照片证件；开考前要关掉无关的标签页和程序，录像由 CodeSignal 的团队事后审核。',
        en: 'Some assessments are proctored, and the assessment page says so beforehand. Proctoring means sharing your camera, microphone and screen throughout and showing a valid photo ID; you close unrelated tabs and apps first, and CodeSignal’s team reviews the recording afterwards.',
        src: [`${CS}360039872174-What-is-proctoring-and-how-does-it-work`],
      },
    },
    practice: [
      { href: '/?view=mock', zh: '模拟 OA：选 CodeSignal 平台、标着「GCA 式计分」的预设', en: 'Mock OA: a CodeSignal preset marked “GCA-style score”' },
      { href: '/oa/ica', zh: 'ICA 式四关项目题', en: 'ICA-style four-level project' },
    ],
  },
  {
    id: 'codility',
    name: 'Codility',
    domain: 'codility.com',
    languagesSrc: `${CO}360043823713-What-technologies-does-Codility-support`,
    cells: {
      format: {
        k: 'fact',
        zh: '限时在线测评，通常半小时到两小时，具体由测评方定；开始后不能暂停，倒计时管整场而不是单题，时间到时编辑器里的代码自动提交。',
        en: 'A timed online assessment, usually 30 minutes to two hours as the administrator sets; the clock cannot be paused, covers the whole assessment rather than one task, and whatever is in the editor is submitted when time runs out.',
        src: [`${CO}360046973393-How-much-time-does-a-Codility-assessment-take`],
      },
      scoring: {
        k: 'fact',
        zh: '交卷后才用多组测试检查正确性（边界情况）和规模（数据变大还跑不跑得动），按通过的测试得分；题面样例不计分，编译不过的答案不得分。',
        en: 'Only after you hand in does it run many tests for correctness (corner cases) and scalability (whether it copes as data grows), and you earn points per test passed; the examples do not count, and code that fails to compile scores nothing.',
        src: [
          `${CO}360046335814-How-will-my-solutions-be-assessed`,
          `${CO}360046336334-How-many-points-did-I-earn`,
          `${CO}360047658693-Why-did-I-score-0-despite-passing-example-test-cases`,
        ],
      },
      feedback: {
        k: 'fact',
        zh: 'Run 只编译并跑题面样例和你自己加的用例；显示 OK 只说明样例过了，评分用的测试要交卷后才跑。',
        en: 'Run compiles and checks the example plus any cases you add; an OK only means the example passed, since the scoring tests run after you hand in.',
        src: [
          `${CO}360046336134-I-clicked-Run-and-the-app-said-OK-Does-this-mean-I-successfully-solved-the-task`,
          `${CO}360046973853-How-can-I-test-my-solution-before-submitting-it`,
        ],
      },
      resubmit: {
        k: 'fact',
        zh: '每题只能交一次：点了 Submit 就不能再改。没交的题可以随时切换着写，时间到时编辑器里的内容自动作为最终提交。',
        en: 'One submission per task: once you click Submit the solution is final. You can move between unsubmitted tasks freely, and whatever is in the editor when time runs out becomes the final submission.',
        src: [`${CO}360046336274-How-do-I-save-my-code`],
      },
      editor: {
        k: 'employer',
        zh: '网页编辑器里可以编译运行。能否在自己的编辑器写好再贴回来，看测评规定；贴回来后点 Run 确认能编译。给定的函数签名不能改。',
        en: 'The web editor compiles and runs your code. Whether you may write in your own editor and paste it back depends on the test’s policy; if you do, click Run to check it compiles. Keep the given function signature as it is.',
        src: [`${CO}360046336234-Can-I-use-my-own-IDE`, `${CO}360046336054-Can-I-modify-the-initial-code`],
      },
      resources: {
        k: 'employer',
        zh: '必须独立完成，不能向任何人求助；能不能查书和网站，看测评链接里的规定或问测评方。',
        en: 'You must work alone and may not get help from anyone; whether books or websites are allowed depends on the policy in your test link, or ask the test administrator.',
        src: [`${CO}360046336174-May-I-consult-a-book-website-or-colleague`],
      },
      proctoring: {
        k: 'employer',
        zh: '看测评方的要求：有的会记录屏幕或用摄像头（录像或拍照），这时要先完成摄像头设置才能开考。',
        en: 'Up to the testing team: some record your screen or use the camera (video or snapshots), and then the camera has to be set up before you can start.',
        src: [
          `${CO}26258906969489-What-behavioral-events-will-you-track`,
          `${CO}17985758613911-My-test-requires-camera-access-but-I-don-t-have-a-web-camera-on-my-device-What-should-I-do`,
        ],
      },
    },
    practice: [
      {
        href: '/?view=mock&rules=codility',
        zh: '模拟 OA：在「自定义一套」里选「单次提交制」',
        en: 'Mock OA: under “Build your own”, pick single-submission rules',
      },
    ],
  },
  {
    id: 'coderpad',
    name: 'CoderPad',
    domain: 'coderpad.io',
    languagesSrc: 'https://coderpad.io/languages/',
    cells: {
      format: {
        k: 'fact',
        zh: '面试官发来链接，在共享的在线编辑器里和你一起实时写代码，可能同时开视频；也可能是限时的 take-home 项目，自己点提交，时间到自动提交。',
        en: 'The interviewer sends a link and you code together in a shared online editor, possibly over video; it can also be a timed take-home project that you submit, or that submits itself when time is up.',
        src: [CP_GUIDE],
      },
      scoring: { k: 'none' },
      feedback: {
        k: 'employer',
        zh: '默认可以随时点 Run 看输出，部分语言还有交互式 REPL；面试官可以在设置里关掉代码运行，只看你写。',
        en: 'By default you can click Run any time and see the output, with a REPL for some languages; the interviewer can switch code execution off and just watch you write.',
        src: [CP_GUIDE, `${CP}interview/pads/settings/`],
      },
      resubmit: { k: 'none' },
      editor: {
        k: 'fact',
        zh: '多数语言有自动补全（可以在设置里关掉），也能换成 Vim 或 Emacs 键位；面试官可以打开画图模式（基于 Excalidraw）。',
        en: 'Most languages have autocomplete, which you can switch off in settings, and Vim or Emacs key bindings are available; the interviewer can turn on a drawing mode built on Excalidraw.',
        src: [CP_GUIDE],
      },
      resources: {
        k: 'employer',
        zh: '规则由面试官定。面试官可以打开 AI Assist 标签页（ChatGPT）；开了也要先问清楚怎样用算合规。',
        en: 'The interviewer sets the rules. They can turn on an AI Assist tab (ChatGPT); even then, ask what counts as acceptable use.',
        src: [CP_GUIDE],
      },
      proctoring: {
        k: 'fact',
        zh: '全程记录每位参与者的每次按键，面试结束后面试官可以回放；从编辑器外粘贴、焦点离开编辑器（打开浏览器控制台也算）都会在回放里标出来。',
        en: 'Every keystroke of every participant is recorded and the interviewer can replay it afterwards; pastes from outside the editor and moments when focus leaves it (opening the browser console included) are marked on the timeline.',
        src: [`${CP}interview/pads/playback-mode/`],
      },
    },
    practice: [
      { href: '/playground', zh: '代码沙盒：边写边运行', en: 'Code playground: write and run' },
      {
        href: '/?view=problems',
        zh: '面试官关掉运行时：在题目页开白板模式',
        en: 'If running is switched off: whiteboard mode on a problem page',
      },
    ],
  },
  {
    id: 'karat',
    name: 'Karat',
    domain: 'karat.com',
    languagesSrc: 'https://karat.com/karat-interview/',
    cells: {
      format: {
        k: 'fact',
        zh: '由 Karat 的面试工程师代招聘方进行的 60 分钟线上面试：简短介绍、约 10 分钟讨论题、约 40 分钟编程题。',
        en: 'A 60-minute live interview run by a Karat interview engineer on the hiring company’s behalf: a short introduction, about 10 minutes of discussion questions and about 40 minutes of programming.',
        src: [KA_CANDIDATE],
      },
      scoring: {
        k: 'fact',
        zh: '面试官按统一的评分细则打分，之后出一份报告：总体建议、量化分数和每道题的书面反馈。招聘方拿到录像和报告，自己决定下一步。',
        en: 'Interviewers score against fixed rubrics, and a report follows: an overall recommendation, a numeric score and written feedback on each question. The hiring company gets the recording and the report and decides the next step.',
        src: [KA_FAQ, KA_CANDIDATE],
      },
      feedback: {
        k: 'fact',
        zh: '面试官全程在场，会实时引导、给反馈；官方说最看重的是你的代码能不能解决问题。',
        en: 'The interviewer is with you throughout, guiding and giving feedback live; Karat says what it weighs most is how well your code solves the problem.',
        src: [KA_CANDIDATE],
      },
      resubmit: {
        k: 'fact',
        zh: '第一轮技术面可以在面试后 24 小时内申请重面一次，换一套新题；两次的结果都会交给招聘方，由对方决定。',
        en: 'You can ask to redo a first-round technical interview within 24 hours of it, with a new set of questions; both results go to the hiring company, which decides.',
        src: ['https://connect.karat.com/redo-interviews'],
      },
      editor: {
        k: 'fact',
        zh: '在 Karat 自己的在线编程环境里写，官方称工具齐全，支持高对比度、大字号和文字聊天；补全、运行等细节没有写明。',
        en: 'You code in Karat’s own online environment, described as a fully tooled IDE with high-contrast, large-font and text-chat support; completion and running code are not spelled out.',
        src: [KA_CANDIDATE, KA_FAQ],
      },
      resources: {
        k: 'employer',
        zh: '看雇主选的面试模块：有的内置 AI 助手，有的允许查外部资料（可能包括生成式 AI），有的什么都不许查。没有另行说明时，不许用非原创代码、找人帮忙，或把题目贴进搜索引擎或 GPT。',
        en: 'Depends on the interview module the employer picks: some have a built-in AI assistant, some allow outside resources (possibly generative AI), others allow none. Unless told otherwise, non-original code, outside help and pasting the question into a search engine or GPT are not allowed.',
        src: [KA_FAQ],
      },
      proctoring: {
        k: 'fact',
        zh: '每场都录音并记录代码回放，开不开摄像头都一样，官方强烈建议开。面试官会留意在浏览器外打字、频繁看别的屏幕等异常，怀疑作弊会交给第二位面试官复核。',
        en: 'Audio and code playback are recorded in every interview whether or not your camera is on, though Karat strongly encourages turning it on. Interviewers watch for things like typing outside the browser or looking between monitors, and a suspected case goes to a second interviewer for review.',
        src: [KA_FAQ],
      },
    },
    practice: [
      {
        href: '/?view=mock-interview&template=screen-rapid',
        zh: '模拟面试：「快问快答 + 多段编程电面」模板，先答基础题再写代码',
        en: 'Mock interview: the “Rapid-fire + multi-part coding screen” template, questions first, then code',
      },
    ],
  },
  {
    id: 'hackerearth',
    name: 'HackerEarth',
    domain: 'hackerearth.com',
    languagesSrc: `${HE}360002371373-supported-browsers-and-languages`,
    cells: {
      format: {
        k: 'fact',
        zh: '在线限时测评，一场可以混合选择题、编程题等多种题型，按题型分区；每题标着分值和是否倒扣分（默认不倒扣），最后要点 End Test 交卷。',
        en: 'A timed online test that can mix multiple-choice, programming and other question types, grouped by type; each question shows its marks and any negative marking (off by default), and you finish by clicking End Test.',
        src: [`${HE}360002082713-getting-familiar-with-the-test-environment`],
      },
      scoring: {
        k: 'fact',
        zh: '编程题把通过的隐藏用例分数加起来（比如 10 个等分的用例过 3 个，得 30/100），样例不计分；选择题按答案自动判。',
        en: 'Programming questions add up the points of the hidden cases you pass (3 of 10 equal cases gives 30/100), and sample cases carry no points; multiple-choice answers are checked against a key.',
        src: [`${HE}360006346933-evaluating-programming-questions`, `${HE}360002710473-multiple-choice-questions-mcqs-`],
      },
      feedback: {
        k: 'fact',
        zh: 'Compile & Test 跑样例（输入和期望输出都看得到）或你填的自定义输入；隐藏用例要按 Submit 才跑。',
        en: 'Compile & Test runs the samples, whose input and expected output you can see, or your own custom input; hidden cases run only when you click Submit.',
        src: [`${HE}360002470854-test-cases`, `${HE}360002609913-testing-your-code`],
      },
      resubmit: {
        k: 'fact',
        zh: '官方两处说法不一：一篇写编程题提交后不能再改，另一篇的界面说明里有修改已交答案的链接。按只能交一次来准备最稳。',
        en: 'The help pages disagree: one says code cannot be changed once submitted, another shows a link for changing a submitted answer. Plan as if you get one submission.',
        src: [`${HE}360002470854-test-cases`, `${HE}360002082713-getting-familiar-with-the-test-environment`],
      },
      editor: {
        k: 'fact',
        zh: 'Monaco 编辑器（和 VS Code 同一个内核），部分语言有智能补全和实时语法检查，可以在设置里关；可以用自定义输入调试。',
        en: 'A Monaco editor (the core of VS Code) with completion and live linting for some languages, which you can switch off in settings; custom input lets you debug.',
        src: [`${HE}900000796563-the-monaco-editor`, `${HE}360002609913-testing-your-code`],
      },
      resources: {
        k: 'employer',
        zh: '官方没列出能查哪些资料；雇主可以禁止往编辑器里粘贴代码，也可以禁止复制题面。',
        en: 'No list of allowed resources is published; the employer can block pasting into the editor and copying the problem statement.',
        src: [`${HE}360002359894-before-you-begin-`],
      },
      proctoring: {
        k: 'employer',
        zh: '雇主可以要求开摄像头并远程实时监看、强制全屏（退出会警告），最严的设置下每次离开考试页都会先警告再被登出；系统弹窗也算离开，考前最好关掉系统更新。',
        en: 'The employer can require a webcam with live remote monitoring and force full screen (leaving it brings a warning); under the strictest setting, each time you leave the test page you are warned and then logged out. System pop-ups count too, so turn off updates first.',
        src: [`${HE}360002359894-before-you-begin-`],
      },
    },
    practice: [
      { href: '/oa/mcq', zh: 'OA 选择题练习', en: 'OA multiple-choice practice' },
      {
        href: '/?view=mock',
        zh: '模拟 OA 的选择题环节（题号面板、标记待查）',
        en: 'The multiple-choice part of a mock OA (question palette, flag for review)',
      },
    ],
  },
];
