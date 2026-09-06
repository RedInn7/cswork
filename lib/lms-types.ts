import type { Lesson, Ticket, Review } from './types';
export type LmsPage<T> = {
  items: T[];
  nextCursor: string | null;
  total: number;
};
export type LmsCourse = {
  id: string;
  title: string;
  summary: string;
  version: string;
  published: boolean;
  revision: number;
  position: number;
  lessonCount: number;
  publishedLessonCount: number;
};
export type LmsLessonPayload = {
  title: string;
  summary: string;
  section: string;
  position: number;
  body: string;
  streamUid: string | null;
  videoAssetIds: string[];
};
export type LmsLessonDraft = LmsLessonPayload & {
  lessonId: string;
  courseId: string;
  revision: number;
  baseRevision: number;
  version: string;
  published: boolean;
  hasChanges: boolean;
  updatedAt: number;
};
export type LmsLessonEditor = {
  lesson: Lesson & {
    published: number;
    revision: number;
    video_asset_ids: string;
  };
  draft: LmsLessonDraft;
  versions: {
    id: string;
    version: string;
    createdAt: number;
    createdBy: string | null;
  }[];
};
export type LmsTicket = Ticket & {
  revision: number;
  course_id: string | null;
  course_title?: string;
};
export type LmsReviewEvent = {
  revision: number;
  kind: string;
  url: string;
  note: string;
  feedback: string | null;
  status: string;
  lessonVersion: string;
  actorName: string;
  createdAt: number;
};
export type LmsReview = Review & {
  revision: number;
  updated_at: number;
  events?: LmsReviewEvent[];
};
export type LmsGrant = {
  id: string;
  email: string;
  course_id: string;
  source: string;
  expires_at: number | null;
  revoked_at: number | null;
  created_at: number;
};
export type LmsStudent = {
  email: string;
  userId: string | null;
  name: string;
  verified: boolean;
  joinedAt: number | null;
  grants: LmsGrant[];
  activeCourseIds: string[];
};
