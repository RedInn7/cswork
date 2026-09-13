import type { Problem, Language } from './problems';
import type { CodingMode } from './coding-mode';

export type OJProblem = Problem & {
  courseId?: string;
  version?: number;
  maxCodeBytes?: number;
  maxStdinBytes?: number;
  languages?: Language[];
  languageVersions?: Partial<Record<Language, string>>;
  samples?: { name: string; input: string; expectedOutput: string }[];
  judgeAvailable?: boolean;
  codingModes?: CodingMode[];
  leetcodeTemplates?: Partial<Record<Language, string>>;
  leetcodeInputHelp?: { zh: string; en: string } | null;
  practiceRound?: { id: string; number: number } | null;
  sourceStatement?: {
    descriptionZh: string;
    descriptionEn: string;
    sourceUrl: string;
    sourceEnUrl: string;
    attribution: string;
  } | null;
};
export type OJCase = {
  ordinal: number;
  status: string;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  hidden: boolean;
  stdin?: string;
  expected?: string;
  stdout?: string;
  stderr?: string;
};
export type OJSubmission = {
  watchToken?: string;
  id: string;
  problem_id: string;
  language: Language;
  codingMode?: CodingMode;
  status: string;
  mode: 'judge' | 'run';
  passed: number;
  total: number;
  score?: number;
  runtime?: number | null;
  memory?: number | null;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  created_at: number;
  code?: string;
  cases?: OJCase[];
  firstFailure?: {
    ordinal: number;
    status: string;
    stdin: string;
    expected: string;
    stdout: string;
    stderr: string;
    truncated: Partial<
      Record<'stdin' | 'expected' | 'stdout' | 'stderr', boolean>
    >;
  };
  compileOutput?: string;
  message?: string;
  queuedPosition?: number;
  problemVersion?: string;
  practiceRoundId?: string | null;
  practiceRoundNumber?: number | null;
};
export type SubmissionPage = {
  items: OJSubmission[];
  nextCursor: string | null;
};
export const activeStatuses = new Set([
  'pending',
  'submitting',
  'queued',
  'compiling',
  'running',
  'judging',
  'processing',
]);
export const verdictNames: Record<string, string> = {
  accepted: '通过',
  wrong_answer: '答案错误',
  compile_error: '编译错误',
  time_limit: '超出时间限制',
  memory_limit: '超出内存限制',
  output_limit: '超出输出限制',
  runtime_error: '运行错误',
  system_error: '判题服务异常',
  internal_error: '判题服务异常',
  pending: '等待处理',
  queued: '队列中',
  submitting: '提交中',
  compiling: '编译中',
  running: '运行中',
  judging: '判题中',
  processing: '处理中',
  cancelled: '已取消',
  canceled: '已取消',
  skipped: '未运行',
  completed: '运行完成',
  executed: '运行完成',
  finished: '运行完成',
};
export function verdict(status: string, mode?: string) {
  if (status === 'accepted' && mode === 'run') return '运行成功';
  return verdictNames[status] || status;
}

export type OJReceipt = Pick<OJSubmission, 'id' | 'status'> &
  Partial<OJSubmission>;

/** Accept rich receipts from new workers, retaining rolling-deploy compatibility. */
export async function submitOJ(
  payload: unknown,
  signal: AbortSignal,
  onReceipt?: (receipt: OJReceipt) => void,
): Promise<OJSubmission> {
  const receipt = await ojRequest<OJReceipt>('submissions', payload, signal);
  signal.throwIfAborted();
  onReceipt?.(receipt);
  if (
    typeof receipt.problem_id === 'string' &&
    typeof receipt.language === 'string' &&
    (receipt.mode === 'run' || receipt.mode === 'judge') &&
    typeof receipt.passed === 'number' &&
    typeof receipt.total === 'number' &&
    typeof receipt.created_at === 'number' &&
    Array.isArray(receipt.cases)
  )
    return receipt as OJSubmission;
  const detail = await ojRequest<OJSubmission>(
    `submissions/${encodeURIComponent(receipt.id)}`,
    undefined,
    signal,
  );
  signal.throwIfAborted();
  return detail;
}

/** Abort any in-flight legacy receipt detail before publishing cancellation. */
export async function cancelOJ(
  id: string,
  submitting: AbortController | null,
  signal: AbortSignal,
): Promise<OJSubmission> {
  submitting?.abort();
  const path = `submissions/${encodeURIComponent(id)}`;
  await ojRequest(`${path}/cancel`, {}, signal);
  const detail = await ojRequest<OJSubmission>(path, undefined, signal);
  signal.throwIfAborted();
  return detail;
}

export async function ojRequest<T>(
  path: string,
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 30_000);
  try {
    const response = await fetch(`/api/oj/${path}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers:
        data === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(result?.error || `服务暂时不可用（${response.status}）`);
    if (!result) throw new Error('服务返回了无法识别的数据，请重试');
    return result as T;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new Error(
        '请求超时，请重试。重复请求会使用相同提交编号，避免重复判题。',
      );
    }
    if (error instanceof TypeError)
      throw new Error('无法连接判题服务，请检查网络后重试');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
