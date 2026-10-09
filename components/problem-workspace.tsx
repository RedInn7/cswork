'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  usePanelRef,
} from 'react-resizable-panels';
import { problemNeighbors } from '@/lib/problem-sequence';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  Check,
  CircleCheck,
  Tag,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Code2,
  Download,
  FileText,
  History,
  Keyboard,
  Lightbulb,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  Minimize2,
  Play,
  RotateCcw,
  Send,
  Settings2,
  Terminal,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import { OaCompanyBadge, OaEditorial } from './oa-library';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { CodeEditor } from './editor';
import { useIdlePrecompile } from '@/hooks/use-idle-precompile';
import { StatementMarkdown } from './statement-markdown';
import { LeetCodeSamples } from './leetcode-samples';
import type { CodingMode } from '@/lib/coding-mode';
import type { IntelligenceStatus } from '@/lib/editor-intelligence';
import {
  CopyBlock,
  SubmissionCodeDialog,
  SubmissionResult,
  Verdict,
} from './oj-results';
import {
  languages,
  starters,
  problemStatement,
  type ProblemLocale,
  type Language,
  type Problem,
} from '@/lib/problems';
import type { Boot } from '@/lib/types';
import {
  defaultEditorSettings,
  draftStorageKey,
  languageFiles,
  readEditorDraft,
  readEditorSettings,
  settingsKey,
  writeEditorDraft,
  type EditorSettings,
} from '@/lib/editor-settings';
import {
  activeStatuses,
  cancelOJ,
  ojRequest,
  submitOJ,
  type OJProblem,
  type OJSubmission,
  type SubmissionPage,
} from '@/lib/oj-client';
import { FeedbackTiming } from '@/lib/oj-feedback-timing';
import '@/app/editor.css';

type WorkspaceProps = {
  problem: Problem;
  boot: Boot;
  navigate: (view: string, extra?: Record<string, string>) => void;
  ask: (context: Record<string, string>) => void;
  refresh: () => Promise<void>;
};
type ReplaceRequest = {
  code: string;
  language: Language;
  title: string;
  codingMode: CodingMode;
};
const safeLayoutStorage = {
  getItem(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Draft errors are shown separately. */
    }
  },
};

export function ProblemWorkspace(props: WorkspaceProps) {
  return (
    <Workspace
      key={`${props.boot.person?.id || 'guest'}:${props.problem.id}`}
      {...props}
    />
  );
}

function Workspace({
  problem: initialProblem,
  boot,
  navigate,
  ask,
  refresh,
}: WorkspaceProps) {
  const userId = boot.person?.id || 'guest';
  const [problem, setProblem] = useState<OJProblem>(initialProblem);
  const [neighbors, setNeighbors] = useState<{ prev?: string; next?: string }>(
    {},
  );
  // Client-only: the sequence lives in sessionStorage, written by the list the learner came from.
  useEffect(() => setNeighbors(problemNeighbors(problem.id)), [problem.id]);
  const [codingMode, setCodingMode] = useState<CodingMode>('leetcode');
  const [loadedProblem, setLoadedProblem] = useState<OJProblem | null>(null);
  const [practiceRound, setPracticeRound] =
    useState<OJProblem['practiceRound']>(null);
  const [roundRefresh, setRoundRefresh] = useState(0);
  useEffect(() => {
    if (!problem.practiceRound) return;
    let current = true;
    const update = () => {
      void ojRequest<{ currentRound: { id: string; number: number } }>(
        'practice-rounds',
      )
        .then((state) => {
          if (current) setPracticeRound(state.currentRound);
        })
        .catch(() => {
          if (current) setPracticeRound(null);
        });
    };
    update();
    window.addEventListener('focus', update);
    return () => {
      current = false;
      window.removeEventListener('focus', update);
    };
  }, [problem.practiceRound, roundRefresh]);
  const [statementLocale, setStatementLocale] = useState<ProblemLocale>('zh');
  useEffect(() => {
    setStatementLocale(
      safeLayoutStorage.getItem('cswork:problem:locale') === 'en' ? 'en' : 'zh',
    );
  }, []);
  const statement = problemStatement(problem, statementLocale);
  const english = statementLocale === 'en' && !!problem.translations?.en;
  const sourceBody = problem.sourceStatement
    ? english
      ? problem.sourceStatement.descriptionEn ||
        problem.sourceStatement.descriptionZh
      : problem.sourceStatement.descriptionZh ||
        problem.sourceStatement.descriptionEn
    : '';
  const [settings, setSettings] = useState<EditorSettings>(
    defaultEditorSettings,
  );
  const [language, setLanguage] = useState<Language>('python');
  const editorFile =
    codingMode === 'leetcode'
      ? {
          python: 'solution.py',
          cpp: 'solution.cpp',
          java: 'Solution.java',
          go: 'solution.go',
        }[language]
      : languageFiles[language];
  const [code, setCode] = useState(starters.python);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState('准备草稿…');
  const [saveError, setSaveError] = useState('');
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [intelligence, setIntelligence] = useState<IntelligenceStatus>({
    state: 'idle',
    message: '语言服务待启动',
  });
  const suggest = useRef<(() => void) | null>(null);
  const [leftTab, setLeftTab] = useState<'statement' | 'history' | 'editorial'>(
    'statement',
  );
  const [bottomTab, setBottomTab] = useState<'input' | 'result'>('input');
  const [inputMode, setInputMode] = useState<'sample' | 'custom'>('sample');
  const [stdin, setStdin] = useState('');
  const [sampleIndex, setSampleIndex] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [mobilePane, setMobilePane] = useState<'statement' | 'editor'>(
    'statement',
  );
  const [expanded, setExpanded] = useState(true);
  const consolePanel = usePanelRef();
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [replaceRequest, setReplaceRequest] = useState<ReplaceRequest | null>(
    null,
  );
  const [inspected, setInspected] = useState<OJSubmission | null>(null);
  const [history, setHistory] = useState<OJSubmission[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyRevision, setHistoryRevision] = useState(0);
  const [problemError, setProblemError] = useState('');
  const [problemRevision, setProblemRevision] = useState(0);
  useEffect(() => {
    if (userId === 'guest') return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function health() {
      try {
        const status = await ojRequest<{
          available: boolean;
          languageVersions: Partial<Record<Language, string>>;
        }>('status', undefined, controller.signal);
        if (!controller.signal.aborted)
          setProblem((previous) => ({
            ...previous,
            judgeAvailable: status.available,
            languageVersions: status.languageVersions,
          }));
      } catch {
        /* A transient network failure does not discard the current editor state. */
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(health, 15000);
      }
    }
    void health();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [userId]);
  const [submission, setSubmission] = useState<OJSubmission | null>(null);
  const [success, setSuccess] = useState<OJSubmission | null>(null);
  const announcedSuccess = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [pollPaused, setPollPaused] = useState(false);
  const [watchFallback, setWatchFallback] = useState(false);
  const [pollRevision, setPollRevision] = useState(0);
  const [loadingSubmission, setLoadingSubmission] = useState<string | null>(
    null,
  );
  const draft = useRef({ key: '', code: starters.python });
  const draftDirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(false);
  const busyRef = useRef(false);
  const submitController = useRef<AbortController | null>(null);
  const cancelController = useRef<AbortController | null>(null);
  const feedbackTiming = useRef<FeedbackTiming | null>(null);
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);
  const latestDetailRequest = useRef(0);
  const activeStorageKey = `cswork:oj:active:${userId}:${initialProblem.id}`;
  const draftActive = !!submission && activeStatuses.has(submission.status);
  const pending = submitting || draftActive;
  const codeBytes = new TextEncoder().encode(code).byteLength;
  const maxCodeBytes = problem.maxCodeBytes || 65536;
  const maxStdinBytes = problem.maxStdinBytes || 65536;
  const stdinBytes = new TextEncoder().encode(stdin).byteLength;
  const samples = problem.samples?.length
    ? problem.samples
    : [
        {
          name: '样例 1',
          input: problem.sampleIn,
          expectedOutput: problem.sampleOut,
        },
      ];
  const sample = samples[sampleIndex] || samples[0];
  const languageOptions = languages.filter(
    (item) => !problem.languages || problem.languages.includes(item.id),
  );
  const languageUnavailable = !languageOptions.some(
    (item) => item.id === language,
  );
  const accessible =
    !!boot.person &&
    (boot.person.role === 'teacher' ||
      boot.courses.some(
        (course) =>
          course.has_access &&
          (course.id === problem.courseId ||
            course.lessons.some((lesson) => lesson.id === problem.lessonId)),
      ));
  const disabled =
    !ready ||
    recovering ||
    pending ||
    !code.trim() ||
    codeBytes > maxCodeBytes ||
    !accessible ||
    languageUnavailable;
  const cancelPrecompile = useIdlePrecompile({
    enabled:
      !!boot.person &&
      !!loadedProblem &&
      !disabled &&
      problem.judgeAvailable === true &&
      (!problem.codingModes || problem.codingModes.includes(codingMode)),
    userId,
    problemId: problem.id,
    language,
    codingMode,
    code,
    template: templateFor(language, codingMode),
  });
  const horizontalLayout = useDefaultLayout({
    id: `cswork:oj:columns:${userId}:${settings.layout}`,
    panelIds: ['statement', 'workbench'],
    storage: safeLayoutStorage,
  });
  const verticalLayout = useDefaultLayout({
    id: `cswork:oj:console:${userId}`,
    panelIds: ['code', 'console'],
    storage: safeLayoutStorage,
  });

  function showConsole(tab: 'input' | 'result') {
    setBottomTab(tab);
    consolePanel.current?.expand();
  }

  // The mobile editor mounts only when selected; open results after that mount.
  useEffect(() => {
    if (bottomTab === 'result') consolePanel.current?.expand();
  }, [submission?.id, mobilePane, bottomTab, consolePanel]);

  const persistDraft = useCallback((notify = true) => {
    if (!draft.current.key || !draftDirty.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      writeEditorDraft(draft.current.key, draft.current.code);
      draftDirty.current = false;
      if (notify && alive.current) {
        setSaveStatus('草稿已保存到此浏览器');
        setSaveError('');
      }
    } catch {
      if (notify && alive.current) {
        setSaveStatus('草稿未保存');
        setSaveError('浏览器存储不可用。请下载代码备份后再离开。');
      }
    }
  }, []);

  useEffect(() => {
    if (!loadedProblem) return;
    alive.current = true;
    setSettings(readEditorSettings(userId));
    let chosen: Language = 'python';
    const initialMode: CodingMode = loadedProblem.codingModes?.includes(
      'leetcode',
    )
      ? 'leetcode'
      : 'acm';
    setCodingMode(initialMode);
    const template = (lang: Language) =>
      initialMode === 'leetcode'
        ? loadedProblem.leetcodeTemplates?.[lang] || ''
        : starters[lang];
    try {
      const storedLanguage = localStorage.getItem(
        `cswork:editor:language:${userId}`,
      );
      if (languages.some((item) => item.id === storedLanguage))
        chosen = storedLanguage as Language;
      const stored = readEditorDraft(
        userId,
        initialProblem.id,
        chosen,
        initialMode,
        template(chosen),
      );
      draft.current = {
        key: draftStorageKey(userId, initialProblem.id, chosen, initialMode),
        code: stored.code,
      };
      setLanguage(chosen);
      setCode(stored.code);
      setSaveStatus(
        stored.updatedAt ? '已恢复此浏览器的草稿' : '草稿自动保存在此浏览器',
      );
    } catch {
      draft.current = {
        key: draftStorageKey(userId, initialProblem.id, chosen, initialMode),
        code: template(chosen),
      };
      setLanguage(chosen);
      setCode(template(chosen));
      setSaveError('浏览器存储不可用。你仍可编写代码，请及时下载备份。');
    }
    setReady(true);
    const save = () => persistDraft();
    window.addEventListener('pagehide', save);
    const visibility = () => {
      if (document.visibilityState === 'hidden') save();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      persistDraft(false);
      alive.current = false;
      submitController.current?.abort();
      cancelController.current?.abort();
      feedbackTiming.current?.cancel();
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [userId, initialProblem.id, persistDraft, loadedProblem]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);
  useEffect(() => {
    const controller = new AbortController();
    setProblemError('');
    ojRequest<OJProblem>(
      `problems/${initialProblem.id}`,
      undefined,
      controller.signal,
    )
      .then((next) => {
        setProblem(next);
        setLoadedProblem((previous) => previous || next);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setProblemError((e as Error).message);
      });
    return () => controller.abort();
  }, [initialProblem.id, problemRevision]);

  useEffect(() => {
    if (!boot.person) return;
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError('');
    ojRequest<SubmissionPage>(
      `submissions?problemId=${encodeURIComponent(initialProblem.id)}`,
      undefined,
      controller.signal,
    )
      .then((page) => {
        setHistory(page.items);
        setHistoryCursor(page.nextCursor);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setHistoryError((e as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [boot.person?.id, initialProblem.id, historyRevision]);

  useEffect(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(activeStorageKey);
    } catch {
      /* Optional reload recovery. */
    }
    if (!id || !boot.person) return;
    setRecovering(true);
    const controller = new AbortController();
    ojRequest<OJSubmission>(
      `submissions/${encodeURIComponent(id)}`,
      undefined,
      controller.signal,
    )
      .then((item) => {
        setSubmission(item);
        setBottomTab('result');
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            `恢复上次任务失败：${(e as Error).message}。可在提交记录中重新查看。`,
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setRecovering(false);
      });
    return () => controller.abort();
  }, [activeStorageKey, boot.person?.id]);

  useEffect(() => {
    if (!submission || activeStatuses.has(submission.status)) return;
    // The POST acknowledgement may already say accepted but has no test details.
    if (submission.status === 'accepted' && submission.total <= 0) return;
    try {
      sessionStorage.removeItem(activeStorageKey);
    } catch {}
    if (submission.mode !== 'judge' || submission.status !== 'accepted') return;
    if (announcedSuccess.current === submission.id) return;
    announcedSuccess.current = submission.id;
    const receiptKey = `${activeStorageKey}:success`;
    try {
      if (sessionStorage.getItem(receiptKey) === submission.id) return;
      sessionStorage.setItem(receiptKey, submission.id);
    } catch {
      /* Feedback still works when browser storage is unavailable. */
    }
    setSuccess(submission);
    setHistory((items) => [
      submission,
      ...items.filter((item) => item.id !== submission.id),
    ]);
    window.dispatchEvent(new Event('cswork:practice-progress-changed'));
  }, [submission, activeStorageKey]);

  useEffect(() => {
    if (!submission || activeStatuses.has(submission.status)) return;
    // Run after the terminal result's React commit and a browser paint opportunity.
    // Hidden tabs are excluded: a delayed background frame is not visible feedback.
    if (document.visibilityState !== 'visible') {
      feedbackTiming.current?.cancel();
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        if (document.visibilityState === 'visible')
          feedbackTiming.current?.finish(submission.id, submission.status);
        else feedbackTiming.current?.cancel();
      }, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [submission]);

  useEffect(() => {
    if (
      !submission ||
      !activeStatuses.has(submission.status) ||
      pollPaused ||
      submitting ||
      cancelling
    )
      return;
    const controller = new AbortController();
    const watching = Boolean(submission.watchToken) && !watchFallback;
    const read = async () => {
      try {
        const item = await ojRequest<OJSubmission>(
          `submissions/${submission.id}${watching ? `?wait=1&after=${encodeURIComponent(submission.watchToken!)}` : ''}`,
          undefined,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setError('');
        setSubmission(item);
        if (!activeStatuses.has(item.status)) {
          setHistoryRevision((n) => n + 1);
          try {
            sessionStorage.removeItem(activeStorageKey);
          } catch {
            /* Optional recovery state. */
          }
          void latestRefresh.current().catch(() => {});
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          if (watching) setWatchFallback(true);
          else {
            setError((e as Error).message);
            setPollPaused(true);
          }
        }
      }
    };
    const timer = watching ? undefined : setTimeout(read, 750);
    if (watching) void read();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    submission,
    pollPaused,
    pollRevision,
    activeStorageKey,
    watchFallback,
    submitting,
    cancelling,
  ]);

  function updateCode(next: string) {
    if (next === draft.current.code) return;
    draft.current.code = next;
    draftDirty.current = true;
    setCode(next);
    setSaveStatus('正在保存草稿…');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistDraft(), 350);
  }
  function templateFor(next: Language, mode: CodingMode) {
    return mode === 'leetcode'
      ? problem.leetcodeTemplates?.[next] || ''
      : starters[next];
  }
  function switchLanguage(
    next: Language,
    override?: string,
    mode: CodingMode = codingMode,
  ) {
    persistDraft();
    let nextCode = templateFor(next, mode);
    try {
      nextCode = readEditorDraft(
        userId,
        problem.id,
        next,
        mode,
        templateFor(next, mode),
      ).code;
      localStorage.setItem(`cswork:editor:language:${userId}`, next);
    } catch {
      setSaveError('浏览器存储不可用，请及时下载代码备份。');
    }
    draft.current = {
      key: draftStorageKey(userId, problem.id, next, mode),
      code: override ?? nextCode,
    };
    draftDirty.current = override !== undefined;
    setLanguage(next);
    if (mode !== codingMode) {
      setStdin('');
      setInputMode('sample');
    }
    setCodingMode(mode);
    setCode(override ?? nextCode);
    setCursor({ line: 1, column: 1 });
    persistDraft();
  }
  function changeSettings(next: EditorSettings) {
    setSettings(next);
    try {
      localStorage.setItem(settingsKey(userId), JSON.stringify(next));
    } catch {
      setSaveError('无法保存编辑器偏好，请检查浏览器存储设置。');
    }
  }
  function downloadCode() {
    const url = URL.createObjectURL(
      new Blob([code], { type: 'text/plain;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${problem.id}-${codingMode}-${editorFile}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function submit(mode: 'run' | 'judge') {
    if (disabled || busyRef.current) return;
    if (
      mode === 'run' &&
      inputMode === 'custom' &&
      stdinBytes > maxStdinBytes
    ) {
      setError(`自定义输入不能超过 ${Math.floor(maxStdinBytes / 1024)} KB。`);
      return;
    }
    cancelPrecompile();
    feedbackTiming.current ??= new FeedbackTiming(performance);
    feedbackTiming.current.start(mode);
    const controller = new AbortController();
    submitController.current?.abort();
    cancelController.current?.abort();
    submitController.current = controller;
    busyRef.current = true;
    setSubmitting(true);
    setSubmission(null);
    showConsole('result');
    setMobilePane('editor');
    setError('');
    setSuccess(null);
    setPollPaused(false);
    setWatchFallback(false);
    persistDraft();
    const payload = {
      problemId: problem.id,
      language,
      code,
      codingMode,
      mode,
      ...(mode === 'run' && inputMode === 'custom' ? { stdin } : {}),
    };
    const fingerprint = JSON.stringify(payload);
    if (
      !idempotency.current ||
      idempotency.current.fingerprint !== fingerprint
    ) {
      idempotency.current = { fingerprint, key: crypto.randomUUID() };
    }
    try {
      const detail = await submitOJ(
        {
          ...payload,
          idempotencyKey: idempotency.current.key,
        },
        controller.signal,
        (result) => {
          if (!alive.current || controller.signal.aborted) return;
          idempotency.current = null;
          feedbackTiming.current?.bind(result.id);
          setSubmission({
            id: result.id,
            // A POST receipt has no result details; even a reused terminal job must
            // remain queryable if its first detail request fails.
            status: activeStatuses.has(result.status)
              ? result.status
              : 'pending',
            problem_id: problem.id,
            language,
            code,
            codingMode,
            mode,
            passed: 0,
            total: 0,
            created_at: Date.now(),
          });
          try {
            sessionStorage.setItem(activeStorageKey, result.id);
          } catch {
            /* Server history remains available. */
          }
          setBottomTab('result');
          setMobilePane('editor');
          setHistoryRevision((n) => n + 1);
        },
      );
      if (alive.current && !controller.signal.aborted) {
        setSubmission(detail);
        setRoundRefresh((value) => value + 1);
        if (!activeStatuses.has(detail.status))
          void latestRefresh.current().catch(() => {});
      }
    } catch (e) {
      if (alive.current && !controller.signal.aborted)
        setError((e as Error).message);
    } finally {
      if (submitController.current === controller) {
        busyRef.current = false;
        if (alive.current) setSubmitting(false);
      }
    }
  }
  async function cancel() {
    if (!submission || cancelling || cancelController.current) return;
    const controller = new AbortController();
    cancelController.current = controller;
    const submittingRequest = submitController.current;
    submittingRequest?.abort();
    submitController.current = null;
    busyRef.current = false;
    setSubmitting(false);
    feedbackTiming.current?.cancel();
    setCancelling(true);
    setError('');
    try {
      const item = await cancelOJ(
        submission.id,
        submittingRequest,
        controller.signal,
      );
      if (!alive.current || controller.signal.aborted) return;
      setSubmission(item);
      setPollPaused(false);
      setHistoryRevision((n) => n + 1);
      if (!activeStatuses.has(item.status)) {
        try {
          sessionStorage.removeItem(activeStorageKey);
        } catch {}
      }
    } catch (e) {
      if (alive.current && !controller.signal.aborted)
        setError((e as Error).message);
    } finally {
      if (cancelController.current === controller) {
        cancelController.current = null;
        if (alive.current) setCancelling(false);
      }
    }
  }
  async function inspect(item: OJSubmission) {
    const request = ++latestDetailRequest.current;
    setLoadingSubmission(item.id);
    setHistoryError('');
    try {
      const detail =
        item.code !== undefined
          ? item
          : await ojRequest<OJSubmission>(`submissions/${item.id}`);
      if (latestDetailRequest.current === request && alive.current)
        setInspected(detail);
    } catch (e) {
      if (latestDetailRequest.current === request && alive.current)
        setHistoryError((e as Error).message);
    } finally {
      if (latestDetailRequest.current === request && alive.current)
        setLoadingSubmission(null);
    }
  }
  async function loadMoreHistory() {
    if (!historyCursor || historyLoading) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const page = await ojRequest<SubmissionPage>(
        `submissions?problemId=${encodeURIComponent(problem.id)}&cursor=${encodeURIComponent(historyCursor)}`,
      );
      setHistory((items) => [
        ...items,
        ...page.items.filter(
          (item) => !items.some((existing) => existing.id === item.id),
        ),
      ]);
      setHistoryCursor(page.nextCursor);
    } catch (e) {
      setHistoryError((e as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }

  const description = (
    <section className="cs-statement-pane">
      <div
        className="cs-pane-tabs"
        role="tablist"
        aria-label={english ? 'Problem information' : '题目资料'}
      >
        <button
          role="tab"
          aria-selected={leftTab === 'statement'}
          className={leftTab === 'statement' ? 'active' : ''}
          onClick={() => setLeftTab('statement')}
        >
          <FileText size={15} />
          {english ? 'Description' : '题目描述'}
        </button>
        <button
          role="tab"
          aria-selected={leftTab === 'history'}
          className={leftTab === 'history' ? 'active' : ''}
          onClick={() => setLeftTab('history')}
        >
          <History size={15} />
          {english ? 'Submissions' : '提交记录'}
        </button>
        {problem.id.startsWith('oa-') && (
          <button
            role="tab"
            className={leftTab === 'editorial' ? 'active' : ''}
            aria-selected={leftTab === 'editorial'}
            onClick={() => setLeftTab('editorial')}
          >
            <BookOpen size={15} />
            {english ? 'Solution' : '题解'}
          </button>
        )}
      </div>
      <div className="cs-statement-scroll">
        {problem.id.startsWith('oa-') && (
          <OaCompanyBadge
            key={problem.id}
            problemId={problem.id}
            english={english}
          />
        )}
        {leftTab === 'editorial' ? (
          <OaEditorial key={problem.id} problemId={problem.id} />
        ) : leftTab === 'statement' ? (
          <>
            <div className="cs-statement-heading">
              <h2>
                {problem.id.match(/^lc-(\d+)$/)?.[1]
                  ? `${problem.id.slice(3)}. `
                  : ''}
                {statement.title}
              </h2>
              {history.some(
                (item) =>
                  item.mode === 'judge' &&
                  item.status === 'accepted' &&
                  (!problem.practiceRound ||
                    (!!practiceRound &&
                      item.practiceRoundId === practiceRound.id)),
              ) && (
                <span className="cs-statement-solved">
                  {english ? 'Solved' : '已通过'}
                  <CircleCheck size={18} />
                </span>
              )}
            </div>
            <div className="cs-statement-tools">
              <span
                className={`cs-statement-pill cs-statement-difficulty ${problem.difficulty === '中等' ? 'medium' : problem.difficulty === '困难' ? 'hard' : 'easy'}`}
              >
                {english
                  ? { 简单: 'Easy', 中等: 'Medium', 困难: 'Hard' }[
                      problem.difficulty
                    ]
                  : problem.difficulty}
              </span>
              {problem.tags.some(
                (tag) => !/灵神|题单|leetcode|来源/i.test(tag),
              ) && (
                <button
                  className="cs-statement-pill"
                  aria-expanded={topicsOpen}
                  aria-controls="problem-topics"
                  onClick={() => setTopicsOpen((open) => !open)}
                >
                  <Tag size={15} />
                  {english ? 'Topics' : '主题'}
                </button>
              )}
              {!sourceBody && statement.hints.length > 0 && (
                <button
                  className="cs-statement-pill"
                  aria-expanded={hintsOpen}
                  aria-controls="problem-hints"
                  onClick={() => {
                    setHintsOpen((open) => !open);
                    setHintCount((count) => Math.max(count, 1));
                  }}
                >
                  <Lightbulb size={15} />
                  {english ? 'Hint' : '提示'}
                </button>
              )}
              <select
                className="cs-statement-language"
                aria-label="题面语言"
                value={statementLocale}
                onChange={(event) => {
                  const next = event.target.value as ProblemLocale;
                  setStatementLocale(next);
                  safeLayoutStorage.setItem('cswork:problem:locale', next);
                  setHintCount(0);
                  setHintsOpen(false);
                }}
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </div>
            {topicsOpen && (
              <div className="cs-statement-topics" id="problem-topics">
                {problem.tags
                  .filter((tag) => !/灵神|题单|leetcode|来源/i.test(tag))
                  .map((tag) => (
                    <span className="cs-statement-pill" key={tag}>
                      {tag}
                    </span>
                  ))}
              </div>
            )}
            {statementLocale === 'en' && !english && (
              <output className="cs-statement-language-note">
                English translation is not available yet. Showing the Chinese
                statement. / 本题暂无英文题面，显示中文。
              </output>
            )}
            <div className="cs-problem-prose">
              {sourceBody && (
                <>
                  <StatementMarkdown body={sourceBody} />
                  {codingMode === 'acm' && (
                    <h3>
                      {english ? 'cswork submission format' : '本站提交格式'}
                    </h3>
                  )}
                </>
              )}
              {codingMode === 'acm' && (
                <>
                  {!sourceBody && (
                    <p style={{ whiteSpace: 'pre-wrap' }}>
                      {statement.description}
                    </p>
                  )}
                  <h3>{english ? 'Input' : '输入格式'}</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{statement.input}</p>
                  <h3>{english ? 'Output' : '输出格式'}</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{statement.output}</p>
                  <h3>{english ? 'Examples' : '样例'}</h3>
                  {samples.map((item, index) => (
                    <div key={item.name}>
                      <h4>
                        {samples.length > 1
                          ? english
                            ? `Example ${index + 1}`
                            : item.name
                          : null}
                      </h4>
                      <CopyBlock
                        label={english ? 'Input' : '输入'}
                        value={item.input}
                      />
                      <CopyBlock
                        label={english ? 'Output' : '输出'}
                        value={item.expectedOutput}
                      />
                    </div>
                  ))}
                  {!sourceBody && (
                    <p style={{ whiteSpace: 'pre-wrap' }}>
                      {statement.explanation}
                    </p>
                  )}
                </>
              )}
            </div>
            {!sourceBody && hintsOpen && statement.hints.length > 0 && (
              <div className="cs-hints" id="problem-hints">
                <div>
                  <Lightbulb size={17} />
                  <strong>{english ? 'Hints' : '思路提示'}</strong>
                  <span>
                    {Math.min(hintCount, statement.hints.length)} /{' '}
                    {statement.hints.length}
                  </span>
                </div>
                {statement.hints.slice(0, hintCount).map((hint, index) => (
                  <p key={hint}>
                    <b>{index + 1}</b>
                    {hint}
                  </p>
                ))}
                <button
                  disabled={hintCount >= statement.hints.length}
                  onClick={() => setHintCount((n) => n + 1)}
                >
                  {hintCount >= statement.hints.length
                    ? english
                      ? 'All hints shown'
                      : '已展开全部提示'
                    : english
                      ? 'Show next hint'
                      : '需要时，展开下一条'}
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="cs-history-pane">
            <div className="cs-history-heading">
              <span>
                {english
                  ? 'All rounds: submissions and runs'
                  : '所有轮次的提交与测试运行'}
              </span>
              <button
                title="刷新提交记录"
                aria-label="刷新提交记录"
                onClick={() => setHistoryRevision((n) => n + 1)}
                disabled={historyLoading}
              >
                <RotateCcw size={14} />
              </button>
            </div>
            {historyError && (
              <div className="cs-inline-error" role="alert">
                {historyError}
                <button onClick={() => setHistoryRevision((n) => n + 1)}>
                  重试
                </button>
              </div>
            )}
            {!history.length && !historyLoading && (
              <div className="cs-empty">
                <History size={26} />
                <h3>{english ? 'No submissions yet' : '还没有提交记录'}</h3>
                <p>
                  {english
                    ? 'Run the examples, then submit against all test cases.'
                    : '运行样例检查思路，再提交全部测试点。'}
                </p>
              </div>
            )}
            {history.map((item) => (
              <div key={item.id} className="cs-history-row">
                <button onClick={() => inspect(item)}>
                  <Verdict submission={item} />
                  <span>
                    {item.mode === 'run'
                      ? english
                        ? 'Test run'
                        : '测试运行'
                      : `${item.passed} / ${item.total} ${english ? 'passed' : '通过'}`}{' '}
                    · {item.language}
                    {' · '}
                    {item.codingMode === 'leetcode' ? 'LeetCode' : 'ACM'}
                    {item.practiceRoundNumber
                      ? ` · ${english ? 'Round ' + item.practiceRoundNumber : '第 ' + item.practiceRoundNumber + ' 轮'}`
                      : ''}
                  </span>
                  <time dateTime={new Date(item.created_at).toISOString()}>
                    {new Date(item.created_at).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => inspect(item)}
                  disabled={loadingSubmission === item.id}
                >
                  {loadingSubmission === item.id ? (
                    <LoaderCircle size={14} className="cs-spin" />
                  ) : (
                    <Code2 size={14} />
                  )}
                  代码
                </Button>
              </div>
            ))}
            {historyLoading && (
              <div className="cs-loading" role="status">
                <LoaderCircle size={18} className="cs-spin" />
                正在加载…
              </div>
            )}
            {historyCursor && (
              <Button
                variant="outline"
                className="cs-load-more"
                disabled={historyLoading}
                onClick={loadMoreHistory}
              >
                加载更早的记录
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );

  const workbench = (
    <section className="cs-workbench" data-theme={settings.theme}>
      <div className="cs-code-caption">
        <Code2 size={15} />
        <strong>代码</strong>
        <span>{editorFile}</span>
        <div className="cs-editor-run-actions">
          <Button
            variant="ghost"
            disabled={
              disabled || (inputMode === 'custom' && stdinBytes > maxStdinBytes)
            }
            onClick={() => submit('run')}
            title="Ctrl / ⌘ + Enter"
          >
            {pending && submission?.mode === 'run' ? (
              <LoaderCircle size={15} className="cs-spin" />
            ) : (
              <Play size={15} />
            )}
            {english ? 'Run' : '运行'}
          </Button>
          <Button
            disabled={disabled}
            onClick={() => submit('judge')}
            title="Ctrl / ⌘ + Shift + Enter"
          >
            {submitting || (draftActive && submission?.mode === 'judge') ? (
              <LoaderCircle size={15} className="cs-spin" />
            ) : (
              <Send size={15} />
            )}
            {submitting
              ? english
                ? 'Submitting'
                : '正在提交'
              : english
                ? 'Submit'
                : '提交'}
          </Button>
        </div>
      </div>
      <div className="cs-editor-toolbar">
        <div className="cs-editor-controls">
          <select
            aria-label="提交模式"
            value={codingMode}
            disabled={!ready}
            onChange={(event) =>
              switchLanguage(
                language,
                undefined,
                event.target.value as CodingMode,
              )
            }
          >
            {(problem.codingModes || ['acm']).includes('leetcode') && (
              <option value="leetcode">LeetCode</option>
            )}
            <option value="acm">ACM</option>
          </select>
          <select
            aria-label="编程语言"
            value={language}
            onChange={(event) => switchLanguage(event.target.value as Language)}
          >
            {languageUnavailable && (
              <option value={language}>{language}（本题不支持）</option>
            )}
            {languageOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {problem.languageVersions?.[item.id]
                  ? ` · ${problem.languageVersions[item.id]}`
                  : ''}
              </option>
            ))}
          </select>
          <button
            aria-label="下载当前代码"
            title="下载当前代码"
            onClick={downloadCode}
          >
            <Download size={15} />
          </button>
          <button
            aria-label="重置为语言模板"
            title="重置为语言模板"
            onClick={() =>
              setReplaceRequest({
                language,
                codingMode,
                code: templateFor(language, codingMode),
                title: '重置当前语言的代码？',
              })
            }
          >
            <RotateCcw size={15} />
          </button>
          <button
            aria-label="编辑器设置"
            title="编辑器设置"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={16} />
          </button>
          <button
            title="自动补全默认开启；点击可手动触发（Ctrl + Space）"
            className="cs-suggest-trigger"
            onClick={() => suggest.current?.()}
          >
            触发补全
          </button>
        </div>
      </div>
      <Group
        orientation="vertical"
        className="cs-code-console"
        {...verticalLayout}
      >
        <Panel id="code" defaultSize="70%" minSize="48px">
          <div className="cs-code-panel">
            <div className="cs-code-area">
              {ready ? (
                <CodeEditor
                  key={`${codingMode}:${language}`}
                  value={code}
                  language={language}
                  problemId={problem.id}
                  onIntelligenceStatus={setIntelligence}
                  onSuggestReady={(action) => {
                    suggest.current = action;
                  }}
                  onChange={updateCode}
                  path={`cswork://draft/${encodeURIComponent(userId)}/${problem.id}/${codingMode}/${editorFile}`}
                  settings={settings}
                  onRun={() => submit('run')}
                  onSubmit={() => submit('judge')}
                  onSave={persistDraft}
                  onCursor={(line, column) => setCursor({ line, column })}
                />
              ) : (
                <div className="cs-editor-loading">正在恢复草稿…</div>
              )}
            </div>
            <div className="cs-editor-status">
              <span
                role="status"
                title={intelligence.message}
                className={`cs-intelligence-status ${intelligence.state === 'unavailable' ? 'cs-unsaved' : ''}`}
              >
                {intelligence.message}
              </span>
              <span className={saveError ? 'cs-unsaved' : ''}>
                <i />
                {saveStatus}
              </span>
              <span>
                Ln {cursor.line}, Col {cursor.column}
              </span>
              <span>
                {(codeBytes / 1024).toFixed(1)} / {maxCodeBytes / 1024} KB
              </span>
              <button
                aria-label="键盘快捷键"
                title="键盘快捷键"
                onClick={() => setShortcutOpen(true)}
              >
                <Keyboard size={14} />
              </button>
            </div>
          </div>
        </Panel>
        <Separator
          className="cs-separator horizontal"
          aria-label="调整编辑器与控制台高度"
        />
        <Panel
          id="console"
          panelRef={consolePanel}
          defaultSize="30%"
          minSize="100px"
          collapsible
          collapsedSize="42px"
          onResize={() => {
            // ResizeObserver runs after the panel store applies its new layout.
            // A short expanded panel must not be mistaken for a collapsed one.
            setConsoleCollapsed(consolePanel.current?.isCollapsed() ?? false);
          }}
        >
          <section
            className={`cs-console ${consoleCollapsed ? 'is-collapsed' : ''}`}
          >
            <div className="cs-console-header">
              <div
                className="cs-pane-tabs"
                role="tablist"
                aria-label="测试控制台"
              >
                <button
                  role="tab"
                  aria-selected={bottomTab === 'input'}
                  className={bottomTab === 'input' ? 'active' : ''}
                  onClick={() => showConsole('input')}
                >
                  <Terminal size={14} />
                  测试用例
                </button>
                <button
                  role="tab"
                  aria-selected={bottomTab === 'result'}
                  className={bottomTab === 'result' ? 'active' : ''}
                  onClick={() => showConsole('result')}
                >
                  {pending ? (
                    <LoaderCircle size={14} className="cs-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  运行结果
                </button>
              </div>
              <button
                className="cs-console-toggle"
                aria-label={
                  consoleCollapsed ? '展开测试控制台' : '收起测试控制台'
                }
                aria-expanded={!consoleCollapsed}
                title={consoleCollapsed ? '展开测试控制台' : '收起测试控制台'}
                onClick={() => {
                  if (consolePanel.current?.isCollapsed())
                    consolePanel.current.expand();
                  else consolePanel.current?.collapse();
                }}
              >
                {consoleCollapsed ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
            </div>
            <div className="cs-console-scroll" hidden={consoleCollapsed}>
              {bottomTab === 'input' ? (
                <>
                  <div className="cs-input-toolbar">
                    <div className="cs-segmented">
                      <button
                        className={inputMode === 'sample' ? 'active' : ''}
                        onClick={() => setInputMode('sample')}
                      >
                        题目样例
                      </button>
                      <button
                        className={inputMode === 'custom' ? 'active' : ''}
                        onClick={() => setInputMode('custom')}
                      >
                        自定义输入
                      </button>
                    </div>
                    {inputMode === 'custom' && (
                      <span
                        className={
                          stdinBytes > maxStdinBytes ? 'cs-over-limit' : ''
                        }
                      >
                        {stdinBytes} / {maxStdinBytes} B
                      </span>
                    )}
                  </div>
                  {inputMode === 'sample' ? (
                    <>
                      <div className="cs-input-toolbar">
                        {samples.length > 1 && (
                          <select
                            aria-label="查看公开样例"
                            value={sampleIndex}
                            onChange={(event) =>
                              setSampleIndex(Number(event.target.value))
                            }
                          >
                            {samples.map((item, index) => (
                              <option key={item.name} value={index}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <span>运行时检查全部 {samples.length} 个公开样例</span>
                      </div>
                      {codingMode === 'leetcode' ? (
                        <LeetCodeSamples
                          problemId={problem.id}
                          sample={sample}
                          english={english}
                        />
                      ) : (
                        <div className="cs-sample-pair">
                          <CopyBlock label="标准输入" value={sample.input} />
                          <CopyBlock
                            label="期望输出"
                            value={sample.expectedOutput}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <textarea
                        className="cs-custom-input"
                        aria-label={
                          codingMode === 'leetcode'
                            ? '自定义函数参数'
                            : '自定义标准输入'
                        }
                        value={stdin}
                        onChange={(event) => setStdin(event.target.value)}
                        placeholder={
                          codingMode === 'leetcode'
                            ? '按题目参数顺序，每行输入一个 JSON 值。例如两数之和：\n[2,7,11,15]\n9'
                            : '在这里输入数据，支持空输入。'
                        }
                        spellCheck={false}
                      />
                      <p className="cs-console-note">
                        {codingMode === 'leetcode' &&
                          (problem.leetcodeInputHelp
                            ? problem.leetcodeInputHelp[english ? 'en' : 'zh']
                            : ['lc-297', 'lc-449'].includes(problem.id)
                              ? 'Codec 题输入一行 JSON 层序树数组，例如 [1,2,3,null,4]，平台会分别验证序列化和反序列化。'
                              : '每行一个 JSON 参数；设计题第一行操作名数组，第二行对应参数数组。树和链表使用原题的数组表示。')}
                        自定义输入展示程序输出；提交时会运行题目的全部测试点。
                      </p>
                    </>
                  )}
                </>
              ) : submitting && !submission ? (
                <div
                  className="cs-processing cs-submitting"
                  role="status"
                  aria-live="polite"
                >
                  <LoaderCircle size={20} className="cs-spin" />
                  <p>{english ? 'Submitting…' : '正在提交…'}</p>
                </div>
              ) : submission ? (
                <SubmissionResult
                  submission={submission}
                  cancel={cancel}
                  cancelling={cancelling}
                  inspect={() => inspect(submission)}
                />
              ) : (
                <div className="cs-empty compact">
                  <Terminal size={25} />
                  <p>先运行一次，看看你的代码表现。</p>
                  <small>Ctrl / ⌘ + Enter 运行测试</small>
                </div>
              )}
            </div>
          </section>
        </Panel>
      </Group>
      {saveError && (
        <div className="cs-inline-error" role="alert">
          {saveError}
          <button onClick={downloadCode}>下载代码</button>
        </div>
      )}
      {error && (
        <div className="cs-inline-error" role="alert">
          {error}
          {pollPaused ? (
            <button
              onClick={() => {
                setError('');
                setPollPaused(false);
                setWatchFallback(false);
                setPollRevision((n) => n + 1);
              }}
            >
              重新查询
            </button>
          ) : (
            <button aria-label="关闭错误提示" onClick={() => setError('')}>
              <X size={14} />
            </button>
          )}
        </div>
      )}
      {codeBytes > maxCodeBytes && (
        <div className="cs-inline-error" role="alert">
          代码超过 {maxCodeBytes / 1024} KB 限制，请缩短后再提交。
        </div>
      )}
    </section>
  );

  return (
    <div
      className={`cs-workspace ${expanded ? 'expanded' : ''}`}
      data-theme={settings.theme}
    >
      <div className="cs-workspace-header">
        <div className="cs-workspace-heading">
          <button
            className="cs-back"
            aria-label="返回题库"
            onClick={() =>
              navigate(
                'problems',
                problem.id.startsWith('oa-') ? { library: 'oa' } : undefined,
              )
            }
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className="cs-workspace-eyebrow">
              cswork / {english ? 'Practice' : '题库'}
              {practiceRound
                ? ` · ${english ? 'Round ' + practiceRound.number : '第 ' + practiceRound.number + ' 轮'}`
                : ''}
            </span>
            <h1>{statement.title}</h1>
          </div>
        </div>
        <div className="cs-workspace-navigation">
          {(neighbors.prev || neighbors.next) && (
            <div className="cs-problem-steps">
              <button
                className="cs-top-button"
                disabled={!neighbors.prev}
                aria-label={english ? 'Previous problem' : '上一题'}
                title={english ? 'Previous problem' : '上一题'}
                onClick={() =>
                  neighbors.prev &&
                  navigate('problem', { problem: neighbors.prev })
                }
              >
                <ChevronLeft size={15} />
                <span>{english ? 'Prev' : '上一题'}</span>
              </button>
              <button
                className="cs-top-button"
                disabled={!neighbors.next}
                aria-label={english ? 'Next problem' : '下一题'}
                title={english ? 'Next problem' : '下一题'}
                onClick={() =>
                  neighbors.next &&
                  navigate('problem', { problem: neighbors.next })
                }
              >
                <span>{english ? 'Next' : '下一题'}</span>
                <ChevronRight size={15} />
              </button>
            </div>
          )}
          <button
            className="cs-top-button"
            aria-label="向老师提问"
            title="向老师提问"
            onClick={() =>
              ask({
                lessonId: problem.lessonId,
                ...(submission ? { submissionId: submission.id } : {}),
              })
            }
          >
            <MessageSquare size={15} />
            <span>向老师提问</span>
          </button>
          <button
            className="cs-top-button"
            aria-label="相关课程"
            title="相关课程"
            onClick={() => navigate('lesson', { lesson: problem.lessonId })}
          >
            <BookOpen size={15} />
            <span>相关课程</span>
          </button>
          <button
            className="cs-top-button"
            aria-label={expanded ? '退出专注模式' : '进入专注模式'}
            title={expanded ? '退出专注模式' : '进入专注模式'}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>
      {success && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSuccess(null);
          }}
        >
          <DialogContent
            className="cs-accepted-dialog"
            showCloseButton={false}
            aria-describedby={undefined}
          >
            <div className="cs-accepted-banner">
              <DialogTitle className="cs-accepted-title">Accepted</DialogTitle>
              <button
                className="cs-accepted-dismiss"
                aria-label={
                  english ? 'Dismiss success message' : '收起通过提示'
                }
                onClick={() => setSuccess(null)}
              >
                <X size={18} />
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {problemError &&
        (boot.person ? (
          <div className="cs-workspace-notice" role="alert">
            题目配置加载失败：{problemError}
            <button onClick={() => setProblemRevision((n) => n + 1)}>
              重新加载
            </button>
          </div>
        ) : (
          // Signed out: retrying cannot succeed, so offer the one action that can.
          <div className="cs-workspace-notice" role="status">
            登录后即可查看完整题面并提交代码。
            <button
              onClick={() =>
                window.dispatchEvent(new Event('cswork:auth-required'))
              }
            >
              登录 / 注册
            </button>
          </div>
        ))}
      {!accessible && !(problemError && !boot.person) && (
        <div className="cs-workspace-notice">
          {english
            ? boot.person
              ? 'Enroll in the course to run and submit solutions. Your code is still saved as you edit.'
              : 'Sign in and enroll in the course to run and submit solutions. Your code is still saved as you edit.'
            : `${
                boot.person
                  ? '请先开通相关课程，再运行和提交解答。'
                  : '登录并开通课程后，即可运行和提交解答。'
              } 当前代码可以继续编辑和保存。`}
        </div>
      )}
      {problem.judgeAvailable === false && (
        <div className="cs-workspace-notice">
          {english
            ? `${boot.services.judge ? 'The judge is recovering; submissions will queue.' : 'The judge is not configured.'} Your code stays saved in this browser.`
            : `${boot.services.judge ? '判题服务正在恢复，提交会排队等待。' : '判题服务尚未配置。'}你的代码会继续保存在浏览器中。`}
        </div>
      )}
      {narrow && (
        <div className="cs-mobile-nav">
          <button
            className={mobilePane === 'statement' ? 'active' : ''}
            onClick={() => setMobilePane('statement')}
          >
            <FileText size={15} />
            {english ? 'Description' : '题面与记录'}
          </button>
          <button
            className={mobilePane === 'editor' ? 'active' : ''}
            onClick={() => setMobilePane('editor')}
          >
            <Code2 size={15} />
            {english ? 'Code' : '代码与结果'}
          </button>
        </div>
      )}
      <div className="cs-workspace-body">
        {narrow ? (
          <div className="cs-mobile-body">
            {mobilePane === 'statement' ? description : workbench}
          </div>
        ) : (
          <Group
            orientation={settings.layout}
            className={`cs-main-panels ${settings.layout}`}
            {...horizontalLayout}
          >
            <Panel
              id="statement"
              defaultSize="45%"
              minSize={settings.layout === 'vertical' ? '140px' : '24%'}
            >
              {description}
            </Panel>
            <Separator
              className={`cs-separator ${settings.layout === 'horizontal' ? 'vertical' : 'horizontal'}`}
              aria-label="调整题面与编辑器大小"
            />
            <Panel
              id="workbench"
              defaultSize="55%"
              minSize={settings.layout === 'vertical' ? '250px' : '35%'}
            >
              {workbench}
            </Panel>
          </Group>
        )}
      </div>
      <SettingsDialog
        open={settingsOpen}
        close={() => setSettingsOpen(false)}
        settings={settings}
        change={changeSettings}
      />
      <Dialog open={shortcutOpen} onOpenChange={setShortcutOpen}>
        <DialogContent className="cs-settings-dialog">
          <DialogHeader>
            <DialogTitle>键盘快捷键</DialogTitle>
            <DialogDescription>
              在编辑器内使用。Mac 用 ⌘，Windows / Linux 用 Ctrl。
            </DialogDescription>
          </DialogHeader>
          <div className="cs-shortcuts">
            {[
              ['运行样例 / 自定义输入', 'Ctrl / ⌘ + Enter'],
              ['提交全部测试点', 'Ctrl / ⌘ + Shift + Enter'],
              ['保存当前草稿', 'Ctrl / ⌘ + S'],
              ['代码补全', '默认自动开启；Ctrl + Space（或点击「触发补全」）'],
              ['参数提示', 'Ctrl / ⌘ + Shift + Space'],
              ['查找', 'Ctrl / ⌘ + F'],
              ['命令面板', 'F1'],
              ['注释 / 取消注释', 'Ctrl / ⌘ + /'],
              ['切换 Tab 焦点导航', 'Ctrl + M / Mac: Ctrl + Shift + M'],
            ].map(([label, keys]) => (
              <div key={label}>
                <span>{label}</span>
                <kbd>{keys}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!replaceRequest}
        onOpenChange={(open) => {
          if (!open) setReplaceRequest(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{replaceRequest?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              这会替换 {replaceRequest?.language}{' '}
              当前草稿。需要保留时，请先取消并下载代码备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>保留当前代码</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (replaceRequest)
                  switchLanguage(
                    replaceRequest.language,
                    replaceRequest.code,
                    replaceRequest.codingMode,
                  );
                setReplaceRequest(null);
              }}
            >
              确认替换
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SubmissionCodeDialog
        submission={inspected}
        close={() => setInspected(null)}
        currentCode={code}
        language={language}
        settings={settings}
        restore={(item) => {
          if (item.code === undefined) return;
          setInspected(null);
          setReplaceRequest({
            code: item.code,
            language: item.language,
            codingMode: item.codingMode || 'acm',
            title: '恢复这份提交代码？',
          });
        }}
      />
    </div>
  );
}

function SettingsDialog({
  open,
  close,
  settings,
  change,
}: {
  open: boolean;
  close: () => void;
  settings: EditorSettings;
  change: (next: EditorSettings) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
    >
      <DialogContent className="cs-settings-dialog">
        <DialogHeader>
          <DialogTitle>让编辑器适合你</DialogTitle>
          <DialogDescription>
            设置会保存在此浏览器，随时可以调整。
          </DialogDescription>
        </DialogHeader>
        <div className="cs-settings-form">
          <label>
            <span>外观</span>
            <select
              value={settings.theme}
              onChange={(event) =>
                change({
                  ...settings,
                  theme: event.target.value as EditorSettings['theme'],
                })
              }
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </label>
          <label>
            <span>字号</span>
            <select
              value={settings.fontSize}
              onChange={(event) =>
                change({
                  ...settings,
                  fontSize: Number(event.target.value),
                })
              }
            >
              {[12, 13, 14, 15, 16, 18, 20].map((size) => (
                <option value={size} key={size}>
                  {size} px
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tab 宽度</span>
            <select
              value={settings.tabSize}
              onChange={(event) =>
                change({
                  ...settings,
                  tabSize: Number(event.target.value) as 2 | 4,
                })
              }
            >
              <option value="2">2 个空格</option>
              <option value="4">4 个空格</option>
            </select>
          </label>
          <label>
            <span>工作区布局</span>
            <select
              value={settings.layout}
              onChange={(event) =>
                change({
                  ...settings,
                  layout: event.target.value as EditorSettings['layout'],
                })
              }
            >
              <option value="horizontal">题面在左，代码在右</option>
              <option value="vertical">题面在上，代码在下</option>
            </select>
          </label>
          <label>
            <span>自动换行</span>
            <input
              type="checkbox"
              checked={settings.wordWrap}
              onChange={(event) =>
                change({ ...settings, wordWrap: event.target.checked })
              }
            />
          </label>
          <label>
            <span>代码缩略图</span>
            <input
              type="checkbox"
              checked={settings.minimap}
              onChange={(event) =>
                change({ ...settings, minimap: event.target.checked })
              }
            />
          </label>
        </div>
        <p className="cs-settings-note">
          编辑器支持语法高亮、括号配对、查找和多光标。编译错误与运行结果由判题服务返回。
        </p>
      </DialogContent>
    </Dialog>
  );
}
