'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Clock3,
  Copy,
  FileCode2,
  GitCompareArrows,
  HardDrive,
  LoaderCircle,
  LockKeyhole,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { CodeDiff, CodeEditor } from './editor';
import { activeStatuses, verdict, type OJSubmission } from '@/lib/oj-client';
import { type EditorSettings } from '@/lib/editor-settings';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import type { Language } from '@/lib/problems';

export function Verdict({
  submission,
}: {
  submission: Pick<OJSubmission, 'status' | 'mode'>;
}) {
  const t = useT();
  const active = activeStatuses.has(submission.status);
  const success = ['accepted', 'completed', 'executed', 'finished'].includes(
    submission.status,
  );
  return (
    <span
      className={`cs-verdict ${active ? 'pending' : success ? 'success' : 'failed'}`}
    >
      {active ? (
        <LoaderCircle size={14} className="cs-spin" />
      ) : success ? (
        <Check size={14} />
      ) : null}
      {t(...verdict(submission.status, submission.mode))}
      {submission.status === 'wrong_answer' && t(' · Wrong Answer', '')}
    </span>
  );
}

export function CopyBlock({
  label,
  value,
  truncated,
}: {
  label: string;
  value: string;
  truncated?: boolean;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="cs-output-block">
      <div>
        <span>{label}</span>
        <button
          aria-label={t(`复制${label}`, `Copy ${label.toLowerCase()}`)}
          title={t(`复制${label}`, `Copy ${label.toLowerCase()}`)}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setError(false);
            } catch {
              setError(true);
            }
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <pre tabIndex={0}>{value || t('（空）', '(empty)')}</pre>
      {truncated && (
        <small>
          {t(
            '内容过长，仅显示部分内容；复制也只包含当前显示的内容。',
            'Too long to show in full. Only part is shown, and copying includes only what is shown.',
          )}
        </small>
      )}
      {error && (
        <small role="status">
          {t(
            '复制失败，请选中文字后复制。',
            "Couldn't copy. Select the text and copy it manually.",
          )}
        </small>
      )}
    </div>
  );
}

export function SubmissionResult({
  submission,
  cancel,
  cancelling,
  inspect,
}: {
  submission: OJSubmission;
  cancel?: () => void;
  cancelling?: boolean;
  inspect?: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const cases = submission.cases || [];
  const firstFailure = cases.findIndex((item) =>
    [
      'wrong_answer',
      'runtime_error',
      'time_limit',
      'memory_limit',
      'output_limit',
    ].includes(item.status),
  );
  const [selected, setSelected] = useState(Math.max(0, firstFailure));
  const selection = useRef({
    id: submission.id,
    failureShown: firstFailure >= 0,
  });
  useEffect(() => {
    if (selection.current.id !== submission.id) {
      selection.current = {
        id: submission.id,
        failureShown: firstFailure >= 0,
      };
      setSelected(Math.max(0, firstFailure));
    } else if (firstFailure >= 0 && !selection.current.failureShown) {
      selection.current.failureShown = true;
      setSelected(firstFailure);
    }
  }, [submission.id, firstFailure]);
  const current = cases[selected] || cases[0];
  const running = activeStatuses.has(submission.status);
  const diagnostic =
    !running &&
    submission.mode === 'judge' &&
    submission.firstFailure?.ordinal === current?.ordinal &&
    submission.firstFailure?.status === current?.status
      ? submission.firstFailure
      : undefined;
  const output = diagnostic || current;
  const completedCases = cases.filter(
    (item) => !activeStatuses.has(item.status) && item.status !== 'skipped',
  ).length;
  const passedCases = cases.filter((item) =>
    ['accepted', 'finished'].includes(item.status),
  ).length;
  const skippedCases = cases.filter((item) => item.status === 'skipped').length;
  const runtime =
    submission.runtimeMs ??
    (typeof submission.runtime === 'number' ? submission.runtime * 1000 : null);
  const memory = submission.memoryKb ?? submission.memory;
  return (
    <div className="cs-result-content">
      <div className="cs-result-summary" role="status" aria-live="polite">
        <div>
          <Verdict submission={submission} />
          <span className="cs-result-subtitle">
            {submission.mode === 'run'
              ? t('测试运行', 'Test run')
              : t('正式提交', 'Submission')}
            {submission.mode === 'judge' && !running && (
              <>
                {' '}
                ·{' '}
                {t(
                  `已通过 ${submission.passed} / ${submission.total} 个测试点`,
                  `${submission.passed} / ${submission.total} test cases passed`,
                )}
                {skippedCases > 0 && (
                  <>
                    {' '}
                    · {t(`${skippedCases} 个未运行`, `${skippedCases} skipped`)}
                  </>
                )}
              </>
            )}
            {submission.queuedPosition != null && running && (
              <>
                {' '}
                ·{' '}
                {t(
                  `队列位置 ${submission.queuedPosition}`,
                  `Queue position ${submission.queuedPosition}`,
                )}
              </>
            )}
            {running && submission.total > 0 && (
              <>
                {' '}
                ·{' '}
                {t(
                  `已检查 ${completedCases} / ${submission.total} 个测试点，${passedCases} 个通过`,
                  `Checked ${completedCases} / ${submission.total} test cases, ${passedCases} passed`,
                )}
              </>
            )}
          </span>
        </div>
        <div className="cs-result-tools">
          {runtime != null && (
            <span title={t('运行耗时', 'Runtime')}>
              <Clock3 size={13} /> {Math.round(runtime)} ms
            </span>
          )}
          {memory != null && (
            <span title={t('内存使用', 'Memory')}>
              <HardDrive size={13} /> {(memory / 1024).toFixed(1)} MB
            </span>
          )}
          {running && cancel && (
            <Button
              size="sm"
              variant="outline"
              disabled={cancelling}
              onClick={cancel}
            >
              {cancelling
                ? t('取消中…', 'Cancelling…')
                : t('取消任务', 'Cancel')}
            </Button>
          )}
          {inspect && (
            <Button size="sm" variant="ghost" onClick={inspect}>
              <FileCode2 size={14} />
              {t('本次代码', 'View code')}
            </Button>
          )}
        </div>
      </div>
      {submission.message && (
        <p className="cs-result-message">
          {locale === 'en'
            ? englishMessage(submission.message)
            : submission.message}
        </p>
      )}
      {submission.mode === 'judge' && firstFailure >= 0 && skippedCases > 0 && (
        <p className="cs-result-message">
          {t(
            '发现未通过的测试点，已停止后续评测。下方可查看失败原因。',
            'A test case failed, so judging stopped early. See why below.',
          )}
        </p>
      )}
      {submission.compileOutput && (
        <CopyBlock
          label={t('编译输出', 'Compile output')}
          value={submission.compileOutput}
        />
      )}
      {running && (
        <div className="cs-processing">
          <p role="status">
            {submission.status === 'compiling'
              ? t(
                  '正在编译代码，完成后开始检查测试点。',
                  'Compiling your code. Test cases run once it finishes.',
                )
              : ['pending', 'queued', 'submitting'].includes(submission.status)
                ? t(
                    '提交已收到，正在等待评测资源。你可以继续编辑。',
                    'Submission received, waiting for a judge. You can keep editing.',
                  )
                : submission.mode === 'judge'
                  ? t(
                      '正在逐项检查；全部通过才会显示通过，遇到错误立即停止并显示结果。',
                      'Checking test cases one by one. Accepted shows only if all pass; judging stops at the first failure.',
                    )
                  : t(
                      '正在运行测试，输出会自动更新。',
                      'Running tests. Output updates automatically.',
                    )}
          </p>
        </div>
      )}
      {!!cases.length && (
        <>
          <div
            className="cs-case-tabs"
            role="tablist"
            aria-label={t('逐测试点结果', 'Results by test case')}
          >
            {cases.map((test, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={selected === index}
                aria-label={t(
                  `测试点 ${test.ordinal + 1}：${verdict(test.status, submission.mode)[0]}`,
                  `Test case ${test.ordinal + 1}: ${verdict(test.status, submission.mode)[1]}`,
                )}
                aria-controls={`case-result-${submission.id}`}
                id={`case-${submission.id}-${index}`}
                key={test.ordinal}
                onClick={() => setSelected(index)}
                className={`${selected === index ? 'selected' : ''} ${['accepted', 'finished'].includes(test.status) ? 'success' : activeStatuses.has(test.status) || test.status === 'skipped' ? 'pending' : 'failed'}`}
              >
                <span className="cs-case-dot" />
                {test.hidden ? <LockKeyhole size={12} /> : null}
                {t('测试点', 'Case')} {test.ordinal + 1}
                {' · '}
                {t(...verdict(test.status, submission.mode))}
              </button>
            ))}
          </div>
          {current && (
            <div
              id={`case-result-${submission.id}`}
              role="tabpanel"
              aria-labelledby={`case-${submission.id}-${selected}`}
            >
              <div className="cs-case-meta">
                <strong>
                  {t(...verdict(current.status, submission.mode))}
                </strong>
                {current.runtimeMs != null && (
                  <span>{Math.round(current.runtimeMs)} ms</span>
                )}
                {current.memoryKb != null && (
                  <span>{(current.memoryKb / 1024).toFixed(1)} MB</span>
                )}
              </div>
              {current.hidden && !diagnostic ? (
                <p className="cs-hidden-case">
                  <LockKeyhole size={15} />
                  {t(
                    '隐藏测试点仅显示判题结果和资源用量。',
                    'Hidden test cases show only the verdict and resource usage.',
                  )}
                </p>
              ) : (
                <div className="cs-case-output">
                  {output.stdin !== undefined && (
                    <CopyBlock
                      label={t('输入', 'Input')}
                      value={output.stdin}
                      truncated={diagnostic?.truncated?.stdin}
                    />
                  )}
                  {output.expected !== undefined && (
                    <CopyBlock
                      label={t('期望输出', 'Expected output')}
                      value={output.expected}
                      truncated={diagnostic?.truncated?.expected}
                    />
                  )}
                  {output.stdout !== undefined && (
                    <CopyBlock
                      label={t('实际输出', 'Your output')}
                      value={output.stdout}
                      truncated={diagnostic?.truncated?.stdout}
                    />
                  )}
                  {output.stderr && (
                    <CopyBlock
                      label={t('标准错误', 'Stderr')}
                      value={output.stderr}
                      truncated={diagnostic?.truncated?.stderr}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {!running && !cases.length && !submission.compileOutput && (
        <p className="cs-result-message">
          {submission.status === 'cancelled'
            ? t(
                '任务已取消。当前草稿已保留。',
                'Cancelled. Your draft is kept.',
              )
            : t(
                '本次提交没有逐测试点输出。',
                'This submission has no per-test-case output.',
              )}
        </p>
      )}
    </div>
  );
}

export function SubmissionCodeDialog({
  submission,
  close,
  currentCode,
  language,
  settings,
  restore,
}: {
  submission: OJSubmission | null;
  close: () => void;
  currentCode: string;
  language: Language;
  settings: EditorSettings;
  restore: (submission: OJSubmission) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [view, setView] = useState<'code' | 'diff' | 'result'>('code');
  useEffect(() => setView('code'), [submission?.id]);
  return (
    <Dialog
      open={!!submission}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="cs-history-dialog">
        <DialogHeader>
          <DialogTitle>{t('提交代码', 'Submitted code')}</DialogTitle>
          <DialogDescription>
            {submission && (
              <>
                {submission.language} ·{' '}
                {new Date(submission.created_at).toLocaleString(
                  locale === 'zh' ? 'zh-CN' : 'en-US',
                )}{' '}
                · {t(...verdict(submission.status, submission.mode))}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {submission && (
          <>
            <div className="cs-dialog-toolbar">
              <div className="cs-segmented">
                <button
                  className={view === 'code' ? 'active' : ''}
                  onClick={() => setView('code')}
                >
                  <FileCode2 size={14} />
                  {t('代码', 'Code')}
                </button>
                <button
                  className={view === 'diff' ? 'active' : ''}
                  onClick={() => setView('diff')}
                >
                  <GitCompareArrows size={14} />
                  {t('对比草稿', 'Compare with draft')}
                </button>
                <button
                  className={view === 'result' ? 'active' : ''}
                  onClick={() => setView('result')}
                >
                  <Check size={14} />
                  {t('判题结果', 'Result')}
                </button>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={submission.code === undefined}
                onClick={() => restore(submission)}
              >
                {t('恢复到编辑器', 'Restore to editor')}
              </Button>
            </div>
            {view === 'result' ? (
              <div className="cs-history-result">
                <SubmissionResult submission={submission} />
              </div>
            ) : submission.code === undefined ? (
              <p>
                {t(
                  '该提交未保存可查看的代码。',
                  'No code was saved for this submission.',
                )}
              </p>
            ) : (
              <>
                {view === 'diff' && (
                  <div className="cs-diff-labels">
                    <span>
                      {t('历史提交', 'Submission')} · {submission.language}
                    </span>
                    <span>
                      {t('当前草稿', 'Current draft')} · {language}
                    </span>
                  </div>
                )}
                <div className="cs-history-editor">
                  {view === 'diff' ? (
                    <CodeDiff
                      original={submission.code}
                      modified={currentCode}
                      originalLanguage={submission.language}
                      language={language}
                      settings={settings}
                    />
                  ) : (
                    <CodeEditor
                      key={submission.id}
                      value={submission.code}
                      language={submission.language}
                      settings={settings}
                      readOnly
                      onChange={() => {}}
                      path={`cswork://history/${submission.id}`}
                    />
                  )}
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
