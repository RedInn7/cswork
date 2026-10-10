import type { Problem } from './problems';
export type Person = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher';
  verified: boolean;
};
export type Lesson = {
  id: string;
  course_id: string;
  title: string;
  summary: string;
  section: string;
  position: number;
  version: string;
  has_video: number;
  updated_at: number;
  body?: string;
  progress?: Progress | null;
  versions?: { version: string; created_at: number }[];
  revision?: number;
  published?: number;
  media_asset_id?: string | null;
};
export type Course = {
  id: string;
  title: string;
  summary: string;
  version: string;
  published: number;
  has_access: boolean;
  lessons: Lesson[];
  position?: number;
  revision?: number;
  price_id?: string | null;
  purchase_available?: boolean;
  price?: { amount: number; currency: string; display: string } | null;
};
export type Progress = {
  lesson_id: string;
  completed: number;
  position: number;
  video_asset_id?: string | null;
  note: string;
  bookmarked: number;
  updated_at: number;
};
export type Submission = {
  id: string;
  problem_id: string;
  language: string;
  status: string;
  passed: number;
  total: number;
  runtime: number | null;
  memory: number | null;
  message?: string;
  code?: string;
  created_at: number;
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  href: string;
  read_at: number | null;
  created_at: number;
};
export type Boot = {
  person: Person | null;
  courses: Course[];
  /** Courses this person holds a grant for, even when course content is hidden. */
  courseAccess?: string[];
  problems: Problem[];
  progress: Progress[];
  submissions: Submission[];
  activity?: { problem_id: string; created_at: number }[];
  notifications: Notification[];
  unreadNotifications?: number;
  services: Record<string, boolean>;
};
export type Ticket = {
  attachments?: {
    user_id?: string;
    id: string;
    name: string;
    size: number;
    created_at: number;
  }[];
  id: string;
  user_id: string;
  title: string;
  body: string;
  lesson_id: string | null;
  course_id?: string | null;
  submission_id: string | null;
  video_position: number | null;
  video_asset_id?: string | null;
  status: string;
  assigned_to: string | null;
  created_at: number;
  updated_at: number;
  name?: string;
  email?: string;
  replies?: {
    id: string;
    body: string;
    name: string;
    role: string;
    created_at: number;
  }[];
};
export type Review = {
  id: string;
  user_id: string;
  lesson_id: string;
  url: string;
  note: string;
  status: string;
  feedback: string | null;
  created_at: number;
  name?: string;
};
export type Release = {
  id: string;
  course_id: string;
  lesson_id: string | null;
  version: string;
  title: string;
  body: string;
  important: number;
  created_at: number;
  is_read: number;
};
/** Whom a bootstrap was built for; the visible catalogue depends on all three. */
export function bootIdentity(b: Pick<Boot, 'person'>) {
  return b.person ? `${b.person.id}:${b.person.verified}:${b.person.role}` : '';
}
/** A lite refresh keeps the loaded catalogue; a different identity needs a full bootstrap (null). */
export function mergeLiteBoot(prev: Boot, next: Boot): Boot | null {
  return bootIdentity(next) === bootIdentity(prev)
    ? { ...next, problems: prev.problems }
    : null;
}
export async function api<T = unknown>(
  path: string,
  data?: unknown,
): Promise<T> {
  const r = await fetch('/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let result: unknown;
  try {
    result = await r.json();
  } catch {
    throw new Error('服务暂时不可用，请稍后重试');
  }
  if (!r.ok) {
    if (r.status === 401 && typeof window !== 'undefined')
      window.dispatchEvent(new Event('cswork:auth-required'));
    const message =
      result &&
      typeof result === 'object' &&
      'error' in result &&
      typeof result.error === 'string'
        ? result.error
        : '操作失败';
    throw new ApiError(message, r.status, result);
  }
  return result as T;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
export const statusNames: Record<string, string> = {
  accepted: '已通过',
  queued: '排队中',
  compiling: '编译中',
  running: '运行中',
  finished: '运行完成',
  cancelled: '已取消',
  memory_limit: '超出内存限制',
  output_limit: '超出输出限制',
  wrong_answer: '答案错误',
  compile_error: '编译错误',
  time_limit: '超出时间限制',
  runtime_error: '运行错误',
  system_error: '服务异常',
  pending: '等待处理',
  submitting: '提交中',
  open: '待老师回复',
  waiting: '待你确认',
  resolved: '已解决',
  approved: '评审通过',
  changes_requested: '需要修改',
  paid: '已支付',
  refunded: '已退款',
};
export function date(n: number) {
  return new Date(n).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}
