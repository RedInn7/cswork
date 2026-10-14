'use client';

import { StudyLibrary } from './study-library';
import { OaLibrary } from './oa-library';
import type { Navigate } from './learning';
import { useT } from '@/lib/i18n';

/** Problem bank sections: Ling's list, OA problems and the timed mock OA. */
export function LibrarySwitch({
  section,
  navigate,
}: {
  section: 'leetcode' | 'oa' | 'mock';
  navigate: Navigate;
}) {
  const t = useT();
  return (
    <nav className="algorithm-library-switch" aria-label={t('算法题库', 'Problem Bank')}>
      <button
        type="button"
        aria-pressed={section === 'leetcode'}
        onClick={() => navigate('problems')}
      >
        {t('灵神题单', "Ling's Problem List")}
      </button>
      <button
        type="button"
        aria-pressed={section === 'oa'}
        // Re-navigating would drop the URL filters OaLibrary keeps in sync.
        onClick={() => section !== 'oa' && navigate('problems', { library: 'oa' })}
      >
        {t('OA 题目', 'OA problems')} <span>OA Master</span>
      </button>
      <button
        type="button"
        aria-pressed={section === 'mock'}
        onClick={() => navigate('mock')}
      >
        {t('模拟 OA', 'Mock OA')} <span>{t('限时', 'Timed')}</span>
      </button>
    </nav>
  );
}

export function AlgorithmLibrary(props: {
  navigate: Navigate;
  availableProblemIds: string[];
  collection?: string;
  activity: { problem_id: string; created_at: number }[];
  signedIn: boolean;
  userId?: string | null;
}) {
  const section = props.collection === 'oa' ? 'oa' : 'leetcode';
  return (
    <div className="algorithm-library">
      <LibrarySwitch section={section} navigate={props.navigate} />
      {section === 'oa' ? (
        <OaLibrary navigate={props.navigate} />
      ) : (
        <StudyLibrary {...props} />
      )}
    </div>
  );
}
