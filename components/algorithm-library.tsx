'use client';

import { useState } from 'react';
import { StudyLibrary } from './study-library';
import { OaLibrary } from './oa-library';
import type { Navigate } from './learning';

export function AlgorithmLibrary(props: {
  navigate: Navigate;
  availableProblemIds: string[];
}) {
  const [section, setSection] = useState<'leetcode' | 'oa'>('leetcode');
  return (
    <div className="algorithm-library">
      <nav className="algorithm-library-switch" aria-label="算法题库">
        <button
          type="button"
          aria-pressed={section === 'leetcode'}
          onClick={() => setSection('leetcode')}
        >
          算法题单
        </button>
        <button
          type="button"
          aria-pressed={section === 'oa'}
          onClick={() => setSection('oa')}
        >
          OA 题目 <span>OA Master</span>
        </button>
      </nav>
      {section === 'oa' ? <OaLibrary /> : <StudyLibrary {...props} />}
    </div>
  );
}
