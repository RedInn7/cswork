'use client';
import { Suspense, lazy, useEffect, useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { Volume2 } from 'lucide-react';
import { GLOSSARY, GLOSSARY_GROUPS, glossaryHits, glossaryHref, type GlossaryTerm } from '@/lib/glossary';
import { STOP_NAMES } from '@/lib/route-stops';
import { useSpeech } from './use-speech';

const CardEditor = lazy(() => import('./card-editor').then((m) => ({ default: m.CardEditor })));

/**
 * The glossary on /topics/glossary: every term is server-rendered with its anchor (term-<id>);
 * the search box only hides what doesn't match. Terms and sentences are read aloud by the
 * browser's own voice where it has one, and each term can become a review card (an account's
 * card note; signed out, the editor says so).
 */
export function GlossaryList({ zh }: { zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const field = useId();
  const [query, setQuery] = useState('');
  const [card, setCard] = useState<GlossaryTerm | null>(null);
  const { canSpeak, say } = useSpeech('en');
  const shown = query.trim() ? new Set(glossaryHits(query).map((term) => term.id)) : null;
  // A term or group the search hides (⌘K on this page, the group links) clears the search first.
  useEffect(() => {
    const reveal = () => {
      const target = document.getElementById(location.hash.slice(1));
      if (!target?.closest('[hidden]')) return;
      flushSync(() => setQuery(''));
      target.scrollIntoView();
    };
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, []);
  // The button sits inside lang="en" text; its label is in the interface language.
  const listen = (text: string, label: string) =>
    canSpeak && (
      <button
        type="button"
        className="glossary-listen"
        lang={zh ? 'zh-CN' : 'en'}
        aria-label={label}
        onClick={() => say(text, { rate: 0.9 })}
      >
        <Volume2 size={15} aria-hidden="true" />
      </button>
    );
  return (
    <div className="glossary">
      <div className="glossary-tools">
        <label htmlFor={field}>{t('搜索术语', 'Search terms')}</label>
        <input
          id={field}
          type="search"
          value={query}
          placeholder={t('中文或英文，例如 差分、BIT', 'Chinese or English, e.g. prefix sum, DSU')}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p role="status">
          {shown
            ? t(`找到 ${shown.size} 条`, `${shown.size} ${shown.size === 1 ? 'term matches' : 'terms match'}`)
            : t(`共 ${GLOSSARY.length} 条`, `${GLOSSARY.length} terms`)}
        </p>
      </div>
      <nav className="glossary-jump" aria-label={t('分组', 'Groups')}>
        {GLOSSARY_GROUPS.map(([group, nameZh, nameEn]) => (
          <a key={group} href={`#glossary-${group}`}>
            {zh ? nameZh : nameEn}
          </a>
        ))}
      </nav>
      {GLOSSARY_GROUPS.map(([group, nameZh, nameEn]) => {
        const terms = GLOSSARY.filter((term) => term.group === group);
        const visible = shown ? terms.filter((term) => shown.has(term.id)).length : terms.length;
        return (
          <section key={group} className="glossary-group" aria-labelledby={`glossary-${group}`} hidden={!visible}>
            <h2 id={`glossary-${group}`}>
              {zh ? nameZh : nameEn} <span>{visible}</span>
            </h2>
            <dl>
              {terms.map((term) => (
                <div key={term.id} id={`term-${term.id}`} className="glossary-term" hidden={!!shown && !shown.has(term.id)}>
                  <dt>
                    <span className="glossary-zh" lang="zh-CN">
                      {term.zh}
                    </span>
                    <span className="glossary-en" lang="en">
                      {term.en}
                      {listen(term.en, t(`朗读 ${term.en}`, `Say “${term.en}”`))}
                    </span>
                  </dt>
                  {term.alt && (
                    <dd className="glossary-alt" lang="en">
                      <span className="sr-only" lang={zh ? 'zh-CN' : 'en'}>
                        {t('又称：', 'Also: ')}
                      </span>
                      {term.alt.join(' · ')}
                    </dd>
                  )}
                  <dd className="glossary-say" lang="en">
                    <q>{term.say}</q>
                    {listen(term.say, t('朗读例句', 'Listen to the sentence'))}
                  </dd>
                  <dd className="glossary-actions">
                    {term.stop && (
                      <a href={`/topics/${term.stop}`}>
                        {t('模板：', 'Template: ')}
                        {STOP_NAMES[term.stop][zh ? 0 : 1]}
                      </a>
                    )}
                    <button type="button" onClick={() => setCard(term)}>
                      {t('做成卡片', 'Make a card')}
                      <span className="sr-only">{`: ${term.en}`}</span>
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
      {card && (
        <Suspense fallback={null}>
          <CardEditor
            initial={{
              front: zh ? `「${card.zh}」英文怎么说？` : `What is “${card.en}” in Chinese?`,
              back: [zh ? card.en : card.zh, card.alt?.join(' · '), card.say].filter(Boolean).join('\n'),
              tags: ['glossary', ...(card.stop ? [card.stop] : [])],
              src: { href: glossaryHref(card.id), title: zh ? card.zh : card.en },
            }}
            onClose={() => setCard(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
