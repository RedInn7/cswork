import { SITE_URL } from '@/lib/seo';

/** Where the setup puts the script; the snippets below all point at it. */
const SCRIPT = '~/.cswork/cswork-mcp.mjs';
const DOWNLOAD = `mkdir -p ~/.cswork && curl -fsSL ${SITE_URL}/mcp/cswork-mcp.mjs -o ${SCRIPT}`;
const CLAUDE = `claude mcp add --transport stdio cswork --scope user \\
  --env CSWORK_TOKEN=cswork_pat_your_token \\
  -- node ${SCRIPT}`;
const cursor = (home: string) =>
  JSON.stringify(
    {
      mcpServers: {
        cswork: {
          command: 'node',
          args: [`${home}/.cswork/cswork-mcp.mjs`],
          env: { CSWORK_TOKEN: 'cswork_pat_your_token' },
        },
      },
    },
    null,
    2,
  );

const TOOLS: [name: string, zh: string, en: string][] = [
  ['get_daily_problem', '今天的每日一题，带完整题面和样例。', "Today's daily problem with its full statement and examples."],
  ['search_problems', '按标题、题号、难度或公司搜索可评测的算法题和 OA 真题。', 'Search judgeable algorithm and company OA problems by title, number, difficulty or company.'],
  ['get_problem', '一道题的题面、时空限制、样例和 LeetCode 模式代码模板。', "One problem's statement, limits, examples and LeetCode-mode template."],
  ['run_code', '在公开样例或自定义输入上运行代码，不算正式提交。', "Run code on the public examples or custom input. It isn't a formal submission."],
  ['submit_code', '正式提交，跑全部测试点（含隐藏点），计入进度和打卡。', 'Formal submission against every test case, hidden ones included. Counts toward progress and streaks.'],
  ['get_submission', '查看运行或提交的结果和每个测试点，判题中会等最多 30 秒。', 'Verdict and per-case results of a run or submission; waits up to 30 s while judging.'],
];

function Snippet({ label, code }: { label: string; code: string }) {
  return (
    <figure className="mcp-snippet">
      <figcaption>{label}</figcaption>
      <pre>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

/** /mcp: set up the CSWork MCP server (tools/mcp/cswork-mcp.mjs) in Claude Code or Cursor. */
export function McpView({ zh }: { zh: boolean }) {
  const say = (chinese: string, english: string) => (zh ? chinese : english);
  return (
    <div className="public-library mcp-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="public-library-header">
        <a className="public-library-brand" href="/">
          cswork<span> / MCP</span>
        </a>
        <a href="/?view=problems">
          {say('去题库练习', 'Open the problems')} <span aria-hidden="true">↗</span>
        </a>
      </header>
      <main className="public-library-main" id="main-content">
        <div className="public-library-intro">
          <p className="public-library-eyebrow">MODEL CONTEXT PROTOCOL</p>
          <h1>{say('在 Claude Code 和 Cursor 里练题', 'Practice from Claude Code and Cursor')}</h1>
          <p>
            {say(
              '装上 CSWork 的 MCP 服务器，就能在 AI 编辑器里读题、跑样例、正式提交、看判题结果，用的是网站上同一套题库和评测，进度也记在你的账号上。',
              'Add the CSWork MCP server and your AI editor can read problems, run the examples, submit and read verdicts: the same problems and judge as the site, with progress on your account.',
            )}
          </p>
        </div>

        <ol className="mcp-steps">
          <li>
            <h2>{say('生成访问令牌', 'Create an access token')}</h2>
            <p>
              {say('登录后打开', 'Sign in, open')}{' '}
              <a href="/?view=account">{say('账号页', 'your account')}</a>
              {say(
                '，在「在 AI 编辑器里练题（MCP）」里起个名字并生成令牌。令牌只显示一次，复制下来；不用了随时吊销。',
                ', find Practice from your AI editor (MCP), name a token and create it. It is shown only once, so copy it; revoke it whenever you stop using it.',
              )}
            </p>
          </li>
          <li>
            <h2>{say('下载服务器脚本', 'Download the server')}</h2>
            <p>
              {say(
                '一个文件，只用 Node 18 以上自带的模块，没有依赖。',
                'One file that uses only what ships with Node 18 or newer, no dependencies.',
              )}{' '}
              <a href="/mcp/cswork-mcp.mjs">{say('先看看源码', 'Read the source first')}</a>
            </p>
            <Snippet label={say('终端', 'Terminal')} code={DOWNLOAD} />
          </li>
          <li>
            <h2>{say('接到编辑器', 'Connect your editor')}</h2>
            <h3>Claude Code</h3>
            <Snippet label={say('终端', 'Terminal')} code={CLAUDE} />
            <p className="mcp-note">
              {say(
                '把 cswork_pat_your_token 换成你的令牌。--scope user 让所有项目都能用；在 Claude Code 里输入 /mcp 能看到 cswork 已连接。',
                'Replace cswork_pat_your_token with your token. --scope user makes it available in every project; /mcp inside Claude Code shows cswork as connected.',
              )}
            </p>
            <h3>Cursor</h3>
            <Snippet label="~/.cursor/mcp.json" code={cursor('/Users/you')} />
            <p className="mcp-note">
              {say(
                '路径要写绝对路径（终端里 echo ~ 能看到你的主目录）。只想在一个项目里用，就写到项目的 .cursor/mcp.json。保存后在 Cursor 设置的 MCP 页面里打开 cswork。',
                'Use an absolute path (echo ~ in a terminal prints your home directory). For one project only, put it in that project’s .cursor/mcp.json. Then turn cswork on under MCP in Cursor’s settings.',
              )}
            </p>
            <h3>{say('其他 MCP 客户端', 'Other MCP clients')}</h3>
            <p className="mcp-note">
              {say(
                '任何支持 stdio 的客户端都行：命令是 node，参数是脚本路径，环境变量 CSWORK_TOKEN 填令牌。想看中文题面就再加 CSWORK_LANG=zh。',
                'Any client with stdio servers works: the command is node, the argument is the script path, and CSWORK_TOKEN holds the token. Add CSWORK_LANG=zh for Chinese statements.',
              )}
            </p>
          </li>
          <li>
            <h2>{say('开始练', 'Ask for a problem')}</h2>
            <ul className="mcp-prompts">
              <li>{say('「给我今天的 cswork 每日一题」', '“Give me today’s cswork daily problem.”')}</li>
              <li>{say('「在 cswork 上找几道 Amazon OA 的滑动窗口题」', '“Find a few sliding-window Amazon OA problems on cswork.”')}</li>
              <li>{say('「先用样例跑一下我的代码，过了再正式提交」', '“Run my code on the examples, and submit it if they pass.”')}</li>
            </ul>
            <p className="mcp-note">
              {say(
                '服务器会提醒模型让你自己写解法；想看提示或题解时直接说。',
                'The server asks the model to let you write the solution yourself; ask outright when you want a hint or an answer.',
              )}
            </p>
          </li>
        </ol>

        <section className="mcp-section" aria-labelledby="mcp-tools">
          <h2 id="mcp-tools">{say('工具', 'Tools')}</h2>
          <dl className="mcp-tools">
            {TOOLS.map(([name, chinese, english]) => (
              <div key={name}>
                <dt>
                  <code>{name}</code>
                </dt>
                <dd>{say(chinese, english)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mcp-section" aria-labelledby="mcp-safety">
          <h2 id="mcp-safety">{say('令牌安全与限额', 'Token safety and limits')}</h2>
          <ul className="mcp-facts">
            <li>
              {say(
                '令牌只能读题、运行和提交代码、看自己的结果；读不到笔记和题单，改不了账号，也不能生成新令牌。',
                'A token can only read problems, run and submit code and read your own results. It cannot read notes or lists, change your account or create tokens.',
              )}
            </li>
            <li>
              {say(
                '服务器只保存令牌的 SHA-256 哈希；令牌泄露了就在账号页吊销，立刻失效。',
                'The server keeps only a SHA-256 hash of each token. If one leaks, revoke it on your account page and it stops working at once.',
              )}
            </li>
            <li>
              {say(
                '每个令牌每分钟最多 60 次请求；通过令牌的运行加提交每小时最多 120 次，网站原有的每分钟限额照常生效。',
                'Each token gets 60 requests a minute. Runs and submissions through tokens are capped at 120 an hour, on top of the site’s usual per-minute limits.',
              )}
            </li>
            <li>
              {say(
                '脚本只通过 HTTPS 连 cswork.org；把 CSWORK_BASE_URL 指向别处时，除本机外也必须是 HTTPS。',
                'The script talks to cswork.org over HTTPS only; if you point CSWORK_BASE_URL elsewhere, it must be HTTPS unless it is localhost.',
              )}
            </li>
          </ul>
        </section>
      </main>
      <footer className="public-library-footer">
        <a href="/library">{say('公开面试资料', 'Interview resources')}</a>
        <a href="/privacy">{say('隐私说明', 'Privacy')}</a>
      </footer>
    </div>
  );
}
