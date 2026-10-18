import '../../algorithm-demo.css';
import Link from 'next/link';
import { AlgorithmDemo } from '@/components/algorithm-demo';
import { simKinds, type SimKind } from '@/lib/cs-sims';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';

const SECTIONS: Record<SimKind, { zh: [string, string]; en: [string, string] }> = {
  'cpu-scheduling': {
    zh: [
      'CPU 调度：画甘特图，算平均等待时间',
      'OA 常给三五个进程的到达时间和运行时间，问某种调度算法下的平均等待或周转时间。在输入框里换算法（fcfs、sjf、srtf、rr 加时间片、prio、prio-p）或换进程，逐段看为什么轮到这个进程。',
    ],
    en: [
      'CPU scheduling: draw the Gantt chart, average the waits',
      'OA questions give three to five processes with arrival and burst times and ask for the average waiting or turnaround time under one policy. Change the policy (fcfs, sjf, srtf, rr plus a quantum, prio, prio-p) or the processes, and see stretch by stretch why each process gets the CPU.',
    ],
  },
  'page-replacement': {
    zh: [
      '页面置换：数缺页次数',
      '默认的访问序列用 FIFO 时，3 个页框缺页 9 次，4 个页框反而缺页 10 次，这就是 Belady 异常。换成 lru、opt 或 clock 对比；最后一步列出四种算法的缺页数和 1 到 7 个页框的缺页曲线。',
    ],
    en: [
      'Page replacement: count the faults',
      'With the default reference string, FIFO faults 9 times with 3 frames and 10 times with 4: Belady’s anomaly. Switch to lru, opt or clock to compare; the last step lists all four algorithms’ faults and the fault curve for 1 to 7 frames.',
    ],
  },
  bankers: {
    zh: [
      '银行家算法：找安全序列',
      '先算 Need = Max − Allocation，再用 Work 一轮轮找能运行完的进程。带上请求（如 P1 1 0 2）时，先检查它是否超过 Need 和 Available，再试分配并做安全检查。',
    ],
    en: [
      'Banker’s algorithm: find a safe sequence',
      'Work out Need = Max − Allocation, then use Work to find, round by round, a process that can finish. With a request such as P1 1 0 2, it is first checked against Need and Available, then granted on trial and checked for safety.',
    ],
  },
  'tcp-handshake': {
    zh: [
      'TCP 三次握手与四次挥手',
      '每一步的 seq、ack 和两端状态都画在时序图上。场景可以换成 syn-loss（第一个 SYN 丢失后重传）或 simul-close（双方同时关闭，经过 CLOSING）。',
    ],
    en: [
      'TCP three-way handshake and four-way close',
      'Every step’s seq, ack and both states sit on the sequence diagram. Try syn-loss (the first SYN is lost and resent) or simul-close (both sides close at once and pass through CLOSING).',
    ],
  },
  'tcp-congestion': {
    zh: [
      '拥塞控制：cwnd 曲线',
      '给出初始 ssthresh、轮数，以及哪一轮超时（timeout）或收到 3 个重复 ACK（dup），逐轮算出 cwnd。Reno 收到 3 个重复 ACK 时，这里按国内教材的简化把 cwnd 设为新的 ssthresh；RFC 5681 的快恢复先设为 ssthresh + 3。',
    ],
    en: [
      'Congestion control: the cwnd curve',
      'Give the initial ssthresh, the number of rounds and the rounds with a timeout or three duplicate ACKs (dup), and get cwnd round by round. On three duplicate ACKs, Reno here sets cwnd to the new ssthresh, the common textbook shortcut; RFC 5681’s fast recovery starts at ssthresh + 3.',
    ],
  },
  'sliding-window-arq': {
    zh: [
      '滑动窗口：GBN 与 SR',
      '同样丢一个分组，回退 N 步（GBN）要从丢失的分组起全部重传，选择重传（SR）只重传那一个。把第一段改成 sr，对比两者的发送次数。在 TCP 里，这个窗口取接收方通告的接收窗口（流量控制）和拥塞窗口（拥塞控制）中较小的一个。',
    ],
    en: [
      'Sliding window: Go-Back-N and Selective Repeat',
      'Lose the same packet: Go-Back-N resends everything from it, Selective Repeat resends only that one. Change the first part to sr and compare the number of sends. In TCP this window is the smaller of the receiver’s advertised window (flow control) and the congestion window (congestion control).',
    ],
  },
};

function copy(zh: boolean) {
  return zh
    ? {
        title: 'OS 与网络模拟器：CPU 调度、页面置换、银行家算法、TCP 握手、拥塞控制、滑动窗口 | CSWork',
        lead: 'OA 的 CS 选择题常要手算：平均等待时间、缺页次数、安全序列、cwnd、握手时的 seq 和 ack。这六个模拟器一步一步算给你看，每个都能换成题目里的数据，用来核对你的手算。',
      }
    : {
        title: 'OS and Networking Simulators: CPU Scheduling, Page Replacement, Banker’s Algorithm, TCP | CSWork',
        lead: 'OA multiple choice often needs arithmetic by hand: average waiting time, page faults, a safe sequence, cwnd, the seq and ack of a handshake. These six simulators work it out step by step, and each takes the numbers from your question so you can check your own working.',
      };
}

export async function generateMetadata() {
  const { title, lead } = copy((await requestLocale()) === 'zh');
  return seoMetadata({ title, description: lead, path: '/oa/sims' });
}

export default async function OaSimsPage() {
  const zh = (await requestLocale()) === 'zh';
  const { lead } = copy(zh);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: 'OA', path: '/oa' },
            { name: zh ? '模拟器' : 'Simulators', path: '/oa/sims' },
          ]),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/oa" prefetch={false}>
          OA
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '操作系统与网络模拟器' : 'OS and networking simulators'}</span>
      </nav>
      <div className="public-library-intro">
        <p className="public-library-eyebrow">{zh ? 'OA 计算题 · 逐步模拟' : 'OA ARITHMETIC · STEP BY STEP'}</p>
        <h1>{zh ? '手算题，先让模拟器走一遍。' : 'Work it by hand, then step through it.'}</h1>
        <p>{lead}</p>
      </div>
      <div className="public-library-prose">
        <nav aria-label={zh ? '本页目录' : 'On this page'}>
          <ol>
            {simKinds.map((kind) => (
              <li key={kind}>
                <a href={`#${kind}`}>{SECTIONS[kind][zh ? 'zh' : 'en'][0]}</a>
              </li>
            ))}
          </ol>
          <p>
            {zh ? '算完想练题：' : 'Ready for questions? '}
            <Link href="/oa/mcq?topic=os" prefetch={false}>
              {zh ? '操作系统选择题' : 'OS multiple choice'}
            </Link>
            {zh ? '、' : ', '}
            <Link href="/oa/mcq?topic=network" prefetch={false}>
              {zh ? '网络选择题' : 'networking multiple choice'}
            </Link>
            {zh ? '。' : '.'}
          </p>
          <p>
            {zh ? '想从头学：' : 'Learning it from the start? '}
            <Link href="/learn/os" prefetch={false}>
              {zh ? '操作系统图解课' : 'Operating Systems, Illustrated'}
            </Link>
            {zh ? '、' : ', '}
            <Link href="/learn/network" prefetch={false}>
              {zh ? '计算机网络图解课' : 'Computer Networking, Illustrated'}
            </Link>
            {zh ? '。' : '.'}
          </p>
        </nav>
        {simKinds.map((kind) => {
          const [heading, body] = SECTIONS[kind][zh ? 'zh' : 'en'];
          return (
            <section key={kind} id={kind} aria-labelledby={`${kind}-title`}>
              <h2 id={`${kind}-title`}>{heading}</h2>
              <p>{body}</p>
              <AlgorithmDemo kind={kind} />
            </section>
          );
        })}
      </div>
    </>
  );
}
