'use client';

import { StudyLibrary } from './study-library';
import { OaLibrary } from './oa-library';
import type { Navigate } from './learning';

export function AlgorithmLibrary(props: {
  navigate: Navigate;
  availableProblemIds: string[];
  collection?: string;
  activity: { problem_id: string; created_at: number }[];
  signedIn: boolean;
}) {
  const section = props.collection === 'oa' ? 'oa' : 'leetcode';
  return (
    <div className="algorithm-library">
      <nav className="algorithm-library-switch" aria-label="算法题库">
        <button
          type="button"
          aria-pressed={section === 'leetcode'}
          onClick={() => props.navigate('problems')}
        >
          灵神题单
        </button>
        <button
          type="button"
          aria-pressed={section === 'oa'}
          onClick={() => props.navigate('problems', { library: 'oa' })}
        >
          OA 题目 <span>OA Master</span>
        </button>
      </nav>
      {section === 'oa' ? (
        <OaLibrary navigate={props.navigate} />
      ) : (
        <StudyLibrary {...props} />
      )}
    </div>
  );
}
