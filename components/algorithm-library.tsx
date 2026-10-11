'use client';

import { StudyLibrary } from './study-library';
import { OaLibrary } from './oa-library';
import type { Navigate } from './learning';
import { useT } from '@/lib/i18n';

export function AlgorithmLibrary(props: {
  navigate: Navigate;
  availableProblemIds: string[];
  collection?: string;
  activity: { problem_id: string; created_at: number }[];
  signedIn: boolean;
}) {
  const t = useT(),
    section = props.collection === 'oa' ? 'oa' : 'leetcode';
  return (
    <div className="algorithm-library">
      <nav className="algorithm-library-switch" aria-label={t('算法题库', 'Problem Bank')}>
        <button
          type="button"
          aria-pressed={section === 'leetcode'}
          onClick={() => props.navigate('problems')}
        >
          {t('灵神题单', "Ling's Problem List")}
        </button>
        <button
          type="button"
          aria-pressed={section === 'oa'}
          onClick={() => props.navigate('problems', { library: 'oa' })}
        >
          {t('OA 题目', 'OA problems')} <span>OA Master</span>
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
