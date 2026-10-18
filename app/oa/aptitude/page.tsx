import { headers } from 'next/headers';
import Link from 'next/link';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { AptitudePractice } from './practice';

function copy(zh: boolean) {
  return zh
    ? {
        title: '能力测评练习：百分比、利润、速度、图表、数列、三段论、排座、图形推理与 15 分钟速度测验 | CSWork',
        lead: '有些公司的 OA 在编程题之外还有能力测评（aptitude）。这里练三类题：数量计算和图表读数（百分比、利润与折扣、比例与混合、工作效率、速度、利息、柱状图），逻辑推理（数列、字母编码、三段论、排座、方向），图形推理（3×3 矩阵、旋转、镜像）。题目全部由程序按规则现场生成：先定答案，再反推题目里的数字，每题附解析和用到的公式。答错的题进入选择题复习，按 1、3、7、21 天回来。另有 50 题 15 分钟的速度测验：做完不能回头，可选倒扣分，交卷后看每题用时。',
      }
    : {
        title: 'Aptitude Practice: Percentages, Speed, Charts, Series, Syllogisms, Seating, Figures and a 15-Minute Speed Test | CSWork',
        lead: 'Some company OAs add an aptitude test to the coding. Practise all three parts here: numerical and data (percentages, profit and discount, ratios and mixtures, work and pipes, speed, interest, bar charts), logical (number series, letter codes, syllogisms, seating, directions) and abstract (3×3 figure matrices, rotation, mirror images). Every question is generated on the spot from rules, with the answer fixed first and the numbers worked back from it, and comes with an explanation and the formula it uses. Missed questions join your multiple-choice review and return after 1, 3, 7 and 21 days. There is also a 50-question, 15-minute speed test: no going back, optional negative marking, and your time on every question afterwards.',
      };
}

/** The formula sheet: [zh title, en title, zh, en]. */
const FORMULAS: [string, string, string, string][] = [
  ['连续百分比变化', 'Successive percentage changes', '先变 a% 再变 b%：总变化 = a + b + ab/100（下降时取负）。例：+20% 再 −10% = +8%。', 'A change of a% then b%: overall a + b + ab/100 (negative for a fall). Example: +20% then −10% = +8%.'],
  [
    '换了基准',
    'A different base',
    'A 比 B 多 x%，B 就比 A 少 x/(100 + x) × 100%；A 比 B 少 y%，B 就比 A 多 y/(100 − y) × 100%。价格涨 x%、开支不变，用量要减 x/(100 + x) × 100%。',
    'If A is x% more than B, B is x/(100 + x) × 100% less than A; if A is y% less than B, B is y/(100 − y) × 100% more. If a price rises x% and spending stays the same, the amount bought falls by x/(100 + x) × 100%.',
  ],
  [
    '利润与折扣',
    'Profit and discount',
    '利润率 = (售价 − 成本) ÷ 成本 × 100%；售价 = 成本 × (1 + 利润率)；按标价优惠 d%：售价 = 标价 × (1 − d%)。先加价 m% 再优惠 d%：总盈亏 = (1 + m%)(1 − d%) − 1。',
    'Profit % = (selling price − cost) ÷ cost × 100; selling price = cost × (1 + profit %); d% off the marked price: selling price = marked × (1 − d%). Marked up m% then d% off: (1 + m%)(1 − d%) − 1 overall.',
  ],
  ['比例与混合', 'Ratios and mixtures', '按 a : b : c 分 N：每份 N ÷ (a + b + c)。十字交叉法：便宜的 : 贵的 = (贵价 − 均价) : (均价 − 便宜价)。', 'Sharing N in the ratio a : b : c: one part is N ÷ (a + b + c). Alligation: cheaper : dearer = (dear − mean) : (mean − cheap).'],
  ['工作效率', 'Work and pipes', '效率 = 1 ÷ 单独完成的时间，合作时效率相加：合作时间 = ab/(a + b)。一进一出（b 小时排空）：注满时间 = ab/(b − a)。', 'Rate = 1 ÷ time alone, and rates add: together = ab/(a + b). One pipe fills in a, another empties in b: full in ab/(b − a).'],
  [
    '速度与相对速度',
    'Speed and relative speed',
    '千米/时 × 5/18 = 米/秒。相向而行相对速度 = v₁ + v₂，同向 = v₁ − v₂。火车过站台的路程 = 车长 + 站台长。等距往返的平均速度 = 2xy/(x + y)。顺流 = 船速 + 水速，逆流 = 船速 − 水速。',
    'km/h × 5/18 = m/s. Towards each other the relative speed is v₁ + v₂, same way v₁ − v₂. Passing a platform, a train covers its length plus the platform’s. Average speed over equal distances = 2xy/(x + y). Downstream = boat + current, upstream = boat − current.',
  ],
  ['单利与复利', 'Simple and compound interest', '单利 I = P × r × t；复利本息 A = P(1 + r)ⁿ；两年期复利 − 单利 = P × r²。单利下翻倍要 100/r 年。', 'Simple interest I = P × r × t; compound amount A = P(1 + r)ⁿ; over 2 years compound − simple = P × r². At simple interest a sum doubles in 100/r years.'],
  [
    '数列',
    'Number series',
    '等差：aₙ = a₁ + (n − 1)d，Sₙ = n(a₁ + aₙ)/2；等比：aₙ = a₁qⁿ⁻¹，Sₙ = a₁(qⁿ − 1)/(q − 1)。看不出规律时，先写出相邻两项的差（或比），再看奇数位和偶数位是不是两个数列。',
    'Arithmetic: aₙ = a₁ + (n − 1)d, Sₙ = n(a₁ + aₙ)/2; geometric: aₙ = a₁qⁿ⁻¹, Sₙ = a₁(qⁿ − 1)/(q − 1). Stuck? Write down the gaps (or ratios) between terms, then check whether odd and even places form two series.',
  ],
  [
    '三段论',
    'Syllogisms',
    '默认每类至少有一个。两个前提都是「有些」，或都是否定句，推不出结论；有一个前提是否定句，结论只能是否定句；有一个前提是「有些」，结论只能是「有些」。「没有 A 是 B」等于「没有 B 是 A」，「有些 A 是 B」等于「有些 B 是 A」，「所有 A 都是 B」能推出「有些 B 是 A」。',
    'Assume every group has members. Two “some” premises, or two negative ones, give no conclusion; a negative premise allows only a negative conclusion; a “some” premise allows only a “some” conclusion. “No A are B” equals “No B are A”, “Some A are B” equals “Some B are A”, and “All A are B” gives “Some B are A”.',
  ],
  ['方向与勾股数', 'Directions and Pythagorean triples', '右转 = 顺时针 90°，左转 = 逆时针 90°。先分别算东西和南北的净移动，再求 √(x² + y²)。常见勾股数：3-4-5、5-12-13、8-15-17、7-24-25，以及它们的倍数（6-8-10、9-12-15）。', 'Right = 90° clockwise, left = 90° anticlockwise. Add up east–west and north–south separately, then take √(x² + y²). Common triples: 3-4-5, 5-12-13, 8-15-17, 7-24-25 and their multiples (6-8-10, 9-12-15).'],
  ['图形推理', 'Figures', '矩阵题一次只看一个属性（形状、数量、颜色、方向），每个属性通常是「每行一种」「每列一种」或「每行每列各一次」。镜像会把图形翻面，单靠旋转得不到；竖着的镜子左右对调，平放的镜子上下对调。', 'In a matrix look at one attribute at a time (shape, count, shading, rotation); each is usually one per row, one per column, or once in every row and column. A mirror image turns the figure over, which no rotation can do; an upright mirror swaps left and right, a flat one top and bottom.'],
];

export async function generateMetadata() {
  const { title, lead } = copy((await requestLocale()) === 'zh');
  return seoMetadata({ title, description: lead, path: '/oa/aptitude' });
}

export default async function OaAptitudePage() {
  const zh = (await requestLocale()) === 'zh';
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: 'OA', path: '/oa' },
            { name: zh ? '能力测评' : 'Aptitude', path: '/oa/aptitude' },
          ]),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/oa" prefetch={false}>
          OA
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '能力测评' : 'Aptitude'}</span>
      </nav>
      <div className="public-library-intro">
        <p className="public-library-eyebrow">{zh ? 'OA 能力测评 · 题目现场生成' : 'OA APTITUDE · FRESHLY GENERATED'}</p>
        <h1>{zh ? '数量、逻辑、图形，外加一场 15 分钟速度测验。' : 'Numbers, logic and figures, plus a 15-minute speed test.'}</h1>
        <p>
          {copy(zh).lead}
          {zh ? '读代码和 CS 基础选择题在' : ' Code-reading and CS fundamentals questions are in '}
          <Link href="/oa/mcq" prefetch={false}>
            {zh ? 'OA 选择题练习' : 'OA multiple-choice practice'}
          </Link>
          {zh ? '。' : '.'}
        </p>
      </div>
      <AptitudePractice zh={zh} viewer={viewer?.id ?? ''}>
        <details className="apt-formulas">
          <summary>{zh ? '公式速查' : 'Formula sheet'}</summary>
          <dl>
            {FORMULAS.map(([zhTitle, enTitle, zhBody, enBody]) => (
              <div key={enTitle}>
                <dt>{zh ? zhTitle : enTitle}</dt>
                <dd>{zh ? zhBody : enBody}</dd>
              </div>
            ))}
          </dl>
        </details>
      </AptitudePractice>
    </>
  );
}
