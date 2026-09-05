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
};
export type Course = {
  id: string;
  title: string;
  summary: string;
  version: string;
  published: number;
  has_access: boolean;
  lessons: Lesson[];
};
export type Progress = {
  lesson_id: string;
  completed: number;
  position: number;
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
  problems: Problem[];
  progress: Progress[];
  submissions: Submission[];
  notifications: Notification[];
  services: Record<string, boolean>;
};
export type Ticket = {
  attachments?: {
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
  submission_id: string | null;
  video_position: number | null;
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
export async function api<T = any>(path: string, data?: unknown): Promise<T> {
  const r = await fetch('/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let result: any;
  try {
    result = await r.json();
  } catch {
    throw new Error('服务暂时不可用，请稍后重试');
  }
  if (!r.ok) throw new Error(result.error || '操作失败');
  return result;
}
export const statusNames: Record<string, string> = {
  accepted: '已通过',
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
