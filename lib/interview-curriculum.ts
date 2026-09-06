import catalog from '@/content/interview-catalog.json';
export const INTERVIEW_COURSE_ID = 'sde-interview-foundations';
export function isKnowledgeLesson(id: string | undefined) {
  return catalog.some((chapter) => chapter.id === id);
}
