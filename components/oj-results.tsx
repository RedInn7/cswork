'use client';
import { useEffect, useState } from 'react';
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
import type { Language } from '@/lib/problems';

export function Verdict({
  submission,
}: {
  submission: Pick<OJSubmission, 'status' | 'mode'>;
}) {
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
      {verdict(submission.status, submission.mode)}
    </span>
  );
}

export function CopyBlock({ label, value }: { label: string; value: string }) {
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
          aria-label={`复制${label}`}
          title={`复制${label}`}
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
      <pre tabIndex={0}>{value || '（空）'}</pre>
      {error && <small role="status">复制失败，请选中文字后复制。</small>}
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
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [submission.id]);
  const cases = submission.cases || [];
  const current = cases[selected] || cases[0];
  const running = activeStatuses.has(submission.status);
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
            {submission.mode === 'run' ? '测试运行' : '正式提交'}
            {submission.mode === 'judge' && !running && (
              <>
                {' '}
                · {submission.passed} / {submission.total} 个测试点
                {submission.score != null && <> · {submission.score} 分</>}
              </>
            )}
            {submission.queuedPosition != null && running && (
              <> · 队列位置 {submission.queuedPosition}</>
            )}
          </span>
        </div>
        <div className="cs-result-tools">
          {runtime != null && (
            <span title="运行耗时">
              <Clock3 size={13} /> {Math.round(runtime)} ms
            </span>
          )}
          {memory != null && (
            <span title="内存使用">
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
              {cancelling ? '取消中…' : '取消任务'}
            </Button>
          )}
          {inspect && (
            <Button size="sm" variant="ghost" onClick={inspect}>
              <FileCode2 size={14} />
              本次代码
            </Button>
          )}
        </div>
      </div>
      {submission.message && (
        <p className="cs-result-message">{submission.message}</p>
      )}
      {submission.compileOutput && (
        <CopyBlock label="编译输出" value={submission.compileOutput} />
      )}
      {running && !cases.length && (
        <div className="cs-processing">
          <LoaderCircle size={20} className="cs-spin" />
          <p>任务已保存。你可以继续编辑，结果会自动更新。</p>
        </div>
      )}
      {!!cases.length && (
        <>
          <div
            className="cs-case-tabs"
            role="tablist"
            aria-label="逐测试点结果"
          >
            {cases.map((test, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={selected === index}
                aria-controls={`case-result-${submission.id}`}
                id={`case-${submission.id}-${index}`}
                key={test.ordinal}
                onClick={() => setSelected(index)}
                className={`${selected === index ? 'selected' : ''} ${['accepted', 'finished'].includes(test.status) ? 'success' : activeStatuses.has(test.status) || test.status === 'skipped' ? 'pending' : 'failed'}`}
              >
                <span className="cs-case-dot" />
                {test.hidden ? <LockKeyhole size={12} /> : null}测试点{' '}
                {test.ordinal + 1}
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
                <strong>{verdict(current.status, submission.mode)}</strong>
                {current.runtimeMs != null && (
                  <span>{Math.round(current.runtimeMs)} ms</span>
                )}
                {current.memoryKb != null && (
                  <span>{(current.memoryKb / 1024).toFixed(1)} MB</span>
                )}
              </div>
              {current.hidden ? (
                <p className="cs-hidden-case">
                  <LockKeyhole size={15} />
                  隐藏测试点仅显示判题结果和资源用量。
                </p>
              ) : (
                <div className="cs-case-output">
                  {current.stdin !== undefined && (
                    <CopyBlock label="输入" value={current.stdin} />
                  )}
                  {current.expected !== undefined && (
                    <CopyBlock label="期望输出" value={current.expected} />
                  )}
                  {current.stdout !== undefined && (
                    <CopyBlock label="实际输出" value={current.stdout} />
                  )}
                  {current.stderr && (
                    <CopyBlock label="标准错误" value={current.stderr} />
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
            ? '任务已取消。当前草稿已保留。'
            : '本次提交没有逐测试点输出。'}
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
          <DialogTitle>提交代码</DialogTitle>
          <DialogDescription>
            {submission && (
              <>
                {submission.language} ·{' '}
                {new Date(submission.created_at).toLocaleString('zh-CN')} ·{' '}
                {verdict(submission.status, submission.mode)}
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
                  代码
                </button>
                <button
                  className={view === 'diff' ? 'active' : ''}
                  onClick={() => setView('diff')}
                >
                  <GitCompareArrows size={14} />
                  对比草稿
                </button>
                <button
                  className={view === 'result' ? 'active' : ''}
                  onClick={() => setView('result')}
                >
                  <Check size={14} />
                  判题结果
                </button>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={submission.code === undefined}
                onClick={() => restore(submission)}
              >
                恢复到编辑器
              </Button>
            </div>
            {view === 'result' ? (
              <div className="cs-history-result">
                <SubmissionResult submission={submission} />
              </div>
            ) : submission.code === undefined ? (
              <p>该提交未保存可查看的代码。</p>
            ) : (
              <>
                {view === 'diff' && (
                  <div className="cs-diff-labels">
                    <span>历史提交 · {submission.language}</span>
                    <span>当前草稿 · {language}</span>
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
