import '../library/library.css';
import Link from 'next/link';
import { Suspense } from 'react';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { ojStatus } from '@/lib/server/oj-submissions';
import { LibraryPageView } from '../library/page-view';

// The image's toolchains (deploy/oj/Dockerfile, docs/oj-runtime.md) while the worker reports none.
const BASELINE: Record<string, string> = { cpp: 'g++ 14', java: 'OpenJDK 21', python: 'Python 3.13', go: 'Go 1.24' };

export async function generateMetadata() {
  const zh = (await requestLocale()) === 'zh';
  return seoMetadata({
    title: zh
      ? '判题环境：语言版本、编译命令与时间内存限制 · cswork'
      : 'Judge environment: language versions, compile commands and limits · cswork',
    description: zh
      ? 'CSWork 判题机上 C++、Java、Python、Go 的版本和编译运行命令，时间、内存与递归深度限制，ACM 与 LeetCode 两种模式的输入输出约定，以及和 HackerRank、CodeSignal、LeetCode 公开设置的对照。'
      : 'The C++, Java, Python and Go versions and commands on the CSWork judge, its time, memory and recursion limits, the input/output rules of ACM and LeetCode modes, and how they compare with what HackerRank, CodeSignal and LeetCode publish.',
    path: '/judge-environment',
  });
}

/** /judge-environment: what the judge runs, Kattis-style; versions come live from the worker's heartbeat. */
export default async function JudgeEnvironmentPage() {
  const zh = (await requestLocale()) === 'zh';
  const L = (zhText: string, en: string) => (zh ? zhText : en);
  const live: Record<string, string | undefined> = ojStatus().languageVersions;
  const version = (id: string) => live[id] || BASELINE[id];
  const languages = [
    ['C++', 'cpp', 'g++ -std=c++20 -O2 -pipe main.cpp -o main', './main'],
    ['Java', 'java', 'javac -encoding UTF-8 Main.java', L('java -Xmx<内存限制的 60%> -Xss64m -XX:ReservedCodeCacheSize=32m -XX:MaxMetaspaceSize=64m -XX:ActiveProcessorCount=1 -cp main.jar Main', 'java -Xmx<60% of the memory limit> -Xss64m -XX:ReservedCodeCacheSize=32m -XX:MaxMetaspaceSize=64m -XX:ActiveProcessorCount=1 -cp main.jar Main')],
    ['Python 3', 'python', L('py_compile（只检查语法）', 'py_compile (syntax check only)'), 'python3 -I main.py'],
    ['Go', 'go', 'go build -trimpath -o main main.go', './main'],
  ];
  // Only what each platform's public documentation states (checked October 2026); — where we found nothing.
  const compared = [
    [
      L('时间限制', 'Time limit'),
      L('每道题一个 CPU 时限，四种语言相同', 'One CPU limit per problem, the same for all four languages'),
      L('按语言固定：C++ 2 秒，Java 4 秒，Python 3 10 秒，Go 4 秒', 'Fixed per language: C++ 2 s, Java 4 s, Python 3 10 s, Go 4 s'),
      L('可以按题、按语言单独设置；文档没有列出默认值', 'Can be set per task and per language; the docs list no defaults'),
      '—',
    ],
    [
      L('内存限制', 'Memory limit'),
      L('每道题单独设，多数 256 MB', 'Set per problem, mostly 256 MB'),
      L('C++、Python 3：512 MB；Java 21、Go：2048 MB', 'C++, Python 3: 512 MB; Java 21, Go: 2048 MB'),
      '—',
      '—',
    ],
    [
      'C++',
      'g++ 14, C++20, -O2',
      L('g++ 8.3（C++11、C++14、C++20），g++ 14.2（C++23）', 'g++ 8.3 (C++11, C++14, C++20); g++ 14.2 (C++23)'),
      '—',
      L('clang，C++23，-O2', 'clang, C++23, -O2'),
    ],
    [
      L('Python 第三方包', 'Python packages'),
      'numpy, pandas',
      L('标准环境列出 requests 等，ML 环境另有 numpy、pandas；列表里没有 sortedcontainers', 'The standard list has requests and similar; the ML one adds numpy and pandas; neither lists sortedcontainers'),
      '—',
      '—',
    ],
  ];
  return (
    <div className="public-library" lang={zh ? 'zh-CN' : 'en'}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: L('判题环境', 'Judge environment'), path: '/judge-environment' },
          ]),
        }}
      />
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / {L('判题环境', 'judge')}</span>
        </Link>
        <Link href="/?view=problems" prefetch={false}>
          {L('去题库练习', 'Practice')} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        <article className="public-library-article">
          <header className="public-library-article-header">
            <p className="public-library-eyebrow">JUDGE ENVIRONMENT</p>
            <h1>{L('判题环境说明', 'Judge environment')}</h1>
            <p>
              {L(
                '你的代码在什么环境里编译和运行：语言版本、编译和运行命令、时间和内存怎么算、递归能多深，以及两种提交模式各自怎么读写数据。最后一节对照了几个常见 OA 平台公开的设置。',
                'Where your code is compiled and run: language versions, the compile and run commands, how time and memory are measured, how deep recursion can go, and how each submission mode reads and writes data. The last section compares the settings that common OA platforms publish.',
              )}
            </p>
          </header>
          <div className="public-library-prose">
            <h2>{L('语言、版本和命令', 'Languages, versions and commands')}</h2>
            <table>
              <thead>
                <tr>
                  <th scope="col">{L('语言', 'Language')}</th>
                  <th scope="col">{L('版本', 'Version')}</th>
                  <th scope="col">{L('编译', 'Compile')}</th>
                  <th scope="col">{L('运行', 'Run')}</th>
                </tr>
              </thead>
              <tbody>
                {languages.map(([name, id, build, run]) => (
                  <tr key={id}>
                    <th scope="row">{name}</th>
                    <td>{version(id)}</td>
                    <td>
                      <code>{build}</code>
                    </td>
                    <td>
                      <code>{run}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul>
              <li>
                {L(
                  '版本一栏是判题机最近一次报告的版本；尚未报告时显示镜像里的大版本。',
                  'The version column is what the judge last reported; before it has reported, the image’s major versions show.',
                )}
              </li>
              <li>
                {L(
                  'C++：可以直接 #include <bits/stdc++.h>（已预编译，编译更快）；多线程不用加 -pthread。没有开 AddressSanitizer，数组越界不一定当场报错。',
                  'C++: #include <bits/stdc++.h> works and is precompiled, so it compiles faster; threads need no -pthread. AddressSanitizer is off, so an out-of-bounds access may not fail on the spot.',
                )}
              </li>
              <li>
                {L(
                  'Java：public 类必须叫 Main，内部类可以正常使用。',
                  'Java: the public class must be named Main; inner classes work as usual.',
                )}
              </li>
              <li>
                {L(
                  'Python：标准库之外装了 numpy 和 pandas（以及它们依赖的包），没有 sortedcontainers；需要有序集合时用 bisect 或自己实现。',
                  'Python: besides the standard library, numpy and pandas (with their dependencies) are installed, but not sortedcontainers; use bisect or write your own ordered structure.',
                )}
              </li>
              <li>
                {L(
                  'Go：只能用标准库，不能下载模块。',
                  'Go: standard library only; modules cannot be downloaded.',
                )}
              </li>
              <li>{L('运行时没有网络。', 'There is no network access while your code runs.')}</li>
            </ul>

            <h2 id="limits">{L('时间和内存', 'Time and memory')}</h2>
            <ul>
              <li>
                {L(
                  '时间限制是每个测试点的 CPU 时间，显示在题面上方。四种语言用同一个时限，不按语言放大；少数题给某种语言单独设了时限（比如 pandas 题），题面显示的是你当前所选语言的那个。',
                  'The time limit is CPU time per test case, shown above the statement. All four languages share one limit, with no per-language multiplier; a few problems set their own limit for one language (pandas problems, for example), and the statement shows the one for the language you picked.',
                )}
              </li>
              <li>
                {L(
                  '墙钟时间上限是 CPU 时限的 3 倍，至少 3 秒；程序卡在等待输入或 sleep 也会超时。',
                  'Wall-clock time is capped at 3 times the CPU limit, at least 3 seconds, so a program stuck waiting for input or sleeping also times out.',
                )}
              </li>
              <li>
                {L(
                  '内存按进程实际占用计算，多数题 256 MB。Java 的堆上限取内存限制的 60%，剩下的留给 JVM 自身。',
                  'Memory counts what the process actually uses, 256 MB on most problems. Java’s heap is capped at 60% of the limit, leaving the rest to the JVM itself.',
                )}
              </li>
              <li>
                {L(
                  '进程和线程合计最多 64 个；标准错误最多保留 64 KB。编译最多用 30 秒 CPU 时间和 1 GB 内存。',
                  'At most 64 processes and threads in total; up to 64 KB of stderr is kept. Compiling may use up to 30 seconds of CPU time and 1 GB of memory.',
                )}
              </li>
            </ul>

            <h2 id="recursion">{L('递归深度和栈', 'Recursion depth and stack')}</h2>
            <ul>
              <li>
                {L(
                  'C++、Go 的可执行文件用系统默认栈，我们没有另外调大（Linux 通常是 8 MB）。C++ 递归到 10⁵ 层已经比较紧，每层局部变量多时可能栈溢出，报运行错误；深度可能超过 10⁵ 时建议改成迭代，大数组放到全局。Go 的 goroutine 栈会自动增长，一般不受这个限制，但占用计入内存。',
                  'C++ and Go binaries run on the default system stack, which we do not raise (usually 8 MB on Linux). C++ recursion 10⁵ levels deep is already tight and can overflow into a runtime error when each level holds many locals; past 10⁵, go iterative and keep big arrays global. Go grows goroutine stacks on its own, so this limit rarely applies, but the stack counts toward memory.',
                )}
              </li>
              <li>
                {L(
                  'Java：线程栈 64 MB（-Xss64m，与 Codeforces 相同），10⁵ 层的树递归可以正常跑完。',
                  'Java: a 64 MB thread stack (-Xss64m, as on Codeforces); tree recursion 10⁵ levels deep runs fine.',
                )}
              </li>
              <li>
                {L(
                  'Python（ACM 模式）：代码原样运行，递归上限是默认的 1000 层，深递归要先写 sys.setrecursionlimit(10**6)。即使调高了上限，经过 C 实现的调用（@cache、lru_cache、max(f(x) for …)、map、sorted 的 key 函数）递归大约 3000 到 5000 层仍会报 RecursionError，这时改成迭代或用字典手动记忆化。',
                  'Python (ACM mode): your code runs as written with the default limit of 1000 levels, so deep recursion needs sys.setrecursionlimit(10**6) first. Even then, recursion that passes through C-implemented calls (@cache, lru_cache, max(f(x) for …), map, a sorted key function) stops at roughly 3,000 to 5,000 levels with RecursionError; switch to a loop or memoize with a dict.',
                )}
              </li>
              <li>
                {L(
                  'Python（LeetCode 模式）：递归上限已设为 10⁶，常用模块已自动导入；@cache、lru_cache 和 min/max/sum/any/all 换成了不受上面那个限制的版本，10⁵ 层可以通过。map、sorted 回调等其他 C 调用仍是约 5000 层。',
                  'Python (LeetCode mode): the recursion limit is already 10⁶ and the common modules are imported for you; @cache, lru_cache and min/max/sum/any/all are swapped for versions without the limit above, so 10⁵ levels pass. Other C calls such as map or a sorted callback still stop near 5,000.',
                )}
              </li>
            </ul>

            <h2 id="io">{L('两种模式的输入输出', 'Input and output in each mode')}</h2>
            <h3>{L('ACM 模式', 'ACM mode')}</h3>
            <ul>
              <li>
                {L(
                  '写完整程序：从标准输入读，向标准输出写。常见输入形态的读写模板见',
                  'Write a whole program that reads stdin and writes stdout. Templates for the common input shapes are in',
                )}{' '}
                <Link href="/acm-io" prefetch={false}>
                  {L('ACM 输入输出模板', 'ACM I/O templates')}
                </Link>
                {L('。', '.')}
              </li>
              <li>
                {L(
                  '多数题把输出按空白切成一个个词逐个比较，行尾空格和多余空行不影响结果；少数题逐字比较，只把 \\r\\n 当成 \\n；有多个正确答案的题用专门的检查程序。',
                  'Most problems split the output on whitespace and compare word by word, so trailing spaces and extra blank lines do not matter; a few compare exactly, treating \\r\\n as \\n; problems with several right answers use their own checker.',
                )}
              </li>
              <li>{L('写到标准错误的内容不参与判题。', 'Whatever goes to stderr is not judged.')}</li>
              <li>
                {L(
                  "输入超过约 10⁵ 行或 10⁵ 个数时，读写方式可能决定会不会超时：Python 用 sys.stdin.readline，或一次 sys.stdin.read().split() 读完；C++ 先写 ios::sync_with_stdio(false); cin.tie(nullptr);，换行输出 '\\n' 而不是 endl；Java 用 BufferedReader 代替 Scanner；Go 用 bufio 包装标准输入和输出。",
                  "Past about 10⁵ lines or numbers of input, how you read and write can decide a time limit: in Python use sys.stdin.readline or read it all with sys.stdin.read().split(); in C++ start with ios::sync_with_stdio(false); cin.tie(nullptr); and print '\\n' rather than endl; in Java use BufferedReader instead of Scanner; in Go wrap stdin and stdout in bufio.",
                )}
              </li>
            </ul>
            <h3>{L('LeetCode 模式', 'LeetCode mode')}</h3>
            <ul>
              <li>
                {L(
                  '只写 Solution 类（设计题写题目要求的类），读入、调用和输出由判题程序完成。',
                  'Write only the Solution class (or the class a design problem asks for); the judge reads the input, calls it and prints the result.',
                )}
              </li>
              <li>
                {L(
                  '自定义输入按参数顺序每行一个 JSON 值，树和链表用原题的数组写法。设计题第一行是操作名数组，第二行是对应的参数数组。',
                  'Custom input is one JSON value per line in parameter order, with trees and linked lists in the original array form. For a design problem, line 1 is the array of operation names and line 2 the array of their arguments.',
                )}
              </li>
              <li>
                {L(
                  '你自己 print 的内容会出现在「标准错误」里，方便调试，不影响判题。',
                  'Anything you print shows up under Stderr for debugging and does not affect the verdict.',
                )}
              </li>
            </ul>

            <h2>{L('隐藏测试点', 'Hidden test cases')}</h2>
            <ul>
              <li>
                {L(
                  '练习时，正式提交会跑全部测试点，遇到第一个失败的就停下，并给出它的输入、期望输出和你的输出（太长会截断）。',
                  'In practice, a submission runs every test case and stops at the first failure, showing its input, expected output and your output (cut short when long).',
                )}
              </li>
              <li>
                {L(
                  '模拟 OA 里，隐藏测试点只显示判定结果和用时、内存，和真实 OA 一样，反例要自己想。',
                  'In a mock OA, a hidden case shows only its verdict, time and memory, as in a real OA: finding the counterexample is up to you.',
                )}
              </li>
              <li>
                {L(
                  '比赛和技能考试进行中，服务器对隐藏测试点只返回判定结果，不返回输入和输出。',
                  'During a contest or skill exam, the server returns only the verdict of a hidden case, never its input or output.',
                )}
              </li>
            </ul>

            <h2>{L('和常见平台对照', 'Compared with other platforms')}</h2>
            <p>
              {L(
                '只列各平台公开文档里写明的内容，查阅于 2026 年 10 月，平台可能已有更新；“—”表示我们没在其公开文档里找到。真实 OA 的时限和内存以题面为准。',
                'Only what each platform’s public documentation states, checked in October 2026; it may have changed since. “—” means we found nothing in its public docs. In a real OA, the task’s own statement wins.',
              )}
            </p>
            <table>
              <thead>
                <tr>
                  <th scope="col">{L('项目', 'Setting')}</th>
                  <th scope="col">CSWork</th>
                  <th scope="col">HackerRank</th>
                  <th scope="col">CodeSignal</th>
                  <th scope="col">LeetCode</th>
                </tr>
              </thead>
              <tbody>
                {compared.map(([setting, ...cells]) => (
                  <tr key={setting}>
                    <th scope="row">{setting}</th>
                    {cells.map((cell, i) => (
                      <td key={i}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              {L('来源：', 'Sources: ')}
              <a href="https://support.hackerrank.com/hc/en-us/articles/6693750503-Execution-Environment" rel="noopener noreferrer">
                HackerRank Execution Environment
              </a>
              {L('；', '; ')}
              <a href="https://developer.codesignal.com/graphql/types/createstandardtaskinput.doc.html" rel="noopener noreferrer">
                CodeSignal API: task time limits
              </a>
              {L('；', '; ')}
              <a
                href="https://support.leetcode.com/hc/en-us/articles/360011833974-What-are-the-environments-for-the-programming-languages"
                rel="noopener noreferrer"
              >
                LeetCode: environments for the programming languages
              </a>
              {L('。', '.')}
            </p>
            <p>
              {L('各平台的计分、重交、编辑器和监考规则，见', 'Scoring, resubmission, editor and proctoring rules per platform are on the')}{' '}
              <Link href="/interview-platforms" prefetch={false}>
                {L('面试平台规则对照', 'interview platform rules page')}
              </Link>
              {L('。', '.')}
            </p>
          </div>
        </article>
      </main>
      <footer className="public-library-footer">
        <Link href="/acm-io" prefetch={false}>
          {L('ACM 输入输出模板', 'ACM I/O templates')}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {L('隐私', 'Privacy')}
        </Link>
      </footer>
      <Suspense fallback={null}>
        <LibraryPageView />
      </Suspense>
    </div>
  );
}
