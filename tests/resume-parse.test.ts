// The builder's paste import (lib/resume-parse.ts): an English and a Chinese resume copied out of
// a PDF come back as the builder's sections, with dates, bullets (wrapped lines joined) and the
// contact line split into its fields; text without headings keeps only what it can place.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResumeText } from '../lib/resume-parse';
import { checkResume } from '../lib/resume-check';
import { normalizeResume } from '../components/resume-builder';

const english = `Ada Lovelace
ada@example.com | (555) 123-4567 | Seattle, WA | github.com/ada | linkedin.com/in/ada

SUMMARY
Backend engineer who likes queues.

EDUCATION
University of Washington | B.S. Computer Science | Sep 2022 – Jun 2026
• GPA 3.9/4.0; Coursework: Algorithms, Operating Systems

WORK EXPERIENCE
Acme Corp                Jun 2025 – Sep 2025
Software Engineer Intern, Seattle
• Built a Redis cache in front of the search API, cutting p99 latency from 420 ms to 180 ms
• Led the migration of 14 cron jobs to Kubernetes, removing 3 hours of weekly
  on-call toil
Beta Labs | Research Assistant | Jan 2024 - Present
* Train ranking models in PyTorch on 2M query logs

Projects:
Tiny Raft — Go, gRPC        Summer 2024
- Implemented leader election and log replication; passes 300 randomized partition tests

Technical Skills
Languages: Python, Go, Java, SQL
Tools: Docker, Kubernetes, PostgreSQL

Awards & Honors
ICPC Regional, Silver Medal (2024)`;

const chinese = `张三
电话：138 0013 8000 ｜ 邮箱：zhangsan@example.com ｜ 北京
github.com/zhangsan

教育背景
清华大学 ｜ 计算机科学与技术 本科 ｜ 2021.09-2025.06
• GPA 3.8/4.0，排名前 10%

实习经历
字节跳动 ｜ 后端开发实习生 ｜ 2024/06 - 2024/09
• 使用 Go 重写特征拼接模块，P99 延迟从 80ms 降到 35ms，节省 120 台机器
• 设计灰度发布脚本，覆盖 30 个服务
项目经历
分布式 KV 存储 ｜ 2023年3月 - 至今
▪ 基于 Raft 实现多副本 KV，支持线性一致读，通过 500 次随机故障测试

专业技能
编程语言：Go、Python、C++
获奖
2023 ACM-ICPC 亚洲区域赛银奖`;

void test('an English resume: contact fields, sections, date ranges, bullets and wrapped lines', () => {
  const r = parseResumeText(english);
  assert.deepEqual(
    [r.name, r.email, r.phone, r.location, r.links],
    ['Ada Lovelace', 'ada@example.com', '(555) 123-4567', 'Seattle, WA', 'github.com/ada, linkedin.com/in/ada'],
  );
  assert.deepEqual(r.education, [
    { title: 'University of Washington', subtitle: 'B.S. Computer Science', dates: 'Sep 2022 – Jun 2026', bullets: 'GPA 3.9/4.0; Coursework: Algorithms, Operating Systems' },
  ]);
  assert.deepEqual(r.experience, [
    {
      title: 'Acme Corp',
      subtitle: 'Software Engineer Intern, Seattle',
      dates: 'Jun 2025 – Sep 2025',
      bullets:
        'Built a Redis cache in front of the search API, cutting p99 latency from 420 ms to 180 ms\nLed the migration of 14 cron jobs to Kubernetes, removing 3 hours of weekly on-call toil',
    },
    { title: 'Beta Labs', subtitle: 'Research Assistant', dates: 'Jan 2024 - Present', bullets: 'Train ranking models in PyTorch on 2M query logs' },
  ]);
  assert.deepEqual(r.projects, [
    { title: 'Tiny Raft', subtitle: 'Go, gRPC', dates: 'Summer 2024', bullets: 'Implemented leader election and log replication; passes 300 randomized partition tests' },
  ]);
  assert.equal(r.skills, 'Languages: Python, Go, Java, SQL\nTools: Docker, Kubernetes, PostgreSQL');
  assert.equal(r.awards, 'ICPC Regional, Silver Medal (2024)');
  // The summary has no place in the builder: dropped, not stuck onto another section.
  assert.ok(!JSON.stringify(r).includes('queues'));
  // What the import hands the builder is already a resume it can keep as is.
  assert.deepEqual(normalizeResume(r), r);
  assert.ok(checkResume(r).score > 80);
});

void test('a Chinese resume: 中文标题, 2021.09-2025.06, 2024/06 - 2024/09, 2023年3月 - 至今', () => {
  const r = parseResumeText(chinese);
  assert.deepEqual([r.name, r.email, r.phone, r.location, r.links], ['张三', 'zhangsan@example.com', '138 0013 8000', '北京', 'github.com/zhangsan']);
  assert.deepEqual(r.education, [{ title: '清华大学', subtitle: '计算机科学与技术 本科', dates: '2021.09-2025.06', bullets: 'GPA 3.8/4.0，排名前 10%' }]);
  assert.deepEqual(r.experience, [
    {
      title: '字节跳动',
      subtitle: '后端开发实习生',
      dates: '2024/06 - 2024/09',
      bullets: '使用 Go 重写特征拼接模块，P99 延迟从 80ms 降到 35ms，节省 120 台机器\n设计灰度发布脚本，覆盖 30 个服务',
    },
  ]);
  assert.deepEqual(r.projects, [{ title: '分布式 KV 存储', subtitle: '', dates: '2023年3月 - 至今', bullets: '基于 Raft 实现多副本 KV，支持线性一致读，通过 500 次随机故障测试' }]);
  assert.equal(r.skills, '编程语言：Go、Python、C++');
  assert.equal(r.awards, '2023 ACM-ICPC 亚洲区域赛银奖');
});

void test('entries without bullet marks, a second dated line, and text with no headings', () => {
  const r = parseResumeText(`EXPERIENCE\nAcme | Intern | 2024\nShipped the billing page\nCut build time by 40%\nGlobex | Intern | 2023\nWrote the docs`);
  assert.deepEqual(
    r.experience.map((e) => [e.title, e.dates, e.bullets]),
    [
      ['Acme', '2024', 'Shipped the billing page\nCut build time by 40%'],
      ['Globex', '2023', 'Wrote the docs'],
    ],
  );
  // The builder's empty sections stay one blank entry each, as in a new resume.
  assert.deepEqual(r.education, [{ title: '', subtitle: '', dates: '', bullets: '' }]);
  const plain = parseResumeText('Grace Hopper\ngrace@example.com\nWrote the first compiler.');
  assert.deepEqual([plain.name, plain.email, plain.skills, plain.experience[0].title], ['Grace Hopper', 'grace@example.com', '', '']);
  assert.equal(parseResumeText('').name, '');
});

void test('wrapped bullets that go on with a number, a name or a Chinese character; research and other headings', () => {
  const r = parseResumeText(`EXPERIENCE
Acme | Intern | Jun 2025 – Sep 2025
• Built a Redis cache in front of the search API, cutting p99 from
420 ms to 180 ms across 3 services
• Moved 14 cron jobs to
Kubernetes on GKE
• 优化慢查询，使接口延迟降低
了百分之三十
• Wrote the runbook.
Globex Remote | 2024 – 2025
• Shipped billing
RESEARCH EXPERIENCE
MIT CSAIL | Research Assistant | 2024 – 2025
• Proposed a sharded index
科研经历
清华大学 ｜ 2023 – 2024
• 复现 3 篇论文
PUBLICATIONS
Lovelace, A. Notes on the Analytical Engine. 1843.`);
  assert.deepEqual(
    r.experience.map((e) => [e.title, e.dates, e.bullets]),
    [
      [
        'Acme',
        'Jun 2025 – Sep 2025',
        'Built a Redis cache in front of the search API, cutting p99 from 420 ms to 180 ms across 3 services\nMoved 14 cron jobs to Kubernetes on GKE\n优化慢查询，使接口延迟降低了百分之三十\nWrote the runbook.',
      ],
      ['Globex Remote', '2024 – 2025', 'Shipped billing'],
      ['MIT CSAIL', '2024 – 2025', 'Proposed a sharded index'],
      ['清华大学', '2023 – 2024', '复现 3 篇论文'],
    ],
  );
  // Publications have no section: dropped, not stuck onto the last entry.
  assert.ok(!JSON.stringify(r).includes('Analytical'));
  // "Activities:" inside an education entry is its text, not a heading.
  const e = parseResumeText('EDUCATION\nMIT | B.S. | 2022 – 2026\n• Activities: ACM club, robotics\nLEADERSHIP\nACM Club | President | 2024 – 2025\n• Ran 12 workshops');
  assert.equal(e.education[0].bullets, 'Activities: ACM club, robotics');
  assert.deepEqual(e.experience.map((x) => x.title), ['ACM Club']);
});
