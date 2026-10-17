import { JD_ROUNDS, type JdItem, type JdRound, type JdSkill } from './jd-skills';

/**
 * Keyword reading of a job description, no AI (/career/jd when AI is off, and the resume match
 * on that page): a fixed table of CS skills with their aliases, matched on word boundaries,
 * each hit with the sentence it sits in. Lines under "Minimum qualifications", "Requirements",
 * "What you'll need" or "Responsibilities" and the like are must; under "Preferred", "Nice to
 * have" or "Bonus", or a sentence saying "a plus", nice; under "About us" or "Benefits", nothing.
 * Pure and client-safe: it runs in the browser, so the posting never leaves it.
 */
export type JdTerm = { term: string; aliases: string[]; skill?: JdSkill };
export type TermHit = { term: string; skill?: JdSkill; sentence: string; importance: 'must' | 'nice' };

// [skill or null, entries]; an entry is a term or [term, ...aliases]. CASED forms match their exact case only.
const GROUPS: [JdSkill | null, (string | string[])[]][] = [
  [
    'dsa',
    [
      ['Data structures', 'data structure', '数据结构'],
      ['Algorithms', 'algorithm', 'algorithmic', '算法'],
      ['Problem solving', 'problem-solving'],
      ['CS fundamentals', 'computer science fundamentals', 'CS fundamental'],
      ['Complexity analysis', 'Big O', 'big-O', 'time complexity'],
      ['Dynamic programming'],
      ['Graph algorithms'],
      ['LeetCode'],
    ],
  ],
  [
    'sql',
    [
      'SQL',
      ['PostgreSQL', 'Postgres', 'psql'],
      'MySQL',
      'SQLite',
      ['SQL Server', 'MSSQL', 'T-SQL'],
      ['Oracle Database', 'Oracle DB', 'PL/SQL'],
      ['Relational databases', 'relational database', 'RDBMS'],
      ['Query optimization', 'query tuning'],
    ],
  ],
  ['pandas', ['pandas', ['DataFrames', 'DataFrame']]],
  [
    'system-design',
    [
      ['Distributed systems', 'distributed system', 'distributed computing', '分布式'],
      ['System design', 'systems design', '系统设计', '架构设计'],
      ['Scalability', 'scalable systems', 'scalable services', 'large-scale systems', 'large-scale', 'at scale', '高并发'],
      ['Microservices', 'microservice', 'micro-services', '微服务'],
      ['High availability', 'highly available', '高可用'],
      ['Fault tolerance', 'fault-tolerant', 'fault tolerant'],
      ['Load balancing', 'load balancer', 'load balancers'],
      ['Sharding', 'partitioning'],
      ['Message queues', 'message queue', 'message broker', 'message brokers', '消息队列'],
      ['Event-driven architecture', 'event-driven', 'event driven'],
    ],
  ],
  [
    'lld',
    [
      ['Object-oriented design', 'object oriented design', 'OOD', '面向对象设计'],
      ['Object-oriented programming', 'object oriented programming', 'OOP', '面向对象'],
      ['Design patterns', 'design pattern', '设计模式'],
      ['Low-level design', 'low level design', 'LLD'],
      'SOLID',
    ],
  ],
  [
    'concurrency',
    [
      ['Concurrency', 'concurrent programming', 'concurrent systems', '并发'],
      ['Multithreading', 'multi-threading', 'multithreaded', 'multi-threaded', '多线程'],
      ['Parallel programming', 'parallel computing', 'parallelism'],
      ['Asynchronous programming', 'async programming', 'async/await'],
    ],
  ],
  [
    'api-design',
    [
      ['API design', 'designing APIs', 'API development', 'API versioning'],
      'GraphQL',
      'gRPC',
      ['Protocol Buffers', 'protobuf', 'protobufs'],
      ['OpenAPI', 'Swagger'],
    ],
  ],
  [
    'behavioral',
    [
      ['Communication', 'communication skills', 'communicate', 'communicator', '沟通'],
      ['Collaboration', 'collaborative', 'teamwork', 'team player', '团队合作'],
      ['Leadership', 'lead projects'],
      ['Ownership', 'take ownership', 'sense of ownership'],
      ['Cross-functional', 'cross functional'],
      ['Mentoring', 'mentorship'],
    ],
  ],
  [
    'ml',
    [
      ['Machine learning', 'ML', '机器学习'],
      ['Deep learning', '深度学习'],
      'PyTorch',
      'TensorFlow',
      ['scikit-learn', 'sklearn'],
      'Keras',
      'XGBoost',
      ['NLP', 'natural language processing'],
      ['Computer vision'],
      ['LLMs', 'LLM', 'large language models', 'large language model', '大模型'],
      ['Generative AI', 'GenAI', 'gen AI'],
      ['Reinforcement learning'],
      ['Recommender systems', 'recommendation systems', 'recommendation system', '推荐系统'],
      'MLOps',
      ['Hugging Face', 'HuggingFace'],
      ['RAG', 'retrieval-augmented generation', 'retrieval augmented generation'],
      'LangChain',
      ['Feature engineering'],
      'OpenCV',
      'JAX',
      'MLflow',
      'SageMaker',
      ['Vector databases', 'vector database', 'vector search'],
      ['Fine-tuning', 'fine tuning', 'fine-tune'],
    ],
  ],
  [
    'frontend',
    [
      ['JavaScript', 'JS', 'ECMAScript', 'ES6'],
      'TypeScript',
      ['React', 'React.js', 'ReactJS'],
      ['HTML', 'HTML5'],
      ['CSS', 'CSS3'],
      ['Vue', 'Vue.js', 'VueJS'],
      ['Angular', 'AngularJS'],
      ['Next.js', 'NextJS'],
      'Redux',
      'Svelte',
      ['Tailwind CSS', 'Tailwind'],
      'Webpack',
      ['Front end', 'frontend', 'front-end', '前端'],
      ['Web accessibility', 'a11y', 'WCAG'],
      ['Sass', 'SCSS'],
      'jQuery',
      ['D3.js', 'D3'],
      'WebGL',
      'Electron',
      ['Web performance', 'Core Web Vitals'],
      ['Responsive design', 'responsive web design'],
    ],
  ],
  ['python', [['Python', 'Python3']]],
  ['java', ['Java']],
  ['cpp', [['C++', 'CPP'], 'C']],
  ['go', [['Go', 'Golang']]],
  [
    'rest-api',
    [
      ['REST', 'RESTful', 'REST API', 'REST APIs'],
      ['HTTP', 'HTTPS'],
      'JSON',
      ['Web services', 'web service'],
    ],
  ],
  [
    'oa',
    [
      ['Online assessment', 'online coding assessment', 'coding assessment', 'coding challenge', 'online coding test', 'coding test', '在线笔试', '笔试'],
      'HackerRank',
      'CodeSignal',
      'Codility',
    ],
  ],
  [
    null,
    [
      // Languages.
      'Kotlin', 'Swift', 'Objective-C', 'Rust', 'Ruby', 'PHP', 'Scala', 'Perl', 'MATLAB', 'Haskell', 'Elixir', 'Erlang',
      'Clojure', 'Dart', 'Lua', 'OCaml', 'Solidity',
      ['Bash', 'shell scripting', 'shell scripts'],
      'PowerShell',
      ['C#', 'C Sharp'],
      ['.NET', 'dotnet', 'ASP.NET', '.NET Core'],
      // Back end and mobile frameworks.
      ['Node.js', 'NodeJS', 'Node'],
      ['Express.js', 'ExpressJS'],
      'Django', 'Flask', 'FastAPI',
      ['Spring Boot', 'Spring Framework', 'Spring MVC'],
      ['Ruby on Rails', 'Rails'],
      'Laravel', 'Hibernate', 'Celery',
      'iOS', 'Android', 'React Native', 'Flutter', 'SwiftUI', 'Jetpack Compose', 'Xcode',
      // Data.
      ['Apache Spark', 'Spark', 'PySpark'],
      'Hadoop',
      ['Kafka', 'Apache Kafka'],
      'Flink', 'Airflow', 'dbt', 'Snowflake', 'BigQuery', 'Redshift', 'Databricks', 'Hive',
      ['ETL', 'ELT', 'data pipelines', 'data pipeline'],
      ['Data warehousing', 'data warehouse', 'data warehouses'],
      'Tableau',
      ['Power BI', 'PowerBI'],
      'Looker', 'NumPy', 'SciPy', 'Jupyter',
      ['Elasticsearch', 'OpenSearch'],
      ['Data modeling', 'data modelling'],
      ['Statistics', 'statistical'],
      ['A/B testing', 'A/B tests', 'A/B test'],
      ['Data analysis', 'data analytics'],
      ['Data visualization', 'data visualisation'],
      ['Time series', 'time-series'],
      // Databases.
      'NoSQL',
      ['MongoDB', 'Mongo'],
      'Redis', 'Cassandra', 'DynamoDB', 'Memcached', 'Neo4j', 'ClickHouse', 'HBase', 'Firebase',
      // Cloud and infrastructure.
      ['AWS', 'Amazon Web Services'],
      ['GCP', 'Google Cloud', 'Google Cloud Platform'],
      ['Azure', 'Microsoft Azure'],
      'EC2', 'S3',
      ['AWS Lambda', 'Lambda'],
      ['Kubernetes', 'k8s'],
      ['Docker', 'containers', 'containerization', 'containerized'],
      'Terraform', 'Ansible', 'Helm',
      ['CI/CD', 'continuous integration', 'continuous delivery', 'continuous deployment'],
      'Jenkins', 'GitHub Actions', 'GitLab CI', 'CircleCI',
      ['Git', 'version control'],
      ['Linux', 'Unix'],
      'Nginx',
      'Serverless',
      ['Infrastructure as code', 'infrastructure-as-code', 'IaC'],
      'Prometheus', 'Grafana', 'Datadog',
      ['Observability', 'OpenTelemetry'],
      ['SRE', 'site reliability'],
      ['Networking', 'TCP/IP', 'computer networks', 'computer networking'],
      ['Operating systems', 'operating system', 'OS internals', '操作系统'],
      ['Service mesh', 'Istio'],
      'RabbitMQ', 'SQS',
      'Kinesis', 'Pub/Sub', 'etcd', 'ZooKeeper', 'Thrift', 'Parquet',
      ['Trino', 'Presto'],
      ['CDN', 'CDNs'],
      'Pulumi', 'CloudFormation',
      ['WebSockets', 'WebSocket'],
      // Security.
      ['Security', 'cybersecurity', 'application security', 'AppSec'],
      ['OAuth', 'OAuth2', 'OAuth 2.0', 'OpenID Connect', 'OIDC'],
      'JWT',
      ['Cryptography', 'encryption'],
      ['Penetration testing', 'pen testing'],
      // Engineering practice.
      ['Unit testing', 'unit tests', 'automated testing', 'test automation', 'automated tests'],
      ['TDD', 'test-driven development', 'test driven development'],
      ['Code review', 'code reviews'],
      ['Agile', 'Scrum', 'Kanban'],
      'Debugging',
      ['Performance optimization', 'performance tuning', 'profiling'],
      'Jest', 'Cypress', 'Selenium', 'Playwright', 'JUnit', 'pytest',
      // Systems and hardware.
      ['Embedded systems', 'embedded software', 'firmware'],
      'RTOS',
      ['Compilers', 'compiler'],
      ['Linux kernel', 'kernel development'],
      'CUDA',
      ['GPU', 'GPUs'],
      'FPGA', 'Verilog',
      ['Computer architecture'],
      // Other.
      // "AI" alone is often the company blurb ("an AI-first company"), so it is no ML requirement.
      ['AI', 'artificial intelligence', '人工智能'],
      'Blockchain', 'Unity', 'Unreal Engine', 'Figma',
    ],
  ],
];
// Short or everyday words that only count in their own case ("Go", "React", "REST", not "go", "react" or "the rest").
const CASED = new Set([
  'C', 'Go', 'React', 'Swift', 'Rust', 'Ruby', 'Dart', 'Rails', 'Spark', 'Hive', 'Helm', 'Node', 'REST', 'ML', 'AI',
  'JS', 'RAG', 'SOLID', 'Lambda', 'Unity', 'Jest', 'S3', 'dbt', 'D3', 'IaC', 'OOD', 'LLD',
]);

export const JD_TERMS: JdTerm[] = GROUPS.flatMap(([skill, entries]) =>
  entries.map((entry) => {
    const [term, ...aliases] = typeof entry === 'string' ? [entry] : entry;
    return { term, aliases, ...(skill ? { skill } : {}) };
  }),
);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const either = (words: string) => words.split(' ').map((w) => `[${w[0].toUpperCase()}${w[0]}]${w.slice(1)}`).join('|');
// Bare C and Go without their everyday uses: Series C, Plan C, C端 (consumer-facing), "Go beyond".
const GUARDED: Record<string, string> = {
  C: `(?<!(?:${either('series round level tier plan grade type class vitamin section part option phase stage building group category appendix')})\\s)C(?!\\s*[端侧轮位])`,
  Go: 'Go(?!-getter|\\s(?:beyond|above|further|deep|deeper|fast|far|big|live|out|after|ahead|home|get|the extra mile)\\b)',
};
// Not inside a longer word, and "Go-to-market" or "C-level" are not Go or C.
const BEFORE = '(?<![A-Za-z0-9+#\\-])';
const AFTER = '(?![A-Za-z0-9+#]|\\.[A-Za-z0-9]|-(?:to|level|suite)\\b)';
const pattern = (forms: string[], flags: string) =>
  forms.length ? [new RegExp(`${BEFORE}(?:${forms.sort((a, b) => b.length - a.length).map((f) => GUARDED[f] ?? escape(f)).join('|')})${AFTER}`, flags)] : [];
const PATTERNS = new Map(
  JD_TERMS.map((t) => {
    const forms = [t.term, ...t.aliases];
    return [t.term, [...pattern(forms.filter((f) => CASED.has(f)), ''), ...pattern(forms.filter((f) => !CASED.has(f)), 'i')]];
  }),
);
/** Whether `text` mentions the table term `term` (by any alias, on word boundaries). */
export const mentions = (term: string, text: string) => !!PATTERNS.get(term)?.some((re) => re.test(text));

const MUST_HEAD =
  /^(?:(?:minimum|basic|required|key|your|job) )?(?:qualifications|requirements|skills)$|^what you(?:'|’)ll (?:need|bring)$|^what (?:we|we're|we’re) (?:are )?looking for$|^must[- ]haves?$|^you (?:have|bring|should have|might be a fit if)$|^who you are$|^about you$|^(?:任职要求|岗位要求|任职资格|职位要求)$/i;
const NICE_HEAD =
  /^(?:preferred|desired|bonus|additional|nice[- ]to[- ]have)(?: (?:qualifications|skills|requirements|points|experience))?$|^nice[- ]to[- ]haves?$|^bonus points(?: if you have)?$|^(?:it(?:'|’)s )?a plus(?: if you have)?$|^(?:加分项|优先|加分)$/i;
// The role itself counts like a requirement; the company blurb, pay and perks ask for nothing.
const ROLE_HEAD =
  /^(?:(?:key |your )?responsibilities|what you(?:'|’)ll do|about (?:the role|the team|the job)|the role|岗位职责|工作职责|职位描述)$/i;
const SKIP_HEAD = /^(?:about (?:us|the company)|who we are|benefits|perks|compensation|salary|pay range|location|公司介绍|福利待遇|薪资福利)$/i;
const NICE_INLINE = /\b(?:a plus|is a bonus|nice to have|nice-to-have|preferred|bonus points|desirable)\b|加分|优先/i;
const headKind = (label: string) => {
  const l = label.replace(/\s*\(.*\)$/, '').replace(/\s+/g, ' ').trim();
  return NICE_HEAD.test(l) ? 'nice' : MUST_HEAD.test(l) || ROLE_HEAD.test(l) ? 'must' : SKIP_HEAD.test(l) ? 'skip' : null;
};

/**
 * The posting as sentences, each marked must or nice by the heading above it (or its own "a plus").
 * Under About us, Benefits or Pay nothing is asked for: left out. Text before the first heading is
 * the title and blurb when there are headings (nice), the whole posting when there are none (must).
 */
function sentences(text: string) {
  let section: 'lead' | 'must' | 'nice' | 'skip' = 'lead';
  const out: { text: string; importance: 'must' | 'nice' | 'lead' }[] = [];
  for (const raw of text.split('\n')) {
    // An "Apply at https://…" link is no HTTP requirement.
    let line = raw.replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ').replace(/^[\s#*_>•·▪◦●\-–—]+|[\s*_]+$/g, '');
    if (!line) continue;
    const colon = /^([^:：]{2,60})[:：]\s*(.*)$/.exec(line);
    const kind = headKind(colon ? colon[1] : line.replace(/[:：]$/, ''));
    if (kind) {
      if (kind === 'skip' && colon?.[2]) continue; // "Location: Remote" is a field, not a section
      section = kind;
      line = colon ? colon[2] : '';
      if (!line) continue;
    }
    if (section === 'skip') continue;
    for (const s of line.split(/(?<=[。！？；])|(?<=[.!?;])\s+/))
      if (s.trim()) out.push({ text: s.trim(), importance: NICE_INLINE.test(s) ? 'nice' : section });
  }
  const headed = section !== 'lead';
  return out.map((s) => ({ ...s, importance: s.importance === 'lead' ? (headed ? 'nice' : 'must') : s.importance }));
}

/** Each table term the posting mentions, once, with the first sentence that asks for it (a must one first). */
export function extractTerms(text: string): TermHit[] {
  const hits = new Map<string, TermHit>();
  for (const s of sentences(text))
    for (const t of JD_TERMS) {
      const had = hits.get(t.term);
      if ((had && (had.importance === 'must' || s.importance === 'nice')) || !mentions(t.term, s.text)) continue;
      hits.set(t.term, { term: t.term, ...(t.skill ? { skill: t.skill } : {}), sentence: s.text, importance: s.importance });
    }
  return [...hits.values()];
}

const YEARS =
  /(?<!\d)(\d{1,2})(?:\s*[-–~～]\s*\d{1,2})?\+?\s*(?:(?:years?|yrs)\b['’]?(?!\s+(?:of\s+age|old)\b)(?:\s+of)?(?:\s+[\w+#/.-]+){0,4}?\s+(?:experience|building|developing|designing|writing|working|shipping|programming|coding)\b|年(?:及?以上)?[^，。；,;.\s]{0,12}?经验)/gi;
const ROUND_CUES: [JdRound, RegExp][] = [
  [
    'oa',
    /online (?:coding )?(?:assessment|test|challenge)|coding (?:assessment|challenge|test)|hackerrank|codesignal|codility|\bintern(?:ship)?s?\b|new grad|university grad|recent grad|early career|entry[- ]level|笔试|实习|校招|应届/i,
  ],
  ['phone-coding', /phone screen|technical screen|coding interview|live coding|technical interview/i],
  ['system-design', /system design|distributed systems?|scalab|high[- ]availability|large[- ]scale|分布式|高并发|架构/i],
  ['behavioral', /behaviou?ral|culture|leadership principles|teamwork|communication|collaborat/i],
  ['take-home', /take[- ]home|home assignment|homework|project assignment|作业/i],
];

/**
 * The checklist's reading of a posting without AI: the skills (only terms that map onto JD_SKILLS,
 * each with the sentence quoted, at most 120 characters), musts first, and the likely rounds in
 * process order. Any skill at all marks a software role: phone coding and behavioral then follow,
 * and three or more years of experience mean a system design round.
 */
export function readJd(text: string): { terms: TermHit[]; skills: Pick<JdItem, 'skill' | 'evidence' | 'importance'>[]; likelyRounds: JdRound[] } {
  const terms = extractTerms(text);
  const bySkill = new Map<JdSkill, Pick<JdItem, 'skill' | 'evidence' | 'importance'>>();
  for (const hit of terms) {
    const had = hit.skill && bySkill.get(hit.skill);
    if (!hit.skill || (had && (had.importance === 'must' || hit.importance === 'nice'))) continue;
    const evidence = hit.sentence.length > 120 ? `${hit.sentence.slice(0, 119)}…` : hit.sentence;
    bySkill.set(hit.skill, { skill: hit.skill, evidence, importance: hit.importance });
  }
  const skills = [...bySkill.values()].sort((a, b) => +(a.importance === 'nice') - +(b.importance === 'nice'));
  // The lower bound of "3-5 years of experience", "3+ yrs building …" or "3年以上…经验"; not "18 years of age" or "for 25 years".
  const years = Math.max(0, ...[...text.matchAll(YEARS)].map((m) => Number(m[1])));
  const rounds = new Set(ROUND_CUES.filter(([, re]) => re.test(text)).map(([round]) => round));
  if (skills.length) rounds.add('phone-coding').add('behavioral');
  if (years >= 3) rounds.add('system-design');
  return { terms, skills, likelyRounds: JD_ROUNDS.filter((r) => rounds.has(r)) };
}
