'use client';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  usePanelRef,
} from 'react-resizable-panels';
import {
  nextUnsolved,
  problemNeighbors,
  rememberProblemSequence,
} from '@/lib/problem-sequence';
import { practiceStats, type Activity } from './practice-calendar';
import { localDay, readTodayTarget } from '@/lib/study-plan';
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
  ExternalLink,
  FileText,
  History,
  Keyboard,
  Lightbulb,
  LoaderCircle,
  Lock,
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
import { CompanyTags } from './company-tags';
import { NotesTab, ProblemMarks, ProblemNotes, useProblemNote } from './problem-notes';
import {
  ExamAcceptedDialog,
  MockExamBar,
  MockExamDone,
  useMockExam,
} from './mock-exam-bar';
import { reportWindow } from '@/lib/mock-oa';
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
import { ProblemTimer, formatClock, stopTimer } from './problem-timer';
import { ACM_IO_TEMPLATES } from '@/lib/acm-io-templates';
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
  starterTemplates,
  problemStatement,
  type ProblemLocale,
  type Language,
  type ProblemStatement,
  type ProblemSummary,
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
  hintUnlocked,
  leetcodeSolutionsUrl,
  ojRequest,
  submitOJ,
  type OJProblem,
  type OJSubmission,
  type SubmissionPage,
} from '@/lib/oj-client';
import { FeedbackTiming } from '@/lib/oj-feedback-timing';
import { track } from '@/lib/analytics';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import '@/app/editor.css';
import '@/app/workbench-tools.css';

type WorkspaceProps = {
  problem: ProblemSummary;
  boot: Boot;
  navigate: (view: string, extra?: Record<string, string>) => void;
  ask: (context: Record<string, string>) => void;
  refresh: () => Promise<void>;
  /** ?mock=<session id>: the problem is a question of a timed mock OA. */
  mock?: string;
};
type ReplaceRequest = {
  code: string;
  language: Language;
  title: string;
  codingMode: CodingMode;
};
const blankStatement = (title: string): ProblemStatement => ({
  title,
  description: '',
  input: '',
  output: '',
  explanation: '',
  hints: [],
});
/** The catalogue entry until `problems/:id` answers: header fields only, no statement. */
const summaryProblem = (p: ProblemSummary): OJProblem => ({
  ...blankStatement(p.title),
  sampleIn: '',
  sampleOut: '',
  lessonId: '',
  timeLimit: 0,
  memoryLimit: 0,
  ...p,
  translations: p.titleEn ? { en: blankStatement(p.titleEn) } : undefined,
});
/** An untouched ACM starter in either language can be swapped for the current one. */
function isStarter(code: string, language: Language) {
  return Object.values(starterTemplates).some((set) => set[language] === code);
}
/** Analytics calls the formal judge "submit", like its button. */
const judgeMode = (mode: string) => (mode === 'judge' ? 'submit' : 'run');
/** ojRequest's HTTP code, 'timeout' or 'network'. */
const failureStatus = (e: unknown) =>
  String((e as { status?: number | string }).status ?? 'unknown');
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
  mock,
}: WorkspaceProps) {
  const userId = boot.person?.id || 'guest';
  // A running mock OA hides solutions, hints and the way to other problems.
  const exam = useMockExam(mock, userId, initialProblem.id);
  const examMode = !!exam?.running;
  // A mock question starts from the template, not this browser's earlier draft of it.
  const [draftId] = useState(() =>
    exam ? `${initialProblem.id}:mock:${exam.session.id}` : initialProblem.id,
  );
  // In the exam the Submissions tab lists only this exam's attempts.
  const examFrom = exam?.running ? reportWindow(exam.session).from : 0;
  const [problem, setProblem] = useState(() => summaryProblem(initialProblem));
  const [neighbors, setNeighbors] = useState<
    ReturnType<typeof problemNeighbors>
  >({});
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
  const locale = useLocale();
  const t = useT();
  // The toggle's pick wins; otherwise an English site shows the English statement when there is one.
  const [statementPick, setStatementPick] = useState<ProblemLocale | null>(
    null,
  );
  useEffect(() => {
    // The statement toggle's last pick applies until the site language is switched: setLocale
    // clears it, and re-reading on that switch lets an open problem follow the site language.
    const stored = safeLayoutStorage.getItem('cswork:problem:locale');
    setStatementPick(stored === 'en' || stored === 'zh' ? stored : null);
  }, [locale]);
  const statementLocale: ProblemLocale =
    statementPick ??
    (locale === 'en' && problem.translations?.en ? 'en' : 'zh');
  // Read by the draft loader, which runs once per problem load.
  const statementLocaleRef = useRef(statementLocale);
  statementLocaleRef.current = statementLocale;
  const statement = problemStatement(problem, statementLocale);
  const english = statementLocale === 'en' && !!problem.translations?.en;
  // Labels that followed an English statement still do; otherwise the site language decides.
  const uiEnglish = english || locale === 'en';
  const say = (message: string) =>
    locale === 'en' ? englishMessage(message) : message;
  const sourceBody = problem.sourceStatement
    ? english
      ? problem.sourceStatement.descriptionEn ||
        problem.sourceStatement.descriptionZh
      : problem.sourceStatement.descriptionZh ||
        problem.sourceStatement.descriptionEn
    : '';
  const solutionsUrl = leetcodeSolutionsUrl(
    problem.sourceStatement?.sourceUrl || problem.sourceStatement?.sourceEnUrl,
    uiEnglish,
  );
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
  const [saveStatus, setSaveStatus] = useState<[string, string]>([
    '准备草稿…',
    'Preparing draft…',
  ]);
  const [saveError, setSaveError] = useState<[string, string] | null>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [intelligence, setIntelligence] = useState<IntelligenceStatus>({
    state: 'idle',
    message: '语言服务待启动',
  });
  const intelligenceText =
    intelligence.state === 'idle'
      ? t('语言服务待启动', 'Language service not started')
      : say(intelligence.message);
  const suggest = useRef<(() => void) | null>(null);
  const runButton = useRef<HTMLButtonElement>(null);
  const [leftTab, setLeftTab] = useState<
    'statement' | 'history' | 'editorial' | 'notes'
  >('statement');
  // Private to an account, and closed during a mock exam like the editorial.
  const note = useProblemNote(
    boot.person && !examMode ? userId : null,
    initialProblem.id,
  );
  const [bottomTab, setBottomTab] = useState<'input' | 'result'>('input');
  const [inputMode, setInputMode] = useState<'sample' | 'custom'>('sample');
  const [stdin, setStdin] = useState('');
  const [sampleIndex, setSampleIndex] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);
  // Line 500 hint: earned by a failed formal submission, or shown on request after a confirm.
  const [routeHint, setRouteHint] = useState<'locked' | 'earned' | 'asked'>(
    'locked',
  );
  const [routeHintConfirm, setRouteHintConfirm] = useState(false);
  const routeHintSummary = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [mobilePane, setMobilePane] = useState<'statement' | 'editor'>(
    'statement',
  );
  const [expanded, setExpanded] = useState(true);
  // Focus mode hides the top bar (and its sign-in button), so the notice carries the one entry.
  const signIn = expanded && !boot.person && (
    <button onClick={() => window.dispatchEvent(new Event('cswork:auth-required'))}>
      {t('登录 / 注册', 'Sign in / Sign up')}
    </button>
  );
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
  const shownHistory = history.filter((item) => item.created_at >= examFrom);
  const [problemError, setProblemError] = useState('');
  const [problemRevision, setProblemRevision] = useState(0);
  useEffect(() => {
    if (userId === 'guest') return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    async function health() {
      clearTimeout(timer);
      // Hidden tabs stop polling; becoming visible refreshes at once.
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      let available = false;
      try {
        const status = await ojRequest<{
          available: boolean;
          languageVersions: Partial<Record<Language, string>>;
        }>('status', undefined, controller.signal);
        available = status.available;
        if (!controller.signal.aborted)
          setProblem((previous) => ({
            ...previous,
            judgeAvailable: status.available,
            languageVersions: status.languageVersions,
          }));
      } catch {
        /* A transient network failure does not discard the current editor state. */
      } finally {
        busy = false;
        // A healthy judge rarely flips; recheck sooner while it is down or unreachable.
        if (!controller.signal.aborted)
          timer = setTimeout(health, available ? 60000 : 15000);
      }
    }
    void health();
    document.addEventListener('visibilitychange', health);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', health);
    };
  }, [userId]);
  const [submission, setSubmission] = useState<OJSubmission | null>(null);
  // The server counts this round's history; the live verdict counts too. Once lit, it stays.
  useEffect(() => {
    if (problem.hintEarned || hintUnlocked(submission ? [submission] : []))
      setRouteHint((state) => (state === 'locked' ? 'earned' : state));
  }, [problem.hintEarned, submission]);
  const [success, setSuccess] = useState<OJSubmission | null>(null);
  const [solveSeconds, setSolveSeconds] = useState<number | null>(null);
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
  // Bootstrap carries no statements; this stands in until `problems/:id` answers.
  const problemLoading = !loadedProblem && !problemError && (
    <div className="cs-loading" role="status">
      <LoaderCircle size={18} className="cs-spin" />
      {t('正在加载题目…', 'Loading the problem…')}
    </div>
  );
  const languageOptions = languages.filter(
    (item) => !problem.languages || problem.languages.includes(item.id),
  );
  const languageUnavailable = !languageOptions.some(
    (item) => item.id === language,
  );
  const accessible =
    !!boot.person &&
    (boot.person.role === 'teacher' ||
      // OA and library problems judge free for verified accounts.
      (!!problem.freeJudge && boot.person.verified) ||
      (!!problem.courseId && !!boot.courseAccess?.includes(problem.courseId)) ||
      boot.courses.some(
        (course) =>
          course.has_access &&
          (course.id === problem.courseId ||
            course.lessons.some((lesson) => lesson.id === problem.lessonId)),
      ));
  // The server only sends courses this viewer may see (canSeeCourse).
  const courseVisible = boot.courses.some((course) =>
    course.lessons.some((lesson) => lesson.id === problem.lessonId),
  );
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
        setSaveStatus(['草稿已保存到此浏览器', 'Draft saved in this browser']);
        setSaveError(null);
      }
    } catch {
      if (notify && alive.current) {
        setSaveStatus(['草稿未保存', 'Draft not saved']);
        setSaveError([
          '浏览器存储不可用。请下载代码备份后再离开。',
          'Browser storage is unavailable. Download a backup of your code before you leave.',
        ]);
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
        : starterTemplates[statementLocaleRef.current][lang];
    try {
      const storedLanguage = localStorage.getItem(
        `cswork:editor:language:${userId}`,
      );
      if (languages.some((item) => item.id === storedLanguage))
        chosen = storedLanguage as Language;
      const stored = readEditorDraft(
        userId,
        draftId,
        chosen,
        initialMode,
        template(chosen),
      );
      // A saved but untouched starter follows the current statement language.
      if (initialMode === 'acm' && isStarter(stored.code, chosen))
        stored.code = template(chosen);
      draft.current = {
        key: draftStorageKey(userId, draftId, chosen, initialMode),
        code: stored.code,
      };
      setLanguage(chosen);
      setCode(stored.code);
      setSaveStatus(
        stored.updatedAt
          ? ['已恢复此浏览器的草稿', 'Restored your draft from this browser']
          : [
              '草稿自动保存在此浏览器',
              'Drafts save automatically in this browser',
            ],
      );
    } catch {
      draft.current = {
        key: draftStorageKey(userId, draftId, chosen, initialMode),
        code: template(chosen),
      };
      setLanguage(chosen);
      setCode(template(chosen));
      setSaveError([
        '浏览器存储不可用。你仍可编写代码，请及时下载备份。',
        'Browser storage is unavailable. You can still write code; download a backup soon.',
      ]);
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
  }, [userId, draftId, persistDraft, loadedProblem]);

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
            t(
              `恢复上次任务失败：${(e as Error).message}。可在提交记录中重新查看。`,
              `Couldn't restore your last run: ${say((e as Error).message)}. You can reopen it from Submissions.`,
            ),
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
    // The exam clock replaces the problem timer during a mock OA; an AC stops it.
    const seconds = examMode ? null : stopTimer(userId, initialProblem.id);
    track('judge_accept', {
      problem_id: initialProblem.id,
      language: submission.language,
      seconds,
    });
    setSolveSeconds(seconds);
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
        if (document.visibilityState !== 'visible') {
          feedbackTiming.current?.cancel();
          return;
        }
        // finish() answers once per click, so re-renders and remounts never repeat it.
        const ms = feedbackTiming.current?.finish(
          submission.id,
          submission.status,
        );
        if (ms == null) return;
        const { created_at, startedAt, finishedAt } = submission;
        track('judge_result', {
          mode: judgeMode(submission.mode),
          problem_id: problem.id,
          language: submission.language,
          verdict: submission.status,
          passed: submission.passed,
          total: submission.total,
          duration_ms: Math.round(ms),
          // Server clock: received → finished, and → claimed by a worker.
          server_ms: finishedAt == null ? null : finishedAt - created_at,
          queue_ms: startedAt == null ? null : startedAt - created_at,
        });
      }, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [submission, problem.id]);

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
          track('judge_error', {
            mode: judgeMode(submission.mode),
            problem_id: problem.id,
            stage: watching ? 'watch' : 'poll',
            status: failureStatus(e),
          });
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
    problem.id,
  ]);

  function updateCode(next: string) {
    if (next === draft.current.code) return;
    draft.current.code = next;
    draftDirty.current = true;
    setCode(next);
    setSaveStatus(['正在保存草稿…', 'Saving draft…']);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistDraft(), 350);
  }
  function debugWithCase(input: string) {
    setInputMode('custom');
    setStdin(input);
    showConsole('input');
    // Run stays mounted across console tabs; focus it before this button unmounts.
    runButton.current?.focus();
    track('fail_case_debug', {
      problem_id: problem.id,
      language,
      verdict: submission?.status,
    });
  }
  function applyIoTemplate(id: string) {
    const template = ACM_IO_TEMPLATES.find((item) => item.id === id);
    const text = template?.code[language];
    if (!template || !text || text === code) return;
    // Templates are whole programs (main, class Main, package main): splicing one
    // into edited code can't compile, so it replaces the draft, after a confirm.
    if (isStarter(code, language)) updateCode(text);
    else
      setReplaceRequest({
        language,
        codingMode,
        code: text,
        title: t(
          `换成「${template.title.zh}」模板？`,
          `Switch to the "${template.title.en}" template?`,
        ),
      });
  }
  function templateFor(next: Language, mode: CodingMode) {
    return mode === 'leetcode'
      ? problem.leetcodeTemplates?.[next] || ''
      : starterTemplates[statementLocale][next];
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
        draftId,
        next,
        mode,
        templateFor(next, mode),
      ).code;
      if (mode === 'acm' && isStarter(nextCode, next))
        nextCode = templateFor(next, mode);
      localStorage.setItem(`cswork:editor:language:${userId}`, next);
    } catch {
      setSaveError([
        '浏览器存储不可用，请及时下载代码备份。',
        'Browser storage is unavailable. Download a backup of your code soon.',
      ]);
    }
    draft.current = {
      key: draftStorageKey(userId, draftId, next, mode),
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
      setSaveError([
        '无法保存编辑器偏好，请检查浏览器存储设置。',
        "Couldn't save editor preferences. Check your browser storage settings.",
      ]);
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
      setError(
        t(
          `自定义输入不能超过 ${Math.floor(maxStdinBytes / 1024)} KB。`,
          `Custom input can't exceed ${Math.floor(maxStdinBytes / 1024)} KB.`,
        ),
      );
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
          track('judge_submit', {
            mode: judgeMode(mode),
            problem_id: problem.id,
            language,
          });
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
      if (alive.current && !controller.signal.aborted) {
        setError((e as Error).message);
        track('judge_error', {
          mode: judgeMode(mode),
          problem_id: problem.id,
          stage: 'submit',
          status: failureStatus(e),
        });
      }
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
        aria-label={uiEnglish ? 'Problem information' : '题目资料'}
      >
        <button
          role="tab"
          aria-selected={leftTab === 'statement'}
          className={leftTab === 'statement' ? 'active' : ''}
          onClick={() => setLeftTab('statement')}
        >
          <FileText size={15} />
          {uiEnglish ? 'Description' : '题目描述'}
        </button>
        <button
          role="tab"
          aria-selected={leftTab === 'history'}
          className={leftTab === 'history' ? 'active' : ''}
          onClick={() => setLeftTab('history')}
        >
          <History size={15} />
          {uiEnglish ? 'Submissions' : '提交记录'}
        </button>
        {note.enabled && (
          <NotesTab
            note={note}
            active={leftTab === 'notes'}
            onSelect={() => setLeftTab('notes')}
            english={uiEnglish}
          />
        )}
        {problem.id.startsWith('oa-') && !examMode && (
          <button
            role="tab"
            className={leftTab === 'editorial' ? 'active' : ''}
            aria-selected={leftTab === 'editorial'}
            onClick={() => setLeftTab('editorial')}
          >
            <BookOpen size={15} />
            {uiEnglish ? 'Solution' : '题解'}
          </button>
        )}
      </div>
      <div className="cs-statement-scroll">
        {problem.id.startsWith('oa-') && (
          <OaCompanyBadge
            key={problem.id}
            problemId={problem.id}
            english={uiEnglish}
          />
        )}
        {leftTab === 'notes' && note.enabled ? (
          <ProblemNotes note={note} english={uiEnglish} />
        ) : leftTab === 'editorial' ? (
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
              {note.enabled && (
                <ProblemMarks problemId={problem.id} english={uiEnglish} />
              )}
              {shownHistory.some(
                (item) =>
                  item.mode === 'judge' &&
                  item.status === 'accepted' &&
                  (!problem.practiceRound ||
                    (!!practiceRound &&
                      item.practiceRoundId === practiceRound.id)),
              ) && (
                <span className="cs-statement-solved">
                  {uiEnglish ? 'Solved' : '已通过'}
                  <CircleCheck size={18} />
                </span>
              )}
            </div>
            <div className="cs-statement-tools">
              <span
                className={`cs-statement-pill cs-statement-difficulty ${problem.difficulty === '中等' ? 'medium' : problem.difficulty === '困难' ? 'hard' : 'easy'}`}
              >
                {uiEnglish
                  ? { 简单: 'Easy', 中等: 'Medium', 困难: 'Hard' }[
                      problem.difficulty
                    ]
                  : problem.difficulty}
              </span>
              {!examMode &&
                problem.tags.some(
                  (tag) => !/灵神|题单|leetcode|来源/i.test(tag),
                ) && (
                  <button
                    className="cs-statement-pill"
                    aria-expanded={topicsOpen}
                    aria-controls="problem-topics"
                    onClick={() => setTopicsOpen((open) => !open)}
                  >
                    <Tag size={15} />
                    {uiEnglish ? 'Topics' : '主题'}
                  </button>
                )}
              {!examMode && !sourceBody && statement.hints.length > 0 && (
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
                  {uiEnglish ? 'Hint' : '提示'}
                </button>
              )}
              <select
                className="cs-statement-language"
                aria-label={t('题面语言', 'Statement language')}
                value={statementLocale}
                onChange={(event) => {
                  const next = event.target.value as ProblemLocale;
                  setStatementPick(next);
                  safeLayoutStorage.setItem('cswork:problem:locale', next);
                  // Untouched starter comments follow the statement language; edited code never changes.
                  if (
                    codingMode === 'acm' &&
                    isStarter(draft.current.code, language)
                  )
                    updateCode(starterTemplates[next][language]);
                  setHintCount(0);
                  setHintsOpen(false);
                }}
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </div>
            {/* Company reports are a hint too: never during a mock. */}
            {!examMode && !!problem.companies?.length && (
              <CompanyTags companies={problem.companies} english={uiEnglish} />
            )}
            {!examMode && topicsOpen && (
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
                {t(
                  'English translation is not available yet. Showing the Chinese statement. / 本题暂无英文题面，显示中文。',
                  'English translation is not available yet. Showing the Chinese statement.',
                )}
              </output>
            )}
            <div className="cs-problem-prose">
              {problemLoading}
              {sourceBody && (
                <>
                  <StatementMarkdown body={sourceBody} />
                  {codingMode === 'acm' && (
                    <h3>
                      {uiEnglish ? 'cswork submission format' : '本站提交格式'}
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
                  <h3>{uiEnglish ? 'Input' : '输入格式'}</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{statement.input}</p>
                  <h3>{uiEnglish ? 'Output' : '输出格式'}</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{statement.output}</p>
                  <h3>{uiEnglish ? 'Examples' : '样例'}</h3>
                  {samples.map((item, index) => (
                    <div key={item.name}>
                      <h4>
                        {samples.length > 1
                          ? uiEnglish
                            ? `Example ${index + 1}`
                            : item.name
                          : null}
                      </h4>
                      <CopyBlock
                        label={uiEnglish ? 'Input' : '输入'}
                        value={item.input}
                      />
                      <CopyBlock
                        label={uiEnglish ? 'Output' : '输出'}
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
            {!examMode && !sourceBody && hintsOpen && statement.hints.length > 0 && (
              <div className="cs-hints" id="problem-hints">
                <div>
                  <Lightbulb size={17} />
                  <strong>{uiEnglish ? 'Hints' : '思路提示'}</strong>
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
                    ? uiEnglish
                      ? 'All hints shown'
                      : '已展开全部提示'
                    : uiEnglish
                      ? 'Show next hint'
                      : '需要时，展开下一条'}
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
            {problem.curatedHint && !examMode && (
              <section
                className="cs-route-hint"
                data-lit={routeHint === 'locked' ? undefined : ''}
                aria-labelledby="route-hint-title"
              >
                <div className="cs-route-hint-head">
                  <span className="cs-route-hint-lamp" aria-hidden="true" />
                  <strong id="route-hint-title">
                    {uiEnglish ? 'Hint' : '思路提示'}
                  </strong>
                  <span
                    className="cs-route-hint-roundel"
                    title={uiEnglish ? 'Line 500' : '500 路'}
                  >
                    500
                  </span>
                </div>
                <div aria-live="polite">
                  {routeHint !== 'locked' ? (
                    <details
                      className="cs-route-hint-body"
                      open={routeHint === 'asked' || undefined}
                    >
                      <summary ref={routeHintSummary}>
                        {uiEnglish ? 'Show the approach' : '展开思路'}
                        <ChevronDown size={14} aria-hidden="true" />
                      </summary>
                      {/* Both languages: the English names the patterns interviews use. */}
                      <p lang={uiEnglish ? 'en' : 'zh'}>
                        {problem.curatedHint[uiEnglish ? 'en' : 'zh']}
                      </p>
                      <p
                        className="cs-route-hint-alt"
                        lang={uiEnglish ? 'zh' : 'en'}
                      >
                        {problem.curatedHint[uiEnglish ? 'zh' : 'en']}
                      </p>
                      {solutionsUrl && (
                        <a
                          href={solutionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {uiEnglish ? 'Solutions on LeetCode' : 'LeetCode 题解'}
                          <ExternalLink size={13} aria-hidden="true" />
                        </a>
                      )}
                    </details>
                  ) : (
                    <div className="cs-route-hint-locked">
                      <Lock size={14} aria-hidden="true" />
                      <p>
                        {uiEnglish
                          ? 'Unlocks after your first failed submission. Give it a real try first.'
                          : '第一次提交未通过后解锁，先自己认真试一次。'}
                      </p>
                      <button onClick={() => setRouteHintConfirm(true)}>
                        {uiEnglish ? 'Show anyway' : '仍要查看'}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="cs-history-pane">
            <div className="cs-history-heading">
              <span>
                {examMode
                  ? uiEnglish
                    ? 'This exam: submissions and runs'
                    : '本场考试的提交与测试运行'
                  : uiEnglish
                    ? 'All rounds: submissions and runs'
                    : '所有轮次的提交与测试运行'}
              </span>
              <button
                title={t('刷新提交记录', 'Refresh submissions')}
                aria-label={t('刷新提交记录', 'Refresh submissions')}
                onClick={() => setHistoryRevision((n) => n + 1)}
                disabled={historyLoading}
              >
                <RotateCcw size={14} />
              </button>
            </div>
            {historyError && (
              <div className="cs-inline-error" role="alert">
                {say(historyError)}
                <button onClick={() => setHistoryRevision((n) => n + 1)}>
                  {t('重试', 'Retry')}
                </button>
              </div>
            )}
            {!shownHistory.length && !historyLoading && (
              <div className="cs-empty">
                <History size={26} />
                <h3>{uiEnglish ? 'No submissions yet' : '还没有提交记录'}</h3>
                <p>
                  {uiEnglish
                    ? 'Run the examples, then submit against all test cases.'
                    : '运行样例检查思路，再提交全部测试点。'}
                </p>
              </div>
            )}
            {shownHistory.map((item) => (
              <div key={item.id} className="cs-history-row">
                <button onClick={() => inspect(item)}>
                  <Verdict submission={item} />
                  <span>
                    {item.mode === 'run'
                      ? uiEnglish
                        ? 'Test run'
                        : '测试运行'
                      : `${item.passed} / ${item.total} ${uiEnglish ? 'passed' : '通过'}`}{' '}
                    · {item.language}
                    {' · '}
                    {item.codingMode === 'leetcode' ? 'LeetCode' : 'ACM'}
                    {item.practiceRoundNumber
                      ? ` · ${uiEnglish ? 'Round ' + item.practiceRoundNumber : '第 ' + item.practiceRoundNumber + ' 轮'}`
                      : ''}
                  </span>
                  <time dateTime={new Date(item.created_at).toISOString()}>
                    {new Date(item.created_at).toLocaleString(
                      locale === 'zh' ? 'zh-CN' : 'en-US',
                      {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )}
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
                  {t('代码', 'Code')}
                </Button>
              </div>
            ))}
            {historyLoading && (
              <div className="cs-loading" role="status">
                <LoaderCircle size={18} className="cs-spin" />
                {t('正在加载…', 'Loading…')}
              </div>
            )}
            {/* Once an attempt from before the exam is hidden, older pages hold none of this exam's. */}
            {historyCursor && shownHistory.length === history.length && (
              <Button
                variant="outline"
                className="cs-load-more"
                disabled={historyLoading}
                onClick={loadMoreHistory}
              >
                {t('加载更早的记录', 'Load older submissions')}
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
        <strong>{t('代码', 'Code')}</strong>
        <span>{editorFile}</span>
        <div className="cs-editor-run-actions">
          <Button
            ref={runButton}
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
            {uiEnglish ? 'Run' : '运行'}
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
              ? uiEnglish
                ? 'Submitting'
                : '正在提交'
              : uiEnglish
                ? 'Submit'
                : '提交'}
          </Button>
        </div>
      </div>
      <div className="cs-editor-toolbar">
        <div className="cs-editor-controls">
          <select
            aria-label={t('提交模式', 'Submission mode')}
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
            aria-label={t('编程语言', 'Programming language')}
            value={language}
            onChange={(event) => switchLanguage(event.target.value as Language)}
          >
            {languageUnavailable && (
              <option value={language}>
                {t(
                  `${language}（本题不支持）`,
                  `${language} (not supported for this problem)`,
                )}
              </option>
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
            aria-label={t('下载当前代码', 'Download code')}
            title={t('下载当前代码', 'Download code')}
            onClick={downloadCode}
          >
            <Download size={15} />
          </button>
          {codingMode === 'acm' && (
            <select
              className="cs-io-templates"
              aria-label={t('使用输入模板', 'Use an input template')}
              title={t(
                '常见输入形态的完整读写程序，会替换当前代码（改过的代码先确认）',
                'A whole read/write program for a common input shape. It replaces your code (edited code asks first)',
              )}
              value=""
              disabled={!ready}
              onChange={(event) => applyIoTemplate(event.target.value)}
            >
              <option value="" disabled>
                {t('输入模板', 'Input templates')}
              </option>
              {ACM_IO_TEMPLATES.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                  title={t(item.note.zh, item.note.en)}
                >
                  {t(item.title.zh, item.title.en)}
                </option>
              ))}
            </select>
          )}
          <button
            aria-label={t('重置为语言模板', 'Reset to template')}
            title={t('重置为语言模板', 'Reset to template')}
            onClick={() =>
              setReplaceRequest({
                language,
                codingMode,
                code: templateFor(language, codingMode),
                title: t(
                  '重置当前语言的代码？',
                  'Reset the code for this language?',
                ),
              })
            }
          >
            <RotateCcw size={15} />
          </button>
          <button
            aria-label={t('编辑器设置', 'Editor settings')}
            title={t('编辑器设置', 'Editor settings')}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={16} />
          </button>
          <button
            title={t(
              '自动补全默认开启；点击可手动触发（Ctrl + Space）',
              'Autocomplete is on by default; click to trigger it (Ctrl + Space)',
            )}
            className="cs-suggest-trigger"
            onClick={() => suggest.current?.()}
          >
            {t('触发补全', 'Autocomplete')}
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
                <div className="cs-editor-loading">
                  {t('正在恢复草稿…', 'Restoring draft…')}
                </div>
              )}
            </div>
            <div className="cs-editor-status">
              <span
                role="status"
                title={intelligenceText}
                className={`cs-intelligence-status ${intelligence.state === 'unavailable' ? 'cs-unsaved' : ''}`}
              >
                {intelligenceText}
              </span>
              <span className={saveError ? 'cs-unsaved' : ''}>
                <i />
                {t(...saveStatus)}
              </span>
              <span>
                Ln {cursor.line}, Col {cursor.column}
              </span>
              <span>
                {(codeBytes / 1024).toFixed(1)} / {maxCodeBytes / 1024} KB
              </span>
              <button
                aria-label={t('键盘快捷键', 'Keyboard shortcuts')}
                title={t('键盘快捷键', 'Keyboard shortcuts')}
                onClick={() => setShortcutOpen(true)}
              >
                <Keyboard size={14} />
              </button>
            </div>
          </div>
        </Panel>
        <Separator
          className="cs-separator horizontal"
          aria-label={t('调整编辑器与控制台高度', 'Resize editor and console')}
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
                aria-label={t('测试控制台', 'Test console')}
              >
                <button
                  role="tab"
                  aria-selected={bottomTab === 'input'}
                  className={bottomTab === 'input' ? 'active' : ''}
                  onClick={() => showConsole('input')}
                >
                  <Terminal size={14} />
                  {t('测试用例', 'Test cases')}
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
                  {t('运行结果', 'Result')}
                </button>
              </div>
              <button
                className="cs-console-toggle"
                aria-label={
                  consoleCollapsed
                    ? t('展开测试控制台', 'Expand test console')
                    : t('收起测试控制台', 'Collapse test console')
                }
                aria-expanded={!consoleCollapsed}
                title={
                  consoleCollapsed
                    ? t('展开测试控制台', 'Expand test console')
                    : t('收起测试控制台', 'Collapse test console')
                }
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
                        {t('题目样例', 'Examples')}
                      </button>
                      <button
                        className={inputMode === 'custom' ? 'active' : ''}
                        onClick={() => setInputMode('custom')}
                      >
                        {t('自定义输入', 'Custom input')}
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
                    !loadedProblem ? (
                      problemLoading || (
                        <div className="cs-loading" role="status">
                          {boot.person
                            ? t(
                                '题目加载失败，样例暂不可用。',
                                "The problem didn't load, so the examples aren't available.",
                              )
                            : t(
                                '登录后可查看样例。',
                                'Sign in to see the examples.',
                              )}
                        </div>
                      )
                    ) : (
                      <>
                        <div className="cs-input-toolbar">
                          {samples.length > 1 && (
                            <select
                              aria-label={t(
                                '查看公开样例',
                                'Choose an example',
                              )}
                              value={sampleIndex}
                              onChange={(event) =>
                                setSampleIndex(Number(event.target.value))
                              }
                            >
                              {samples.map((item, index) => (
                                <option key={item.name} value={index}>
                                  {t(item.name, `Example ${index + 1}`)}
                                </option>
                              ))}
                            </select>
                          )}
                          <span>
                            {t(
                              `运行时检查全部 ${samples.length} 个公开样例`,
                              samples.length === 1
                                ? 'Run checks the public example'
                                : `Run checks all ${samples.length} public examples`,
                            )}
                          </span>
                        </div>
                        {codingMode === 'leetcode' ? (
                          <LeetCodeSamples
                            problemId={problem.id}
                            sample={sample}
                            english={uiEnglish}
                          />
                        ) : (
                          <div className="cs-sample-pair">
                            <CopyBlock
                              label={t('标准输入', 'Stdin')}
                              value={sample.input}
                            />
                            <CopyBlock
                              label={t('期望输出', 'Expected output')}
                              value={sample.expectedOutput}
                            />
                          </div>
                        )}
                      </>
                    )
                  ) : (
                    <>
                      <textarea
                        className="cs-custom-input"
                        aria-label={
                          codingMode === 'leetcode'
                            ? t('自定义函数参数', 'Custom function arguments')
                            : t('自定义标准输入', 'Custom stdin')
                        }
                        value={stdin}
                        onChange={(event) => setStdin(event.target.value)}
                        placeholder={
                          codingMode === 'leetcode'
                            ? t(
                                '按题目参数顺序，每行输入一个 JSON 值。例如两数之和：\n[2,7,11,15]\n9',
                                'One JSON value per line, in parameter order. For Two Sum:\n[2,7,11,15]\n9',
                              )
                            : t(
                                '在这里输入数据，支持空输入。',
                                'Enter input here. Empty input is allowed.',
                              )
                        }
                        spellCheck={false}
                      />
                      <p className="cs-console-note">
                        {codingMode === 'leetcode' &&
                          (problem.leetcodeInputHelp
                            ? problem.leetcodeInputHelp[uiEnglish ? 'en' : 'zh']
                            : ['lc-297', 'lc-449'].includes(problem.id)
                              ? t(
                                  'Codec 题输入一行 JSON 层序树数组，例如 [1,2,3,null,4]，平台会分别验证序列化和反序列化。',
                                  'For Codec problems, enter the tree on one line as a JSON level-order array, e.g. [1,2,3,null,4]. Serialization and deserialization are checked separately.',
                                )
                              : t(
                                  '每行一个 JSON 参数；设计题第一行操作名数组，第二行对应参数数组。树和链表使用原题的数组表示。',
                                  'One JSON argument per line. For design problems, line 1 is the array of operation names and line 2 the array of their arguments. Trees and linked lists use the array form of the original problem.',
                                ))}
                        {t(
                          '自定义输入展示程序输出；提交时会运行题目的全部测试点。',
                          ' Custom input shows your program output; Submit runs all test cases.',
                        )}
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
                  <p>{uiEnglish ? 'Submitting…' : '正在提交…'}</p>
                </div>
              ) : submission ? (
                <SubmissionResult
                  submission={submission}
                  cancel={cancel}
                  cancelling={cancelling}
                  inspect={() => inspect(submission)}
                  onUseInput={codingMode === 'acm' ? debugWithCase : undefined}
                  maxStdinBytes={maxStdinBytes}
                />
              ) : (
                <div className="cs-empty compact">
                  <Terminal size={25} />
                  <p>
                    {t(
                      '先运行一次，看看你的代码表现。',
                      'Run your code to see how it does.',
                    )}
                  </p>
                  <small>
                    {t('Ctrl / ⌘ + Enter 运行测试', 'Ctrl / ⌘ + Enter to run')}
                  </small>
                </div>
              )}
            </div>
          </section>
        </Panel>
      </Group>
      {saveError && (
        <div className="cs-inline-error" role="alert">
          {t(...saveError)}
          <button onClick={downloadCode}>
            {t('下载代码', 'Download code')}
          </button>
        </div>
      )}
      {error && (
        <div className="cs-inline-error" role="alert">
          {say(error)}
          {pollPaused ? (
            <button
              onClick={() => {
                setError('');
                setPollPaused(false);
                setWatchFallback(false);
                setPollRevision((n) => n + 1);
              }}
            >
              {t('重新查询', 'Check again')}
            </button>
          ) : (
            <button
              aria-label={t('关闭错误提示', 'Dismiss error')}
              onClick={() => setError('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      {codeBytes > maxCodeBytes && (
        <div className="cs-inline-error" role="alert">
          {t(
            `代码超过 ${maxCodeBytes / 1024} KB 限制，请缩短后再提交。`,
            `Code exceeds the ${maxCodeBytes / 1024} KB limit. Shorten it before submitting.`,
          )}
        </div>
      )}
    </section>
  );

  return (
    <div
      className={`cs-workspace ${expanded ? 'expanded' : ''}`}
      data-theme={settings.theme}
    >
      {exam &&
        (examMode ? (
          <MockExamBar
            session={exam.session}
            userId={userId}
            problemId={problem.id}
            submissions={boot.submissions ?? []}
            navigate={navigate}
          />
        ) : (
          <MockExamDone session={exam.session} navigate={navigate} />
        ))}
      <div className="cs-workspace-header">
        <div className="cs-workspace-heading">
          {!examMode && (
            <button
              className="cs-back"
              aria-label={t('返回题库', 'Back to problems')}
              onClick={() =>
                navigate('problems', backTo(problem.id, neighbors.library))
              }
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <span className="cs-workspace-eyebrow">
              cswork / {uiEnglish ? 'Problems' : '题库'}
              {practiceRound
                ? ` · ${uiEnglish ? 'Round ' + practiceRound.number : '第 ' + practiceRound.number + ' 轮'}`
                : ''}
            </span>
            <h1>{statement.title}</h1>
          </div>
        </div>
        <div className="cs-workspace-navigation">
          {!examMode && (neighbors.prev || neighbors.next) && (
            <div className="cs-problem-steps">
              <button
                className="cs-top-button"
                disabled={!neighbors.prev}
                aria-label={uiEnglish ? 'Previous problem' : '上一题'}
                title={uiEnglish ? 'Previous problem' : '上一题'}
                onClick={() =>
                  neighbors.prev &&
                  navigate('problem', { problem: neighbors.prev })
                }
              >
                <ChevronLeft size={15} />
                <span>{uiEnglish ? 'Prev' : '上一题'}</span>
              </button>
              <button
                className="cs-top-button"
                disabled={!neighbors.next}
                aria-label={uiEnglish ? 'Next problem' : '下一题'}
                title={uiEnglish ? 'Next problem' : '下一题'}
                onClick={() =>
                  neighbors.next &&
                  navigate('problem', { problem: neighbors.next })
                }
              >
                <span>{uiEnglish ? 'Next' : '下一题'}</span>
                <ChevronRight size={15} />
              </button>
            </div>
          )}
          <button
            className="cs-top-button"
            aria-label={t('报告题目问题 / 提问', 'Report a problem / Ask')}
            title={t('报告题目问题 / 提问', 'Report a problem / Ask')}
            onClick={() =>
              // No lessonId: the problem's course may be hidden (owner-only mode).
              ask({
                problemId: problem.id,
                ...(submission ? { submissionId: submission.id } : {}),
              })
            }
          >
            <MessageSquare size={15} />
            <span>{t('报告题目问题 / 提问', 'Report a problem / Ask')}</span>
          </button>
          {courseVisible && !examMode && (
            <button
              className="cs-top-button"
              aria-label={t('相关课程', 'Related course')}
              title={t('相关课程', 'Related course')}
              onClick={() => navigate('lesson', { lesson: problem.lessonId })}
            >
              <BookOpen size={15} />
              <span>{t('相关课程', 'Related course')}</span>
            </button>
          )}
          {!examMode && (
            <ProblemTimer
              userId={userId}
              problemId={problem.id}
              difficulty={problem.difficulty}
            />
          )}
          <button
            className="cs-top-button"
            aria-label={
              expanded
                ? t('退出专注模式', 'Exit focus mode')
                : t('进入专注模式', 'Enter focus mode')
            }
            title={
              expanded
                ? t('退出专注模式', 'Exit focus mode')
                : t('进入专注模式', 'Enter focus mode')
            }
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>
      {success && exam && examMode && (
        <ExamAcceptedDialog
          session={exam.session}
          problemId={problem.id}
          submissions={boot.submissions ?? []}
          userId={userId}
          navigate={navigate}
          onClose={() => setSuccess(null)}
        />
      )}
      {success && !examMode && (
        <AcceptedDialog
          problemId={problem.id}
          line={!!problem.practiceRound}
          library={neighbors.library}
          acceptedAt={success.created_at}
          seconds={solveSeconds}
          activity={boot.activity}
          fallbackNext={neighbors.next}
          english={uiEnglish}
          navigate={navigate}
          onClose={() => setSuccess(null)}
        />
      )}
      {problemError &&
        (boot.person ? (
          <div className="cs-workspace-notice" role="alert">
            {t('题目配置加载失败：', "Couldn't load the problem: ")}
            {say(problemError)}
            <button onClick={() => setProblemRevision((n) => n + 1)}>
              {t('重新加载', 'Reload')}
            </button>
          </div>
        ) : (
          // Signed out: retrying cannot succeed; sign in is the way forward.
          <div className="cs-workspace-notice" role="status">
            {t(
              '登录后即可查看完整题面并提交代码。',
              'Sign in to see the full statement and submit code.',
            )}
            {signIn}
          </div>
        ))}
      {!accessible && !(problemError && !boot.person) && (
        <div className="cs-workspace-notice">
          {uiEnglish
            ? `${
                !boot.person
                  ? 'Sign in to run and submit solutions for free.'
                  : !boot.person.verified
                    ? 'Verify your email to run and submit solutions.'
                    : 'This is a course exercise; enroll in the course to run and submit.'
              } Your code is still saved as you edit.`
            : `${
                !boot.person
                  ? '登录后即可免费运行和提交解答。'
                  : !boot.person.verified
                    ? '请先验证邮箱，再运行和提交解答。'
                    : '此题是课程练习，开通课程后可运行和提交。'
              } 当前代码可以继续编辑和保存。`}
          {signIn}
        </div>
      )}
      {problem.judgeAvailable === false && (
        <div className="cs-workspace-notice">
          {uiEnglish
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
            {uiEnglish ? 'Description' : '题面与记录'}
          </button>
          <button
            className={mobilePane === 'editor' ? 'active' : ''}
            onClick={() => setMobilePane('editor')}
          >
            <Code2 size={15} />
            {uiEnglish ? 'Code' : '代码与结果'}
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
              aria-label={t(
                '调整题面与编辑器大小',
                'Resize statement and editor',
              )}
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
            <DialogTitle>{t('键盘快捷键', 'Keyboard shortcuts')}</DialogTitle>
            <DialogDescription>
              {t(
                '在编辑器内使用。Mac 用 ⌘，Windows / Linux 用 Ctrl。',
                'Use these in the editor: ⌘ on Mac, Ctrl on Windows / Linux.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="cs-shortcuts">
            {[
              [
                t('运行样例 / 自定义输入', 'Run examples / custom input'),
                'Ctrl / ⌘ + Enter',
              ],
              [
                t('提交全部测试点', 'Submit against all test cases'),
                'Ctrl / ⌘ + Shift + Enter',
              ],
              [t('保存当前草稿', 'Save draft'), 'Ctrl / ⌘ + S'],
              [
                t('代码补全', 'Autocomplete'),
                t(
                  '默认自动开启；Ctrl + Space（或点击「触发补全」）',
                  'On by default; Ctrl + Space (or click "Autocomplete")',
                ),
              ],
              [t('参数提示', 'Parameter hints'), 'Ctrl / ⌘ + Shift + Space'],
              [t('查找', 'Find'), 'Ctrl / ⌘ + F'],
              [t('命令面板', 'Command palette'), 'F1'],
              [t('注释 / 取消注释', 'Toggle comment'), 'Ctrl / ⌘ + /'],
              [
                t('切换 Tab 焦点导航', 'Toggle Tab focus mode'),
                'Ctrl + M / Mac: Ctrl + Shift + M',
              ],
            ].map(([label, keys]) => (
              <div key={label}>
                <span>{label}</span>
                <kbd>{keys}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={routeHintConfirm} onOpenChange={setRouteHintConfirm}>
        <AlertDialogContent
          finalFocus={() => routeHintSummary.current || true}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('现在查看思路提示？', 'Show the hint now?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                '这一轮你在这道题上还没有未通过的提交。先自己想出来的思路，面试时更记得住。',
                "You haven't had a failed submission on this problem this round. An idea you reach yourself is the one you remember in the interview.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('再想想', 'Keep trying')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRouteHint('asked');
                setRouteHintConfirm(false);
              }}
            >
              {t('查看提示', 'Show hint')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
              {t(
                `这会替换 ${replaceRequest?.language ?? ''} 当前草稿。需要保留时，请先取消并下载代码备份。`,
                `This replaces your current ${replaceRequest?.language ?? ''} draft. To keep it, cancel and download a backup first.`,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('保留当前代码', 'Keep current code')}
            </AlertDialogCancel>
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
              {t('确认替换', 'Replace')}
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
            title: t('恢复这份提交代码？', 'Restore this submitted code?'),
          });
        }}
      />
    </div>
  );
}

type NextStop = { id: string; sequence?: string[] } | null;

/** Back to the list the learner came from: the OA library, a classic list, or the bank. */
const backTo = (problemId: string, library?: string) =>
  problemId.startsWith('oa-')
    ? { library: 'oa' }
    : library
      ? { library }
      : undefined;

/**
 * A collection (a classic list or Line 500): the server's next unsolved
 * problem in it. OA: the company's next unsolved judgeable problem.
 * undefined for any other problem.
 */
async function findNextProblem(
  problemId: string,
  collection: string | undefined,
  signal: AbortSignal,
): Promise<NextStop | undefined> {
  if (collection) {
    const page = await ojRequest<{
      nextProblemId: string | null;
      sequence: string[];
    }>(`library?${new URLSearchParams({ collection })}`, undefined, signal);
    return page.nextProblemId && page.nextProblemId !== problemId
      ? { id: page.nextProblemId, sequence: page.sequence }
      : null;
  }
  const company = /^oa-(.+)-\d+$/.exec(problemId)?.[1];
  if (!company) return undefined;
  const ids: string[] = [];
  const solved = new Set<string>();
  // ponytail: pages load until an unsolved problem follows this one; the largest company (~390) is ~13 pages.
  for (let page = 1; ; page++) {
    const result = await ojRequest<{
      items: { id: string; progress?: string }[];
      total: number;
      pageSize: number;
    }>(
      `oa-library?${new URLSearchParams({ company, ready: '1', page: String(page) })}`,
      undefined,
      signal,
    );
    for (const item of result.items) {
      ids.push(item.id);
      if (item.progress === 'solved') solved.add(item.id);
    }
    const at = ids.indexOf(problemId);
    if (
      (at >= 0 && ids.slice(at + 1).some((id) => !solved.has(id))) ||
      page * result.pageSize >= result.total
    )
      break;
  }
  const id = nextUnsolved(ids, problemId, solved);
  return id ? { id, sequence: ids } : null;
}

function AcceptedDialog({
  problemId,
  line,
  library,
  acceptedAt,
  seconds,
  activity,
  fallbackNext,
  english,
  navigate,
  onClose,
}: {
  problemId: string;
  line: boolean;
  /** The classic list the problem was opened from; its order wins over Line 500's. */
  library?: string;
  acceptedAt: number;
  seconds: number | null;
  activity?: Activity[];
  fallbackNext?: string;
  english: boolean;
  navigate: WorkspaceProps['navigate'];
  onClose: () => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const primary = useRef<HTMLButtonElement>(null);
  // The bank page's target for today (its sprint plan's count, 0 on a mock OA
  // or OA day), else the "n a day" picker.
  const [target] = useState(() => {
    try {
      return readTodayTarget(localStorage, localDay());
    } catch {
      return 3;
    }
  });
  // Opened only in the browser, so the local day is safe to read here. The
  // bootstrap refresh may not include this AC yet; a problem counts once a day.
  // Count it on its server day like the activity feed; min() keeps a slow
  // client clock from pushing it into tomorrow.
  const [now] = useState(Date.now);
  const stats = useMemo(
    () =>
      practiceStats(
        [
          ...(activity ?? []),
          { problem_id: problemId, created_at: Math.min(acceptedAt, now) },
        ],
        new Date(now).toDateString(),
        english,
      ),
    [activity, problemId, acceptedAt, now, english],
  );
  const [next, setNext] = useState<NextStop | 'loading'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    const fallback = fallbackNext ? { id: fallbackNext } : null;
    findNextProblem(
      problemId,
      library ?? (line ? 'ling-selected-500' : undefined),
      controller.signal,
    ).then(
      (found) => setNext(found === undefined ? fallback : found),
      () => {
        if (!controller.signal.aborted) setNext(fallback);
      },
    );
    return () => controller.abort();
  }, [problemId, line, library, fallbackNext]);
  const go = () => {
    if (next === 'loading') return;
    if (!next) return navigate('problems', backTo(problemId, library));
    if (next.sequence) rememberProblemSequence(next.sequence, library);
    navigate('problem', { problem: next.id });
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="cs-accepted-dialog"
        showCloseButton={false}
        initialFocus={primary}
      >
        <div className="cs-accepted-banner">
          <DialogTitle className="cs-accepted-title">Accepted</DialogTitle>
          <DialogDescription className="cs-accepted-stats">
            {t(
              `今日 ${stats.today}${target ? ` / ${target}` : ''} · 连续 ${stats.streak} 天`,
              `Today ${stats.today}${target ? ` / ${target}` : ''} · ${stats.streak}-day streak`,
            )}
            {seconds != null &&
              t(
                ` · 本题用时 ${formatClock(seconds)}`,
                ` · Solved in ${formatClock(seconds)}`,
              )}
          </DialogDescription>
          <Button
            ref={primary}
            size="lg"
            className="cs-accepted-next"
            disabled={next === 'loading'}
            focusableWhenDisabled
            onClick={go}
          >
            {next === 'loading' ? <LoaderCircle className="cs-spin" /> : null}
            {next === null
              ? t('返回题库', 'Back to problems')
              : t('下一题', 'Next problem')}
            {next !== 'loading' && next !== null ? <ChevronRight /> : null}
          </Button>
          <button
            className="cs-accepted-dismiss"
            aria-label={english ? 'Dismiss success message' : '收起通过提示'}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
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
  const t = useT();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
    >
      <DialogContent className="cs-settings-dialog">
        <DialogHeader>
          <DialogTitle>{t('让编辑器适合你', 'Editor settings')}</DialogTitle>
          <DialogDescription>
            {t(
              '设置会保存在此浏览器，随时可以调整。',
              'Settings are saved in this browser. Change them anytime.',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="cs-settings-form">
          <label>
            <span>{t('外观', 'Theme')}</span>
            <select
              value={settings.theme}
              onChange={(event) =>
                change({
                  ...settings,
                  theme: event.target.value as EditorSettings['theme'],
                })
              }
            >
              <option value="light">{t('浅色', 'Light')}</option>
              <option value="dark">{t('深色', 'Dark')}</option>
            </select>
          </label>
          <label>
            <span>{t('字号', 'Font size')}</span>
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
            <span>{t('Tab 宽度', 'Tab size')}</span>
            <select
              value={settings.tabSize}
              onChange={(event) =>
                change({
                  ...settings,
                  tabSize: Number(event.target.value) as 2 | 4,
                })
              }
            >
              <option value="2">{t('2 个空格', '2 spaces')}</option>
              <option value="4">{t('4 个空格', '4 spaces')}</option>
            </select>
          </label>
          <label>
            <span>{t('工作区布局', 'Layout')}</span>
            <select
              value={settings.layout}
              onChange={(event) =>
                change({
                  ...settings,
                  layout: event.target.value as EditorSettings['layout'],
                })
              }
            >
              <option value="horizontal">
                {t('题面在左，代码在右', 'Statement left, code right')}
              </option>
              <option value="vertical">
                {t('题面在上，代码在下', 'Statement on top, code below')}
              </option>
            </select>
          </label>
          <label>
            <span>{t('自动换行', 'Word wrap')}</span>
            <input
              type="checkbox"
              checked={settings.wordWrap}
              onChange={(event) =>
                change({ ...settings, wordWrap: event.target.checked })
              }
            />
          </label>
          <label>
            <span>{t('代码缩略图', 'Minimap')}</span>
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
          {t(
            '编辑器支持语法高亮、括号配对、查找和多光标。编译错误与运行结果由判题服务返回。',
            'The editor supports syntax highlighting, bracket matching, find and multiple cursors. Compile errors and run results come from the judge.',
          )}
        </p>
      </DialogContent>
    </Dialog>
  );
}
