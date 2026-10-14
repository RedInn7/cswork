'use client';

import { StudyLibrary } from './study-library';
import { OaLibrary } from './oa-library';
import { ClassicList } from './classic-list';
import { classicList, classicLists } from '@/lib/classic-lists';
import type { Navigate } from './learning';
import { useT } from '@/lib/i18n';

/** Problem bank sections: Ling's list, OA problems, the timed mock OA and the classic lists. */
export function LibrarySwitch({
  section,
  navigate,
  list = '',
}: {
  section: 'leetcode' | 'oa' | 'mock' | 'classic';
  navigate: Navigate;
  /** The classic list shown, when section is 'classic'. */
  list?: string;
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
      <label className="algorithm-library-lists" data-active={!!list || undefined}>
        <span>{t('经典题单', 'Classic lists')}</span>
        <select
          value={list}
          onChange={(event) =>
            event.target.value && navigate('problems', { library: event.target.value })
          }
        >
          <option value="" disabled>
            {t('选择对照题单…', 'Choose a mapped list…')}
          </option>
          {classicLists.map((item) => (
            <option key={item.slug} value={item.slug}>
              {t(item.nameZh, item.nameEn)}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}

export function AlgorithmLibrary(props: {
  navigate: Navigate;
  availableProblemIds: string[];
  collection?: string;
  activity: { problem_id: string; created_at: number }[];
  signedIn: boolean;
}) {
  const list = classicList(props.collection)?.slug;
  const section = props.collection === 'oa' ? 'oa' : list ? 'classic' : 'leetcode';
  return (
    <div className="algorithm-library">
      <LibrarySwitch section={section} navigate={props.navigate} list={list} />
      {section === 'oa' ? (
        <OaLibrary navigate={props.navigate} />
      ) : list ? (
        <ClassicList
          key={list}
          slug={list}
          navigate={props.navigate}
          signedIn={props.signedIn}
        />
      ) : (
        <StudyLibrary {...props} />
      )}
    </div>
  );
}
