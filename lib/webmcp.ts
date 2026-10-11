import type { Boot } from './types';
import { readLocale } from './i18n';
export function registerAcademyTools(
  get: () => Boot,
  navigate: (view: string, extra?: Record<string, string>) => void,
) {
  const context = (
    document as unknown as {
      modelContext?: {
        registerTool: (
          tool: unknown,
          options: { signal: AbortSignal },
        ) => Promise<void> | void;
      };
    }
  ).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  // Tools are registered once, in the site language of that moment.
  const zh = readLocale() === 'zh';
  const tools = [
    {
      name: 'list_learning_progress',
      title: zh ? '查看学习进度' : 'View learning progress',
      description: zh
        ? '读取当前已登录学员的课时完成情况，不修改进度。'
        : "Reads the signed-in student's lesson completion without changing it.",
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input: unknown) {
        if (!input || typeof input !== 'object' || Object.keys(input).length)
          throw new Error('Expected an empty object');
        const b = get();
        if (!b.person)
          throw new Error(zh ? '请先登录' : 'Please sign in first');
        return {
          lessons: b.courses.flatMap((c) =>
            c.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              completed: !!b.progress.find((p) => p.lesson_id === l.id)
                ?.completed,
            })),
          ),
        };
      },
    },
    {
      name: 'open_course_lesson',
      title: zh ? '打开课程章节' : 'Open a course lesson',
      description: zh
        ? '导航到有权限访问的章节，不自动标记完成。'
        : 'Opens a lesson the student can access without marking it complete.',
      inputSchema: {
        type: 'object',
        properties: { lessonId: { type: 'string' } },
        required: ['lessonId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const d = input as { lessonId?: unknown };
        if (
          !d ||
          typeof d.lessonId !== 'string' ||
          Object.keys(d).some((k) => k !== 'lessonId')
        )
          throw new Error('Expected lessonId');
        const b = get(),
          c = b.courses.find(
            (c) => c.has_access && c.lessons.some((l) => l.id === d.lessonId),
          );
        if (!b.person || !c)
          throw new Error(
            zh ? '章节不存在或尚未授权' : 'Lesson not found or not unlocked',
          );
        navigate('lesson', { lesson: d.lessonId });
        return { opened: d.lessonId };
      },
    },
  ];
  for (const tool of tools)
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {}
  return () => lifecycle.abort();
}
