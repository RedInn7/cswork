'use client';
import { useState } from 'react';
import { ListPlus } from 'lucide-react';
import { englishMessage } from '@/lib/messages-en';
import { ojRequest } from '@/lib/oj-client';

/** "Save as a problem list" on /company/top: one private list of the judgeable problems shown. */
export function SaveAsList({ ids, title, description, zh }: { ids: string[]; title: string; description: string; zh: boolean }) {
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'signin' } | { kind: 'saved'; id: string } | { kind: 'error'; message: string }>({
    kind: 'idle',
  });
  const save = async () => {
    setState({ kind: 'busy' });
    try {
      const made = await ojRequest<{ id: string }>('lists', { title, description, problemIds: ids });
      setState({ kind: 'saved', id: made.id });
    } catch (caught) {
      const failure = caught as Error & { status?: number };
      setState(
        failure.status === 401
          ? { kind: 'signin' }
          : { kind: 'error', message: zh ? failure.message : englishMessage(failure.message) },
      );
    }
  };
  return (
    <div className="top-save">
      <button type="button" className="oa-public-cta" disabled={state.kind === 'busy' || state.kind === 'saved'} onClick={save}>
        <ListPlus size={15} aria-hidden="true" />
        {state.kind === 'busy'
          ? zh
            ? '正在保存…'
            : 'Saving…'
          : zh
            ? `存成我的题单（${ids.length} 题）`
            : `Save as my list (${ids.length})`}
      </button>
      <p role="status" className="top-save-status">
        {state.kind === 'saved' && (
          <a href={`/?view=lists&list=${encodeURIComponent(state.id)}`}>{zh ? '已保存，打开题单 →' : 'Saved. Open the list →'}</a>
        )}
        {state.kind === 'signin' && (
          <a href="/?view=lists">{zh ? '登录后才能保存题单，去登录 →' : 'Sign in to save lists →'}</a>
        )}
        {state.kind === 'error' && state.message}
      </p>
    </div>
  );
}
