export type LeetcodeRegion = 'cn' | 'us';
export type LeetcodeSyncStatus =
  | 'running'
  | 'complete'
  | 'cancelled'
  | 'failed'
  | 'truncated';
export type LeetcodeSyncRun = {
  id: string;
  region: LeetcodeRegion;
  username: string;
  roundId: string;
  status: LeetcodeSyncStatus;
  scanned: number;
  accepted: number;
  matched: number;
  unmatched: number;
  pages: number;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};
export type LeetcodeAcceptedRecord = {
  id: string;
  region: LeetcodeRegion;
  username: string;
  externalId: string;
  slug: string;
  title: string;
  language: string;
  submittedAt: number;
  sourceUrl: string;
  matchedProblemId: string | null;
};
export type LeetcodeSyncState = {
  runs: LeetcodeSyncRun[];
  records: LeetcodeAcceptedRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  summary: { accepted: number; matched: number; unmatched: number };
};
