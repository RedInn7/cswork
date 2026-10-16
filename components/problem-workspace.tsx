'use client';
import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties, type ReactNode } from 'react';
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
  problemSequence,
  randomPickQuery,
  rememberProblemSequence,
} from '@/lib/problem-sequence';
import { practiceStats, type Activity } from './practice-calendar';
import { AcceptedExtras } from './achievements';
import { AnalyzerNotes, FollowUpToggle, followUpBlocked } from './analyzer-notes';
import { followUpRule } from '@/lib/code-analyzer';
import { RatingBadge } from './rating-badge';
import { localDay, readTodayTarget } from '@/lib/study-plan';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  Check,
  CircleCheck,
  Copy,
  Expand,
  Shrink,
  Shuffle,
  Tag,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  History,
  Info,
  Keyboard,
  Lightbulb,
  LoaderCircle,
  Lock,
  Maximize,
  Maximize2,
  MessageSquare,
  Minimize,
  Minimize2,
  Play,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  SquareTerminal,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import { OaCompanyBadge, OaEditorial } from './oa-library';
import { LingEditorial } from './ling-editorial';
import { CompanyTags } from './company-tags';
import { NotesTab, ProblemMarks, ProblemNotes, useProblemNote } from './problem-notes';
import { SubmissionNote } from './submission-note';
import { ReviewLink } from './code-review';
import { AskedReport, communityProblem } from './problem-community';
import { SolutionPosts, SolutionsTab } from './solution-posts';
import { HintLadder, OA_LEVELS, useHintLadder } from './hint-ladder';
import { AiCaseIdeas, AiComplexity, AiTutor, AskAiSelection, useAiTutor, type AiContext } from './ai-tutor';
import { StressTest, stressReady } from './stress-result';
import { ProblemMeta } from './problem-meta';
import { SimilarProblems } from './similar-problems';
import {
  ExamAcceptedDialog,
  MockExamBar,
  MockExamDone,
  useMockExam,
} from './mock-exam-bar';
import { ContestBar, useContestRoom } from './contest-bar';
import { useReplayRecorder } from './mock-replay';
import { contestReplay } from '@/lib/mock-replay';
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
import { useWhiteboard, WhiteboardPad, WhiteboardResult, WhiteboardToggle } from './whiteboard-mode';
import { DebugButton } from './python-debugger-button';
import { ProblemTimer, formatClock, stopTimer } from './problem-timer';
import { ACM_IO_TEMPLATES } from '@/lib/acm-io-templates';
import { isFreeTrack } from '@/lib/free-tracks';
import { useIdlePrecompile } from '@/hooks/use-idle-precompile';
import { encodeShare } from '@/lib/playground-share';
import { StatementMarkdown } from './statement-markdown';
import { LeetCodeSamples } from './leetcode-samples';
import { leetcodePublicSample } from '@/lib/leetcode-public-samples';
import { checkConstraints, checkField, fieldValue, joinFields, splitFields } from '@/lib/testcase-fields';
import { StructureView, drawable } from './structure-view';
import type { CodingMode } from '@/lib/coding-mode';
import type { IntelligenceStatus } from '@/lib/editor-intelligence';
import {
  CopyBlock,
  SubmissionCodeDialog,
  SubmissionResult,
  Verdict,
  type ReferenceOutput,
} from './oj-results';
import {
  isTrackLanguage,
  languages,
  starters,
  starterTemplates,
  problemStatement,
  trackLanguageOf,
  type ProblemLocale,
  type Language,
  type ProblemStatement,
  type ProblemSummary,
} from '@/lib/problems';
import type { Boot } from '@/lib/types';
import {
  defaultEditorSettings,
  draftStorageKey,
  flushCloudDrafts,
  languageFiles,
  readCloudDraft,
  readEditorDraft,
  readEditorSettings,
  writeEditorDraft,
  writeEditorSettings,
  type CloudDraftTarget,
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
import { changedLines, markDrill, type Drill } from '@/lib/oa-drills';
import { track } from '@/lib/analytics';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import '@/app/algorithm-demo.css';
import '@/app/editor.css';
import '@/app/lc-rating.css';
import '@/app/workbench-tools.css';
import '@/app/sql-result.css';
import '@/app/workspace-panels.css';
import '@/app/workspace-sync.css';

type WorkspaceProps = {
  problem: ProblemSummary;
  boot: Boot;
  navigate: (view: string, extra?: Record<string, string>) => void;
  ask: (context: Record<string, string>) => void;
  refresh: () => Promise<void>;
  /** ?mock=<session id>: the problem is a question of a timed mock OA. */
  mock?: string;
  /** ?room=<contest id>: the problem is a question of a contest room (lib/server/contests.ts). */
  room?: string;
  /** ?tab=solutions opens on the community solutions (a contest's upsolve links); ?tab=history on Submissions. */
  tab?: string;
  /** ?drill=<n>: an OA debugging drill, the problem's n-th planted bug to fix (lib/oa-drills.ts). */
  drill?: string;
};
type MaxPanel = 'statement' | 'code' | 'console';
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
/** An untouched ACM starter in either language, or the problem's own, can be swapped for the current one. */
function isStarter(code: string, language: Language, own?: OJProblem['starters']) {
  return own?.[language] === code || Object.values(starterTemplates).some((set) => set[language] === code);
}
/** Analytics calls the formal judge "submit", like its button. */
const judgeMode = (mode: string) => (mode === 'judge' || mode === 'drill' ? 'submit' : 'run');
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

/** "5 分钟前" / "5 minutes ago" for the cross-device restore notice. */
function draftAge(at: number, locale: 'zh' | 'en') {
  const minutes = Math.max(1, Math.round((Date.now() - at) / 60000));
  const format = new Intl.RelativeTimeFormat(locale === 'zh' ? 'zh-CN' : 'en');
  return minutes < 60
    ? format.format(-minutes, 'minute')
    : minutes < 1440
      ? format.format(-Math.round(minutes / 60), 'hour')
      : format.format(-Math.round(minutes / 1440), 'day');
}

const MAX_CASES = 5;
// A run or submission the learner can ask the AI tutor about.
const FAILED_VERDICTS = new Set([
  'wrong_answer',
  'time_limit',
  'memory_limit',
  'output_limit',
  'runtime_error',
  'compile_error',
]);
/**
 * A public example as a custom case: ACM stdin as is; LeetCode's "name = value" lines become
 * one JSON value per line. null when there is no such form.
 */
function exampleAsCase(problemId: string, mode: CodingMode, sample: { input: string; expectedOutput: string }) {
  return mode === 'acm'
    ? sample.input
    : (leetcodePublicSample(problemId, sample)?.input?.replace(/^[A-Za-z_]\w*\s*=\s*/gm, '') ?? null);
}
function readCases(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || 'null');
    const cases = Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === 'string')
          .slice(0, MAX_CASES)
      : [];
    return cases.length ? cases : [''];
  } catch {
    return [''];
  }
}

export function ProblemWorkspace(props: WorkspaceProps) {
  return (
    <Workspace
      key={`${props.boot.person?.id || 'guest'}:${props.problem.id}:${props.drill ?? ''}`}
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
  room,
  tab,
  drill,
}: WorkspaceProps) {
  const userId = boot.person?.id || 'guest';
  // A debugging drill, never inside a mock or contest (the API refuses it in a running contest too).
  const drillN = !mock && !room && drill && /^\d{1,4}$/.test(drill) ? Number(drill) : null;
  // A running mock OA or contest hides solutions, hints and the way to other problems.
  const exam = useMockExam(mock, userId, initialProblem.id);
  const contest = useContestRoom(room, initialProblem.id);
  const examMode = !!exam?.running || !!contest?.running;
  // A mock or contest question starts from the template, not this browser's earlier draft of it.
  const [draftId] = useState(() =>
    exam
      ? `${initialProblem.id}:mock:${exam.session.id}`
      : room
        ? `${initialProblem.id}:room:${room}`
        : drillN !== null
          ? `${initialProblem.id}:drill:${drillN}`
          : initialProblem.id,
  );
  // The drill's buggy program; the editor opens on it once it has loaded (or failed to).
  const [drillItem, setDrillItem] = useState<Drill | null>(null);
  const [drillError, setDrillError] = useState('');
  useEffect(() => {
    if (drillN === null) return;
    const controller = new AbortController();
    ojRequest<{ items: Drill[] }>(`oa-library/${encodeURIComponent(initialProblem.id)}/drill`, undefined, controller.signal)
      .then(({ items }) => {
        const found = items.find((item) => item.n === drillN);
        if (found) setDrillItem(found);
        else setDrillError('这道题没有调试练习');
      })
      .catch((e) => {
        if (!controller.signal.aborted) setDrillError((e as Error).message);
      });
    return () => controller.abort();
  }, [drillN, initialProblem.id]);
  // In the exam the Submissions tab lists only this exam's attempts.
  const examFrom = exam?.running
    ? reportWindow(exam.session).from
    : contest?.running
      ? (contest.view.me?.start ?? 0)
      : 0;
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
  // SQL track (and its pandas versions), Core Skills and REST API statements are Markdown: schema blocks, operation lists.
  const markdownStatement = !!trackLanguageOf(problem.id) || /^(core|rest)-/.test(problem.id);
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
  // Follow-up mode: LeetCode mode only, where every line is the learner's own (no input parsing).
  const [followUpOn, setFollowUpOn] = useState(false);
  const followUp = !examMode && codingMode === 'leetcode' ? followUpRule(problem.id, language) : undefined;
  const editorFile =
    codingMode === 'leetcode'
      ? {
          python: 'solution.py',
          cpp: 'solution.cpp',
          java: 'Solution.java',
          go: 'solution.go',
          sql: 'query.sql',
          pandas: 'solution.py',
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
    language === 'sql'
      ? t('SQLite 方言 · 一条 SELECT', 'SQLite dialect · one SELECT')
      : language === 'pandas'
        ? t('Pandas · solve(tables) 返回 DataFrame', 'Pandas · solve(tables) returns a DataFrame')
        : intelligence.state === 'idle'
          ? t('语言服务待启动', 'Language service not started')
          : say(intelligence.message);
  const suggest = useRef<(() => void) | null>(null);
  const format = useRef<(() => void) | null>(null);
  const runButton = useRef<HTMLButtonElement>(null);
  const [leftTab, setLeftTab] = useState<
    'statement' | 'history' | 'editorial' | 'notes' | 'solutions'
  >(
    tab === 'solutions' && boot.person && communityProblem(initialProblem.id)
      ? 'solutions'
      : tab === 'history' && boot.person
        ? 'history'
        : 'statement',
  );
  // Private to an account, and closed during a mock exam like the editorial.
  const note = useProblemNote(
    boot.person && !examMode ? userId : null,
    initialProblem.id,
  );
  const [bottomTab, setBottomTab] = useState<'input' | 'result'>('input');
  const [inputMode, setInputMode] = useState<'sample' | 'custom'>('sample');
  // Custom cases (at most 5) live in this browser, per problem and submission mode;
  // Run sends the selected one, so the judge still gets one stdin per run.
  const casesKey = `cswork:cases:${userId}:${initialProblem.id}${codingMode === 'leetcode' ? ':leetcode' : ''}`;
  const [customCases, setCustomCases] = useState(['']);
  const [caseIndex, setCaseIndex] = useState(0);
  const stdin = customCases[caseIndex] ?? '';
  // Which custom case the shown run used, for the result's caption.
  const [ranCase, setRanCase] = useState<number | null>(null);
  useEffect(() => {
    setCustomCases(readCases(casesKey));
    setCaseIndex(0);
  }, [casesKey]);
  // LeetCode cases edit one labelled field per parameter; Raw text (or a line count that
  // doesn't match) shows the stored text itself.
  const [rawCase, setRawCase] = useState(false);
  const caseParams = codingMode === 'leetcode' && problem.leetcodeParams?.length ? problem.leetcodeParams : null;
  const caseFields = caseParams && !rawCase ? splitFields(stdin, caseParams.length) : null;
  // Hints under each field, never a gate: the type as the judge decodes it, then the statement's
  // bounds. A blank new case stays quiet until one field has text.
  const caseIssues =
    caseParams && caseFields?.some(Boolean)
      ? caseParams.map((param, index) => {
          const check = checkField(caseFields[index], param.type);
          return check.ok ? null : check.message;
        })
      : null;
  const caseBounds =
    caseParams && caseFields && problem.leetcodeConstraints
      ? checkConstraints(caseFields, caseParams, problem.leetcodeConstraints)
      : null;
  // Parameters whose picture is open (TreeNode, ListNode, 2-D arrays).
  const [drawn, setDrawn] = useState<string[]>([]);
  const editCase = (value: string) =>
    saveCases(
      customCases.map((item, index) => (index === caseIndex ? value : item)),
      caseIndex,
    );
  // The editorial's output on the custom case just run (POST problems/:id/expected): the
  // expected output beside the learner's. Never in a mock exam or contest.
  const [reference, setReference] = useState<ReferenceOutput | null>(null);
  const referenceController = useRef<AbortController | null>(null);
  useEffect(() => () => referenceController.current?.abort(), []);
  // The note under a sample run that added its failing example to the custom cases.
  const [caseNote, setCaseNote] = useState('');
  const [sampleIndex, setSampleIndex] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
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
  // Browser full screen, stacking with focus mode; null where it's unavailable (iPhone Safari).
  const [fullscreen, setFullscreen] = useState<boolean | null>(null);
  useEffect(() => {
    if (!document.fullscreenEnabled) return;
    const sync = () => setFullscreen(!!document.fullscreenElement);
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  // Focus mode hides the top bar (and its sign-in button), so the notice carries the one entry.
  const signIn = expanded && !boot.person && (
    <button onClick={() => window.dispatchEvent(new Event('cswork:auth-required'))}>
      {t('登录 / 注册', 'Sign in / Sign up')}
    </button>
  );
  const consolePanel = usePanelRef();
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  // One panel fills the workspace (its title bar's button or a double-click; the button
  // again or Esc restores). CSS hides the others, so the saved layout stays untouched.
  const [maximized, setMaximized] = useState<MaxPanel | null>(null);
  const consoleWasCollapsed = useRef(false);
  function maximize(panel: MaxPanel | null) {
    if (maximized === 'console' && panel !== 'console' && consoleWasCollapsed.current) {
      consoleWasCollapsed.current = false;
      consolePanel.current?.collapse();
    }
    if (panel === 'console' && consolePanel.current?.isCollapsed()) {
      consoleWasCollapsed.current = true;
      consolePanel.current.expand();
    }
    setMaximized(panel);
  }
  const toggleMaximized = (panel: MaxPanel) => maximize(maximized === panel ? null : panel);
  useEffect(() => {
    if (!maximized) return;
    const restore = (event: KeyboardEvent) => {
      // Esc belongs to the editor (Vim, suggestions) and to dialogs first.
      const target = event.target as Element | null;
      if (event.key !== 'Escape' || event.defaultPrevented || target?.closest?.('.monaco-editor, [role="dialog"]'))
        return;
      maximize(null);
    };
    document.addEventListener('keydown', restore);
    return () => document.removeEventListener('keydown', restore);
  });
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
  // A practice-round problem counts as passed only by an AC in this round (badge and editorial lock).
  const solvedThisRound = shownHistory.some(
    (item) =>
      item.mode === 'judge' &&
      item.status === 'accepted' &&
      (!problem.practiceRound ||
        (!!practiceRound && item.practiceRoundId === practiceRound.id)),
  );
  // The Line 500 editorial opens once the problem is passed, or after a confirm kept until reload.
  const [editorialAsked, setEditorialAsked] = useState(false);
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
  const hintLadder = useHintLadder(submission, problem.failedSubmissionIds);
  // AI hints and review: kept here so a tab switch does not drop the replies.
  const aiTutor = useAiTutor(initialProblem.id);
  // The solutions tab's language filter, set from the AC dialog's histogram.
  const [solutionsLanguage, setSolutionsLanguage] = useState('');
  const prose = useRef<HTMLDivElement>(null);
  // The tutor's extras; SQL track problems have no AI (lib/server/ai-tutor.ts takes code languages).
  // Whiteboard mode: no run, completion, help or AI, one submission (components/whiteboard-mode.tsx).
  const wb = useWhiteboard(problem.id, !!boot.person, submission, !examMode && drillN === null && !isTrackLanguage(language));
  const aiOn = !!boot.services?.ai && !!boot.person && !examMode && !isTrackLanguage(language) && !wb.on;
  const editorStatus = wb.on ? t('白板模式：纯文本，没有补全和报错提示', 'Whiteboard: plain text, no completion or error marks') : intelligenceText;
  const aiContext: AiContext = { language, codingMode, code, english: uiEnglish };
  // A running mock OA or contest run records this question for the report's or the room's code
  // replay (this browser only).
  const recordReplay = useReplayRecorder(
    !ready
      ? null
      : exam?.running
        ? exam.session
        : contest?.running && room
          ? contestReplay(room, contest.view.me!, contest.view.problems!.map((p) => p.id), contest.skew)
          : null,
    initialProblem.id,
    code,
  );
  useEffect(() => {
    if (!submission || activeStatuses.has(submission.status) || submission.status === 'cancelled') return;
    // The POST acknowledgement may already say accepted but has no test details.
    if (submission.status === 'accepted' && submission.total <= 0) return;
    recordReplay.current(submission);
  }, [submission, recordReplay]);
  // A sample run's first failing example joins the custom cases (an identical one is just
  // selected), once per run; hidden cases never reach the browser.
  const exampleAdded = useRef<string | null>(null);
  useEffect(() => {
    if (
      !submission ||
      submission.mode !== 'run' ||
      ranCase !== null ||
      activeStatuses.has(submission.status) ||
      exampleAdded.current === submission.id ||
      (submission.codingMode ?? 'acm') !== codingMode
    )
      return;
    const failed = submission.cases?.find(
      (item) => FAILED_VERDICTS.has(item.status) && item.stdin !== undefined,
    );
    if (!failed) return;
    exampleAdded.current = submission.id;
    const input = exampleAsCase(problem.id, codingMode, {
      input: failed.stdin!,
      expectedOutput: failed.expected ?? '',
    });
    if (
      input === null ||
      new TextEncoder().encode(input).byteLength > maxStdinBytes ||
      (customCases.length >= MAX_CASES && !customCases.includes(input))
    )
      return;
    const known = customCases.includes(input);
    addCase(input);
    setCaseNote(
      known
        ? t(`失败的样例 ${failed.ordinal + 1} 已在自定义用例里，已切换过去`, `Failed example ${failed.ordinal + 1} is already a custom case; it's selected`)
        : t(`已把失败的样例 ${failed.ordinal + 1} 加入自定义用例`, `Added failed example ${failed.ordinal + 1} to your custom cases`),
    );
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per finished sample run; addCase reads the current cases.
  }, [submission]);
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
  const draft = useRef<{ key: string; code: string; cloud?: CloudDraftTarget }>({
    key: '',
    code: starters.python,
  });
  // Signed in and not a mock question: drafts also live on the server, across devices.
  // A drill's draft is its own (draftId) and stays in this browser.
  const cloudSync = !!boot.person && !mock && !room && drillN === null;
  const cloudFor = (next: Language, mode: CodingMode) =>
    cloudSync ? { problemId: draftId, language: next, codingMode: mode } : undefined;
  const [restored, setRestored] = useState<{ previous: string; at: number } | null>(null);
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
  const activeStorageKey = `cswork:oj:active:${userId}:${initialProblem.id}${drillN === null ? '' : `:drill:${drillN}`}`;
  const draftActive = !!submission && activeStatuses.has(submission.status);
  const pending = submitting || draftActive;
  // A drill: lines changed so far (its program is Python), and a pass once accepted within the
  // budget; the verdict stands until the code is edited again.
  const drillChanged = drillItem && language === 'python' ? changedLines(drillItem.code, code) : null;
  const drillVerdict =
    drillChanged !== null && submission?.mode === 'drill' && submission.status === 'accepted' && submission.code === code
      ? drillChanged
      : null;
  const drillPassed = !!drillItem && drillVerdict !== null && drillVerdict <= drillItem.budget;
  useEffect(() => {
    if (drillPassed && drillN !== null) markDrill(initialProblem.id, drillN, 'fix');
  }, [drillPassed, drillN, initialProblem.id]);
  const lineCount = (n: number) => (n === 1 ? '1 line' : `${n} lines`);
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
  // The example as custom input; null when there is no such form to copy.
  const exampleCase = !loadedProblem ? null : exampleAsCase(problem.id, codingMode, sample);
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
  // The server only sends courses this viewer may see (canSeeCourse). Free tracks (SQL, book
  // problems) only borrow a lesson id, so they have no related course.
  const courseVisible =
    !isFreeTrack(problem.id) &&
    boot.courses.some((course) => course.lessons.some((lesson) => lesson.id === problem.lessonId));
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
      !isTrackLanguage(language) && // nothing to compile
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

  const panelNames: Record<MaxPanel, [string, string]> = {
    statement: ['题面', 'the statement'],
    code: ['代码', 'the code'],
    console: ['控制台', 'the console'],
  };
  const maxButton = (panel: MaxPanel) => {
    if (narrow) return null;
    const label =
      maximized === panel
        ? t('还原面板布局', 'Restore the panels')
        : t(`最大化${panelNames[panel][0]}`, `Maximize ${panelNames[panel][1]}`);
    return (
      <button
        type="button"
        className="cs-panel-max"
        aria-label={label}
        title={`${label}${t('（双击标题栏也可以，Esc 还原）', ' (or double-click the title bar; Esc restores)')}`}
        onClick={() => toggleMaximized(panel)}
      >
        {maximized === panel ? <Shrink size={14} /> : <Expand size={14} />}
      </button>
    );
  };
  // Double-clicking a title bar (its tabs included, its other controls not) toggles it too.
  const maxOnDoubleClick = (panel: MaxPanel) => (event: { target: EventTarget }) => {
    if (narrow || (event.target as Element).closest('button:not([role="tab"]), select, input, textarea, a')) return;
    toggleMaximized(panel);
  };

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
      writeEditorDraft(draft.current.key, draft.current.code, draft.current.cloud);
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
    if (!loadedProblem || (drillN !== null && !drillItem && !drillError)) return;
    alive.current = true;
    setSettings(readEditorSettings(userId));
    let chosen: Language = 'python';
    // A drill's program is a Python stdin program.
    const initialMode: CodingMode = !drillItem && loadedProblem.codingModes?.includes(
      'leetcode',
    )
      ? 'leetcode'
      : 'acm';
    setCodingMode(initialMode);
    const template = (lang: Language) =>
      drillItem && lang === 'python'
        ? drillItem.code
        : initialMode === 'leetcode'
        ? loadedProblem.leetcodeTemplates?.[lang] || ''
        : loadedProblem.starters?.[lang] ||
          starterTemplates[statementLocaleRef.current][lang];
    try {
      const storedLanguage = localStorage.getItem(
        `cswork:editor:language:${userId}`,
      );
      if (languages.some((item) => item.id === storedLanguage) && !drillItem)
        chosen = storedLanguage as Language;
      // An SQL problem opens in SQL, and SQL never carries over to other problems.
      if (loadedProblem.languages && !loadedProblem.languages.includes(chosen))
        chosen = loadedProblem.languages[0];
      const stored = readEditorDraft(
        userId,
        draftId,
        chosen,
        initialMode,
        template(chosen),
      );
      // A saved but untouched starter follows the current statement language.
      if (
        initialMode === 'acm' &&
        isStarter(stored.code, chosen, loadedProblem.starters)
      )
        stored.code = template(chosen);
      draft.current = {
        key: draftStorageKey(userId, draftId, chosen, initialMode),
        code: stored.code,
        cloud: cloudFor(chosen, initialMode),
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
        cloud: cloudFor(chosen, initialMode),
      };
      setLanguage(chosen);
      setCode(template(chosen));
      setSaveError([
        '浏览器存储不可用。你仍可编写代码，请及时下载备份。',
        'Browser storage is unavailable. You can still write code; download a backup soon.',
      ]);
    }
    setReady(true);
    const save = () => {
      persistDraft();
      flushCloudDrafts();
    };
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- cloudFor only reads cloudSync and draftId, both fixed for this workspace.
  }, [userId, draftId, persistDraft, loadedProblem, drillItem, drillError]);

  // A newer copy from another device replaces the draft unless it was edited since opening; undo puts it back.
  useEffect(() => {
    const target = draft.current.cloud;
    if (!ready || !target) return;
    const key = draft.current.key;
    const controller = new AbortController();
    readCloudDraft(target, controller.signal).then(
      (cloud) => {
        if (
          !cloud ||
          draft.current.key !== key ||
          draftDirty.current ||
          cloud.code === draft.current.code
        )
          return;
        let local = 0;
        try {
          local = readEditorDraft(userId, draftId, target.language, target.codingMode).updatedAt;
        } catch {
          /* Unreadable here: the server copy is the one to show. */
        }
        if (cloud.updatedAt <= local) return;
        const previous = draft.current.code;
        draft.current.code = cloud.code;
        setCode(cloud.code);
        try {
          localStorage.setItem(key, JSON.stringify(cloud));
        } catch {
          /* Still shown for this visit. */
        }
        setRestored({ previous, at: cloud.updatedAt });
      },
      () => {
        /* Offline or signed out elsewhere: the local draft stands. */
      },
    );
    return () => controller.abort();
  }, [ready, language, codingMode, userId, draftId]);

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
    // The server keeps it only for the first AC: the solve time on the progress page.
    if (seconds != null)
      void ojRequest(`problems/${encodeURIComponent(initialProblem.id)}/aids`, { kind: 'time', seconds }).catch(() => {});
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
    setRestored(null);
    setSaveStatus(['正在保存草稿…', 'Saving draft…']);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistDraft(), 350);
  }
  function saveCases(next: string[], index: number) {
    setCustomCases(next);
    setCaseIndex(index);
    try {
      localStorage.setItem(casesKey, JSON.stringify(next));
    } catch {
      /* Still usable for this visit. */
    }
  }
  /** Adds a case and selects it; an identical one is selected instead, a lone blank one is filled. */
  function addCase(input: string) {
    const existing = customCases.indexOf(input);
    if (existing >= 0) saveCases(customCases, existing);
    else if (customCases.length === 1 && !customCases[0]) saveCases([input], 0);
    else if (customCases.length >= MAX_CASES) {
      setError(
        t(
          `最多保存 ${MAX_CASES} 个自定义用例，请先删除一个。`,
          `You can keep up to ${MAX_CASES} custom cases. Delete one first.`,
        ),
      );
      return false;
    } else saveCases([...customCases, input], customCases.length);
    return true;
  }
  function deleteCase() {
    const next = customCases.filter((_, index) => index !== caseIndex);
    if (!next.length) return saveCases([''], 0);
    saveCases(next, Math.min(caseIndex, next.length - 1));
  }
  function debugWithCase(input: string) {
    if (!addCase(input)) return;
    setInputMode('custom');
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
    const text = isTrackLanguage(language) ? undefined : template?.code[language];
    if (!template || !text || text === code) return;
    // Templates are whole programs (main, class Main, package main): splicing one
    // into edited code can't compile, so it replaces the draft, after a confirm.
    if (isStarter(code, language, problem.starters)) updateCode(text);
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
    if (drillItem && next === 'python' && mode === 'acm') return drillItem.code;
    return mode === 'leetcode'
      ? problem.leetcodeTemplates?.[next] || ''
      : problem.starters?.[next] || starterTemplates[statementLocale][next];
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
      if (mode === 'acm' && isStarter(nextCode, next, problem.starters))
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
      cloud: cloudFor(next, mode),
    };
    draftDirty.current = override !== undefined;
    setLanguage(next);
    setRestored(null);
    // The other mode has its own saved cases (casesKey).
    if (mode !== codingMode) setInputMode('sample');
    setCodingMode(mode);
    setCode(override ?? nextCode);
    setCursor({ line: 1, column: 1 });
    persistDraft();
  }
  function changeSettings(next: EditorSettings) {
    setSettings(next);
    try {
      writeEditorSettings(userId, next);
    } catch {
      setSaveError([
        '无法保存编辑器偏好，请检查浏览器存储设置。',
        "Couldn't save editor preferences. Check your browser storage settings.",
      ]);
    }
  }
  /** This code and its stdin in a /playground tab (a #c= share link; no problem attached). */
  async function openPlayground() {
    if (isTrackLanguage(language)) return;
    // Opened inside the click so it isn't blocked as a popup; the link follows once encoded.
    const tab = window.open('about:blank', '_blank');
    const value = await encodeShare({
      language,
      code,
      stdin: inputMode === 'custom' ? stdin : (exampleCase ?? ''),
    });
    if (!value) {
      tab?.close();
      setError(
        t(
          '代码太长，放不进 Playground 链接（压缩后上限 32 KB）。',
          'The code is too long for a Playground link (32 KB compressed).',
        ),
      );
      return;
    }
    const url = `/playground#c=${value}`;
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else location.href = url;
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
  const [shuffling, setShuffling] = useState(false);
  /** A random unsolved problem under the bank's last filters (unsolved ones if none). */
  async function shuffle() {
    setShuffling(true);
    try {
      // The draw may land on this very problem; a couple more tries usually move on.
      for (let tries = 0; tries < 3; tries++) {
        const page = await ojRequest<{ random?: string | null; sequence?: string[] }>(
          `library?${randomPickQuery()}`,
        );
        if (!page.random) break;
        if (page.random === problem.id) continue;
        rememberProblemSequence(page.sequence ?? [page.random]);
        navigate('problem', { problem: page.random });
        return;
      }
      setError(
        t(
          '题库当前筛选下没有其他未通过的题目。',
          "No other unsolved problem matches the problem bank's filters.",
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setShuffling(false);
    }
  }
  async function submit(mode: 'run' | 'judge') {
    // Whiteboard mode never runs, Ctrl / ⌘ + Enter included.
    if (disabled || busyRef.current || (mode === 'run' && wb.on)) return;
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
    const blocked = mode === 'judge' && followUpOn && followUp ? followUpBlocked(code, language, followUp, uiEnglish) : '';
    if (blocked) {
      setError(blocked);
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
    setRanCase(mode === 'run' && inputMode === 'custom' ? caseIndex : null);
    setCaseNote('');
    referenceController.current?.abort();
    setReference(null);
    if (
      mode === 'run' &&
      inputMode === 'custom' &&
      // A Line 500 editorial's best approach, or an OA package's verified program (ACM only).
      ((problem.lingEditorialVerified === true && !!problem.codingModes?.includes('leetcode')) ||
        problem.id.startsWith('oa-')) &&
      !examMode
    )
      void runReference(stdin, codingMode);
    showConsole('result');
    setMobilePane('editor');
    setError('');
    setSuccess(null);
    setPollPaused(false);
    setWatchFallback(false);
    persistDraft();
    // A drill's submission is judged like one but never counts (mode 'drill', lib/oa-drills.ts);
    // its runs are runs kept out of the history and the AI tutor ('drill-run', shown as 'run').
    const shown = drillItem && mode === 'judge' ? 'drill' : mode;
    const sent = drillItem && mode === 'run' ? 'drill-run' : shown;
    const payload = {
      problemId: problem.id,
      language,
      code,
      codingMode,
      mode: sent,
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
          wb.submitted(result.id);
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
            mode: shown,
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
  /** The expected output for this custom case, run beside the learner's own run. */
  async function runReference(input: string, mode: CodingMode) {
    const controller = new AbortController();
    referenceController.current = controller;
    setReference({ status: 'pending' });
    try {
      let item = await ojRequest<OJSubmission>(
        `problems/${encodeURIComponent(problem.id)}/expected`,
        { stdin: input, codingMode: mode, idempotencyKey: crypto.randomUUID() },
        controller.signal,
      );
      // Plain polls: the server allows two long polls per learner, and the run's own watch needs one.
      while (activeStatuses.has(item.status)) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        item = await ojRequest<OJSubmission>(
          `submissions/${item.id}`,
          undefined,
          controller.signal,
        );
      }
      const output = item.cases?.[0]?.stdout;
      setReference(
        item.status === 'finished' && output !== undefined
          ? { status: 'done', output }
          : { status: 'failed' },
      );
    } catch (e) {
      // 422: the case is outside the statement's bounds; say which, not "unavailable".
      if (!controller.signal.aborted)
        setReference({ status: 'failed', message: (e as { status?: unknown }).status === 422 ? (e as Error).message : undefined });
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

  // Topic tags name the technique; source labels (灵神题单 …) are not topics.
  const topics = problem.tags.filter(
    (tag) => !/灵神|题单|leetcode|来源/i.test(tag),
  );
  const description = (
    <section className="cs-statement-pane">
      <div
        className="cs-pane-tabs"
        role="tablist"
        aria-label={uiEnglish ? 'Problem information' : '题目资料'}
        onDoubleClick={maxOnDoubleClick('statement')}
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
        {(problem.id.startsWith('oa-') || problem.lingEditorialVerified != null) && !examMode && !wb.on && (
          <button
            role="tab"
            className={leftTab === 'editorial' ? 'active' : ''}
            aria-selected={leftTab === 'editorial'}
            onClick={() => setLeftTab('editorial')}
          >
            <BookOpen size={15} />
            {uiEnglish ? 'Editorial' : '官方题解'}
          </button>
        )}
        {boot.person && communityProblem(problem.id) && !examMode && !wb.on && (
          <SolutionsTab active={leftTab === 'solutions'} onSelect={() => setLeftTab('solutions')} english={uiEnglish} />
        )}
      </div>
      {maxButton('statement')}
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
        ) : leftTab === 'editorial' && problem.lingEditorialVerified != null && !examMode ? (
          <LingEditorial
            key={problem.id}
            problemId={problem.id}
            verified={problem.lingEditorialVerified}
            english={uiEnglish}
            unlocked={editorialAsked || solvedThisRound}
            onUnlock={() => setEditorialAsked(true)}
            code={code}
            language={language}
            settings={settings}
            discussion={!!boot.person && communityProblem(problem.id)}
          />
        ) : leftTab === 'editorial' && !examMode ? (
          <OaEditorial key={`editorial:${problem.id}`} problemId={problem.id} english={uiEnglish} language={language} />
        ) : leftTab === 'solutions' && boot.person && !examMode ? (
          <SolutionPosts
            key={`${problem.id}:${solutionsLanguage}`}
            problemId={problem.id}
            english={uiEnglish}
            code={code}
            language={language}
            only={solutionsLanguage}
          />
        ) : leftTab === 'statement' ? (
          <>
            <div className="cs-statement-heading">
              <h2>
                {problem.id.match(/^lc-(\d+)$/)?.[1]
                  ? `${problem.id.slice(3)}. `
                  : ''}
                {statement.title}
              </h2>
              {note.enabled ? (
                <ProblemMarks problemId={problem.id} english={uiEnglish} />
              ) : (
                !boot.person &&
                communityProblem(problem.id) && (
                  <AskedReport problemId={problem.id} english={uiEnglish} signedIn={false} />
                )
              )}
              {solvedThisRound && (
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
              {/* Contest rating (zerotrac); kept out of a mock like the company tags. */}
              {!examMode && <RatingBadge rating={problem.rating} estimated={problem.ratingEstimated} english={uiEnglish} />}
              {/* Line 500's best approach, like GfG's expected complexity: folded until asked for. */}
              {!examMode && problem.targetComplexity && (
                <button
                  className="cs-statement-pill"
                  aria-expanded={targetOpen}
                  onClick={() => setTargetOpen((open) => !open)}
                >
                  <Gauge size={15} />
                  {uiEnglish ? 'Target complexity' : '目标复杂度'}
                  {targetOpen &&
                    (uiEnglish
                      ? `: ${problem.targetComplexity.time} time, ${problem.targetComplexity.space} extra space`
                      : `：时间 ${problem.targetComplexity.time}，额外空间 ${problem.targetComplexity.space}`)}
                </button>
              )}
              {!examMode && topics.length > 0 && (
                <button
                  className="cs-statement-pill"
                  aria-expanded={!settings.hideTags}
                  aria-controls="problem-topics"
                  title={
                    uiEnglish
                      ? 'Show or hide topic tags; this browser remembers'
                      : '显示 / 隐藏专题标签，此浏览器会记住'
                  }
                  onClick={() =>
                    changeSettings({
                      // Before the problem loads, settings are still the defaults:
                      // merge onto the stored ones instead of overwriting them.
                      ...(loadedProblem ? settings : readEditorSettings(userId)),
                      hideTags: !settings.hideTags,
                    })
                  }
                >
                  <Tag size={15} />
                  {uiEnglish ? 'Topics' : '主题'}
                </button>
              )}
              {!examMode && !wb.on && !sourceBody && !problem.oaHints && statement.hints.length > 0 && (
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
                    isStarter(draft.current.code, language, problem.starters)
                  )
                    updateCode(
                      problem.starters?.[language] ||
                        starterTemplates[next][language],
                    );
                  setHintCount(0);
                  setHintsOpen(false);
                }}
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
              {/* Acceptance, votes and sharing: none of them during a mock OA; the time limit stays. */}
              <ProblemMeta
                problemId={problem.id}
                title={statement.title}
                english={uiEnglish}
                signedIn={!!boot.person}
                timeLimit={problem.timeLimits?.[language] ?? problem.timeLimit}
                limitOnly={examMode}
              />
            </div>
            {/* Company reports are a hint too: never during a mock. */}
            {!examMode && !!problem.companies?.length && (
              <CompanyTags companies={problem.companies} english={uiEnglish} />
            )}
            {!examMode && !settings.hideTags && topics.length > 0 && (
              <div className="cs-statement-topics" id="problem-topics">
                {topics.map((tag) => (
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
            <div className="cs-problem-prose" ref={prose}>
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
                  {!sourceBody &&
                    (markdownStatement ? (
                      <StatementMarkdown body={statement.description} />
                    ) : (
                      <p style={{ whiteSpace: 'pre-wrap' }}>
                        {statement.description}
                      </p>
                    ))}
                  <h3>{uiEnglish ? 'Input' : '输入格式'}</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{statement.input}</p>
                  <h3>{uiEnglish ? 'Output' : '输出格式'}</h3>
                  {markdownStatement ? (
                    <StatementMarkdown body={statement.output} />
                  ) : (
                    <p style={{ whiteSpace: 'pre-wrap' }}>{statement.output}</p>
                  )}
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
            {!examMode && !wb.on && !sourceBody && !problem.oaHints && hintsOpen && statement.hints.length > 0 && (
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
            {problem.curatedHint && !examMode && !wb.on && (
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
            {problem.lingHints && !examMode && !wb.on && (
              <HintLadder
                problemId={problem.id}
                userId={userId}
                hints={problem.lingHints}
                ladder={hintLadder}
                english={uiEnglish}
                stop={problem.stop}
              />
            )}
            {/* An OA guide's ladder; the server dropped the package's own hints for it. */}
            {problem.oaHints && !examMode && !wb.on && (
              <HintLadder
                problemId={problem.id}
                userId={userId}
                hints={problem.oaHints}
                ladder={hintLadder}
                english={uiEnglish}
                levels={OA_LEVELS}
              />
            )}
            {/* Off unless the server has AI configured; never during a mock OA or on SQL problems. */}
            {aiOn && (
              <AiTutor
                tutor={aiTutor}
                language={language}
                codingMode={codingMode}
                code={code}
                english={uiEnglish}
                accepted={submission?.mode === 'judge' && submission.status === 'accepted'}
                failed={!!submission && FAILED_VERDICTS.has(submission.status)}
              />
            )}
            {aiOn && (
              <AskAiSelection
                container={prose}
                english={uiEnglish}
                disabled={aiTutor.busy !== null}
                onAsk={(selection) => {
                  void aiTutor.ask('explain', aiContext, { selection });
                  document.getElementById('ai-tutor-title')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }}
              />
            )}
            {!!problem.similar?.length && !examMode && (
              <SimilarProblems
                items={problem.similar}
                english={uiEnglish}
                navigate={navigate}
              />
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
                    {!isTrackLanguage(item.language) &&
                      ` · ${item.codingMode === 'leetcode' ? 'LeetCode' : 'ACM'}`}
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
      <div className="cs-code-caption" onDoubleClick={maxOnDoubleClick('code')}>
        <Code2 size={15} />
        <strong>{t('代码', 'Code')}</strong>
        <span>{editorFile}</span>
        <div className="cs-editor-run-actions">
          <Button
            ref={runButton}
            variant="ghost"
            hidden={wb.on}
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
            {submitting || (draftActive && submission?.mode !== 'run') ? (
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
        {maxButton('code')}
      </div>
      <div className="cs-editor-toolbar">
        <div className="cs-editor-controls">
          {!isTrackLanguage(language) && (
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
          )}
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
          {/* ponytail: a new tab during a mock blurs the page, which the replay counts as time away. */}
          {!examMode && (
            <button
              aria-label={t('判题环境：版本、编译命令和限制', 'Judge environment: versions, commands and limits')}
              title={t('判题环境：版本、编译命令和限制', 'Judge environment: versions, commands and limits')}
              onClick={() => window.open('/judge-environment', '_blank', 'noopener')}
            >
              <Info size={15} />
            </button>
          )}
          {followUp && <FollowUpToggle rule={followUp} on={followUpOn} onChange={setFollowUpOn} english={uiEnglish} />}
          <button
            aria-label={t('下载当前代码', 'Download code')}
            title={t('下载当前代码', 'Download code')}
            onClick={downloadCode}
          >
            <Download size={15} />
          </button>
          {codingMode === 'acm' && !isTrackLanguage(language) && (
            <button
              aria-label={t('在 Playground 打开', 'Open in Playground')}
              title={t(
                '在 Playground 打开：带上代码和当前输入，可改可分享，不算提交',
                'Open in Playground with this code and input: edit and share freely, never a submission',
              )}
              onClick={() => void openPlayground()}
            >
              <SquareTerminal size={15} />
            </button>
          )}
          {/* A problem's own starter carries a fixed driver that already reads the input. */}
          {codingMode === 'acm' &&
            !isTrackLanguage(language) &&
            !problem.starters?.[language] && (
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
            hidden={wb.on}
            onClick={() => suggest.current?.()}
          >
            {t('触发补全', 'Autocomplete')}
          </button>
          {!isTrackLanguage(language) && (
            <button
              title={t(
                '用语言服务格式化代码（Shift + Alt + F）',
                'Format the code with the language service (Shift + Alt + F)',
              )}
              className="cs-suggest-trigger"
              hidden={wb.on}
              disabled={!ready || intelligence.state === 'unavailable'}
              onClick={() => format.current?.()}
            >
              {t('格式化', 'Format')}
            </button>
          )}
        </div>
      </div>
      {drillN !== null && (
        <output className="cs-draft-restored">
          <span>
            {!drillItem
              ? drillError
                ? say(drillError)
                : t('正在载入调试练习…', 'Loading the debugging drill…')
              : drillPassed
                ? t(
                    `修好了：全部测试通过，只改了 ${drillVerdict} 行。`,
                    `Fixed: every test passes and you changed ${lineCount(drillVerdict!)}.`,
                  )
                : drillVerdict !== null
                  ? t(
                      `全部测试通过，但改了 ${drillVerdict} 行，超过 ${drillItem.budget} 行的上限。只改出错的那几行再提交一次。`,
                      `Every test passes, but you changed ${lineCount(drillVerdict)}, over the ${drillItem.budget}-line limit. Change only the faulty lines and submit again.`,
                    )
                  : drillChanged === null
                    ? t('这道调试练习是 Python 代码，切回 Python 继续。', 'This drill is Python code: switch back to Python to continue.')
                    : t(
                        `调试练习：这段代码里埋了 bug，最多改 ${drillItem.budget} 行把它修好。已改 ${drillChanged} 行${drillChanged > drillItem.budget ? '，超过上限' : ''}。`,
                        `Debugging drill: this code has a planted bug. Fix it by changing at most ${lineCount(drillItem.budget)}. Changed so far: ${drillChanged}${drillChanged > drillItem.budget ? ', over the limit' : ''}.`,
                      )}
          </span>
          {drillItem && (
            <button
              type="button"
              onClick={() =>
                setReplaceRequest({
                  code: drillItem.code,
                  language: 'python',
                  codingMode: 'acm',
                  title: t('恢复成有 bug 的原始代码？', 'Restore the original buggy code?'),
                })
              }
            >
              {t('恢复原代码', 'Reset code')}
            </button>
          )}
        </output>
      )}
      <WhiteboardResult wb={wb} />
      {restored && (
        <output className="cs-draft-restored">
          <span>
            {t(
              `已从另一台设备恢复（${draftAge(restored.at, 'zh')}）`,
              `Restored from another device (${draftAge(restored.at, 'en')})`,
            )}
          </span>
          <button type="button" onClick={() => updateCode(restored.previous)}>
            {t('撤销', 'Undo')}
          </button>
          <button
            type="button"
            aria-label={t('关闭提示', 'Dismiss')}
            onClick={() => setRestored(null)}
          >
            <X size={13} />
          </button>
        </output>
      )}
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
                  // A new editor and model (path) for whiteboard mode: plain text, no old markers.
                  key={`${codingMode}:${language}:${wb.on}`}
                  bare={wb.on}
                  value={code}
                  language={language}
                  problemId={problem.id}
                  onIntelligenceStatus={setIntelligence}
                  onSuggestReady={(action) => {
                    suggest.current = action;
                  }}
                  onFormatReady={(action) => {
                    format.current = action;
                  }}
                  onChange={updateCode}
                  path={`cswork://draft/${encodeURIComponent(userId)}/${problem.id}/${codingMode}/${editorFile}${wb.on ? '/wb' : ''}`}
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
                title={editorStatus}
                className={`cs-intelligence-status ${intelligence.state === 'unavailable' ? 'cs-unsaved' : ''}`}
              >
                {editorStatus}
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
            <div className="cs-console-header" onDoubleClick={maxOnDoubleClick('console')}>
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
              {maxButton('console')}
            </div>
            <div className="cs-console-scroll" hidden={consoleCollapsed}>
              {wb.on ? (
                <WhiteboardPad userId={boot.person ? userId : null} problemId={problem.id} />
              ) : bottomTab === 'input' ? (
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
                    {!isTrackLanguage(language) && !problem.httpApi && (
                      <DebugButton
                        language={language}
                        code={code}
                        stdin={inputMode === 'custom' ? stdin : (exampleCase ?? '')}
                        mode={codingMode}
                        template={codingMode === 'leetcode' ? templateFor('python', 'leetcode') : ''}
                      />
                    )}
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
                      <div className="cs-custom-cases">
                        <div
                          className="cs-case-tabs"
                          role="tablist"
                          aria-label={t('自定义用例', 'Custom cases')}
                        >
                          {customCases.map((_, index) => (
                            <button
                              key={index}
                              type="button"
                              role="tab"
                              aria-selected={index === caseIndex}
                              aria-controls="custom-case-input"
                              className={index === caseIndex ? 'selected' : ''}
                              onClick={() => setCaseIndex(index)}
                            >
                              {t(`用例 ${index + 1}`, `Case ${index + 1}`)}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          aria-label={t('新增用例', 'Add a case')}
                          title={t('新增用例', 'Add a case')}
                          disabled={customCases.length >= MAX_CASES}
                          onClick={() => addCase('')}
                        >
                          <Plus size={14} />
                        </button>
                        {exampleCase !== null && (
                          <button
                            type="button"
                            title={t(
                              '把当前样例复制为新用例',
                              'Copy the current example into a new case',
                            )}
                            disabled={
                              customCases.length >= MAX_CASES &&
                              !customCases.includes(exampleCase)
                            }
                            onClick={() => addCase(exampleCase)}
                          >
                            <Copy size={13} />
                            {t('复制样例', 'Copy example')}
                          </button>
                        )}
                        {caseParams && (
                          <button
                            type="button"
                            className="cs-raw-toggle"
                            aria-pressed={rawCase}
                            title={t('按原始文本编辑：每行一个 JSON 参数', 'Edit as raw text: one JSON argument per line')}
                            onClick={() => setRawCase((value) => !value)}
                          >
                            {t('原始文本', 'Raw text')}
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={t(
                            `删除用例 ${caseIndex + 1}`,
                            `Delete case ${caseIndex + 1}`,
                          )}
                          title={t(
                            `删除用例 ${caseIndex + 1}`,
                            `Delete case ${caseIndex + 1}`,
                          )}
                          disabled={customCases.length === 1 && !stdin}
                          onClick={deleteCase}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {caseFields ? (
                        <div
                          id="custom-case-input"
                          className="cs-case-fields"
                          role="group"
                          aria-label={t(
                            `自定义函数参数（用例 ${caseIndex + 1}）`,
                            `Custom function arguments (case ${caseIndex + 1})`,
                          )}
                        >
                          {caseParams!.map((param, index) => {
                            const issue = caseIssues?.[index] ?? caseBounds?.[index];
                            const issueId = `case-field-issue-${index}`;
                            const open = drawn.includes(param.name);
                            return (
                              <div key={param.name} className="cs-case-field">
                                <label>
                                  <span>
                                    <code>{param.name}</code> · {param.type}
                                  </span>
                                  <input
                                    value={caseFields[index]}
                                    spellCheck={false}
                                    autoComplete="off"
                                    aria-invalid={issue ? true : undefined}
                                    aria-describedby={issue ? issueId : undefined}
                                    onChange={(event) =>
                                      editCase(
                                        joinFields(
                                          caseFields.map((field, i) =>
                                            i === index ? event.target.value : field,
                                          ),
                                        ),
                                      )
                                    }
                                  />
                                </label>
                                {drawable(param.type) && (
                                  <button
                                    type="button"
                                    className="cs-structure-toggle"
                                    aria-pressed={open}
                                    aria-label={t(`${param.name} 的图示`, `Diagram of ${param.name}`)}
                                    onClick={() =>
                                      setDrawn((names) =>
                                        open ? names.filter((name) => name !== param.name) : [...names, param.name],
                                      )
                                    }
                                  >
                                    {t('图示', 'Diagram')}
                                  </button>
                                )}
                                {issue && (
                                  <p className="cs-field-issue" id={issueId}>
                                    {t(...issue)}
                                  </p>
                                )}
                                {open && !caseIssues?.[index] && (
                                  <StructureView type={param.type} value={fieldValue(caseFields[index])} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <textarea
                          id="custom-case-input"
                          className="cs-custom-input"
                          aria-label={
                            codingMode === 'leetcode'
                              ? t(
                                  `自定义函数参数（用例 ${caseIndex + 1}）`,
                                  `Custom function arguments (case ${caseIndex + 1})`,
                                )
                              : t(
                                  `自定义标准输入（用例 ${caseIndex + 1}）`,
                                  `Custom stdin (case ${caseIndex + 1})`,
                                )
                          }
                          value={stdin}
                          onChange={(event) => editCase(event.target.value)}
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
                      )}
                      {caseParams && !rawCase && !caseFields && (
                        <p className="cs-console-note" role="status">
                          {t(
                            `这个用例的行数和 ${caseParams.length} 个参数对不上，先按原始文本编辑。`,
                            `This case's lines don't match the ${caseParams.length} parameters, so it shows as raw text.`,
                          )}
                        </p>
                      )}
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
                          `运行只跑选中的用例并展示程序输出，用例保存在此浏览器（最多 ${MAX_CASES} 个）；提交时会运行题目的全部测试点。`,
                          ` Run tries the selected case and shows your program output; cases stay in this browser (up to ${MAX_CASES}). Submit runs all test cases.`,
                        )}
                      </p>
                      {aiOn && (
                        <AiCaseIdeas
                          tutor={aiTutor}
                          context={aiContext}
                          onAdd={(input) => addCase(input)}
                        />
                      )}
                      {boot.person && !examMode && codingMode === 'leetcode' && stressReady(problem.id) && (
                        <StressTest
                          problemId={problem.id}
                          code={code}
                          language={language}
                          checker={problem.checker}
                          onAdd={(input) => addCase(input)}
                        />
                      )}
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
                <>
                  {caseNote && (
                    <p className="cs-result-message" role="status">
                      {caseNote}
                    </p>
                  )}
                  <SubmissionResult
                    submission={submission}
                    cancel={cancel}
                    cancelling={cancelling}
                    inspect={() => inspect(submission)}
                    onUseInput={codingMode === 'acm' ? debugWithCase : undefined}
                    maxStdinBytes={maxStdinBytes}
                    ranCase={
                      submission.mode === 'run' && ranCase !== null
                        ? ranCase + 1
                        : undefined
                    }
                    reference={submission.mode === 'run' && ranCase !== null ? reference : null}
                    checker={problem.checker}
                    params={submission.codingMode === 'leetcode' ? problem.leetcodeParams : null}
                    returnType={submission.codingMode === 'leetcode' ? problem.leetcodeReturnType : null}
                    sealHidden={examMode}
                  />
                </>
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
      {contest && !exam && (
        <ContestBar contest={contest} problemId={problem.id} submissions={boot.submissions ?? []} navigate={navigate} />
      )}
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
          {!examMode && (
            <button
              className="cs-top-button"
              aria-label={t('随机一题', 'Random problem')}
              title={t('随机一道未通过的题，沿用题库的筛选', "A random unsolved problem, with the problem bank's filters")}
              disabled={shuffling}
              onClick={() => void shuffle()}
            >
              {shuffling ? <LoaderCircle size={15} className="cs-spin" /> : <Shuffle size={15} />}
              <span>{t('随机一题', 'Random')}</span>
            </button>
          )}
          {wb.available && (
            <WhiteboardToggle
              wb={wb}
              onEnter={() => setLeftTab((tab) => (tab === 'editorial' || tab === 'solutions' ? 'statement' : tab))}
            />
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
          {fullscreen !== null && (
            <button
              className="cs-top-button"
              aria-pressed={fullscreen}
              aria-label={t('浏览器全屏', 'Full screen')}
              title={t('浏览器全屏', 'Full screen')}
              onClick={() =>
                void (
                  fullscreen
                    ? document.exitFullscreen()
                    : document.documentElement.requestFullscreen()
                ).catch(() => {})
              }
            >
              {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
            </button>
          )}
        </div>
      </div>
      {success && exam && examMode && (
        <ExamAcceptedDialog
          session={exam.session}
          problemId={problem.id}
          language={success.language}
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
          language={success.language}
          runtimeMs={
            success.runtimeMs ??
            (typeof success.runtime === 'number'
              ? success.runtime * 1000
              : null)
          }
          memoryKb={success.memoryKb ?? success.memory ?? null}
          seconds={solveSeconds}
          activity={boot.activity}
          bought={boot.purchasedFreezes}
          fallbackNext={neighbors.next}
          english={uiEnglish}
          navigate={navigate}
          onClose={() => setSuccess(null)}
          openSolutions={
            boot.person && communityProblem(problem.id)
              ? (only) => {
                  setSuccess(null);
                  setSolutionsLanguage(only);
                  setLeftTab('solutions');
                  setMobilePane('statement');
                }
              : undefined
          }
          ai={aiOn ? { tutor: aiTutor, context: aiContext } : undefined}
          targetComplexity={problem.targetComplexity}
          notes={
            <AnalyzerNotes
              code={success.code ?? code}
              language={success.language}
              followUp={followUpOn && success.codingMode === 'leetcode' ? followUpRule(problem.id, success.language) : undefined}
              english={uiEnglish}
            />
          }
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
      <div className="cs-workspace-body" data-maximized={(!narrow && maximized) || undefined}>
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
              [t('格式化代码', 'Format code'), 'Shift + Alt / ⌥ + F'],
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
        sealHidden={examMode}
        note={
          inspected &&
          boot.person &&
          !examMode && (
            <>
              <SubmissionNote key={inspected.id} userId={userId} submissionId={inspected.id} />
              {/* Only on the learner's own accepted formal submission of a public problem (lib/server/code-reviews.ts). */}
              {inspected.mode === 'judge' && inspected.status === 'accepted' && communityProblem(inspected.problem_id) && (
                <ReviewLink key={`review-${inspected.id}`} submissionId={inspected.id} />
              )}
            </>
          )
        }
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
/** GET problem-stats: lib/server/problem-stats.ts. */
type Histogram = { edges: number[]; counts: number[] };
type Standing = {
  acceptance: { attempted: number; accepted: number } | null;
  beats: number | null;
  beatsMemory?: number | null;
  histogram?: { runtime: Histogram | null; memory: Histogram | null } | null;
};
type Metric = 'runtime' | 'memory';
/** The bucket holding `value`: edges are ascending, the last bucket includes its upper edge. */
export function bucketOf(edges: number[], value: number) {
  const last = edges.length - 2;
  for (let i = 0; i < last; i++) if (value < edges[i + 1]) return i;
  return last;
}
const metricValue = (metric: Metric, value: number) =>
  metric === 'runtime'
    ? `${value < 10 ? Number(value.toFixed(2)) : Math.round(value)} ms`
    : value >= 1024
      ? `${(value / 1024).toFixed(1)} MB`
      : `${Math.round(value)} KB`;

/**
 * Everyone's best runtime or memory in this language as a pure-CSS bar chart, the
 * learner's bucket lit, with its Beats %. Counts only (no bucket of fewer than three
 * people, see problem-stats); a bar opens the solutions in this language, never anyone's
 * submitted code.
 */
function Distribution({
  standing,
  runtimeMs,
  memoryKb,
  languageName,
  english,
  onBar,
}: {
  standing: Standing;
  runtimeMs: number | null;
  memoryKb: number | null;
  languageName: string;
  english: boolean;
  onBar?: () => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [pick, setPick] = useState<Metric>('runtime');
  const shapes = standing.histogram;
  if (!shapes) return null;
  const metric: Metric = shapes[pick] ? pick : pick === 'runtime' ? 'memory' : 'runtime';
  const shape = shapes[metric];
  if (!shape) return null;
  const mine = metric === 'runtime' ? runtimeMs : memoryKb;
  const at = mine === null ? -1 : bucketOf(shape.edges, mine);
  const tallest = Math.max(...shape.counts);
  const beats = (metric === 'runtime' ? standing.beats : standing.beatsMemory) ?? null;
  const name = { runtime: t('运行时间', 'Runtime'), memory: t('内存', 'Memory') };
  return (
    <figure className="cs-perf" aria-label={t(`${languageName} 通过者的${name[metric]}分布`, `${name[metric]} of everyone who solved it in ${languageName}`)}>
      <div className="cs-perf-head">
        <div className="cs-perf-toggle" role="group" aria-label={t('分布指标', 'Distribution')}>
          {(['runtime', 'memory'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={metric === item}
              disabled={!shapes[item]}
              onClick={() => setPick(item)}
            >
              {name[item]}
            </button>
          ))}
        </div>
        {beats !== null && (
          <strong className="cs-perf-beats">
            {t(`击败 ${beats}%`, `Beats ${beats}%`)}
          </strong>
        )}
      </div>
      <ol className="cs-perf-bars">
        {shape.counts.map((count, i) => {
          const range = `${metricValue(metric, shape.edges[i])} – ${metricValue(metric, shape.edges[i + 1])}`;
          const label = t(
            `${range}：${count} 人${i === at ? '，你在这里' : ''}`,
            `${range}: ${count} ${count === 1 ? 'person' : 'people'}${i === at ? ', you are here' : ''}`,
          );
          return (
            <li key={i} data-mine={i === at || undefined}>
              <button
                type="button"
                style={{ '--cs-bar': `${count ? Math.max(6, (100 * count) / tallest) : 0}%` } as CSSProperties}
                aria-label={onBar ? `${label}${t('。查看题解', '. Show solutions')}` : label}
                title={label}
                disabled={!onBar}
                onClick={onBar}
              />
            </li>
          );
        })}
      </ol>
      <figcaption className="cs-perf-axis">
        <span>{metricValue(metric, shape.edges[0])}</span>
        {onBar && <span>{t(`点柱子看 ${languageName} 题解`, `Tap a bar for ${languageName} solutions`)}</span>}
        <span>{metricValue(metric, shape.edges.at(-1)!)}</span>
      </figcaption>
    </figure>
  );
}

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
  language,
  runtimeMs,
  memoryKb,
  seconds,
  activity,
  bought,
  fallbackNext,
  english,
  navigate,
  onClose,
  openSolutions,
  ai,
  targetComplexity,
  notes,
}: {
  problemId: string;
  language: string;
  runtimeMs: number | null;
  memoryKb: number | null;
  /** Opens the solutions tab filtered to one language ('' for all). */
  openSolutions?: (language: string) => void;
  /** The AI tutor, when on: "analyse complexity" joins the dialog. */
  ai?: { tutor: ReturnType<typeof useAiTutor>; context: AiContext };
  /** Line 500's target complexity, shown beside the AI analysis to compare against. */
  targetComplexity?: OJProblem['targetComplexity'];
  /** Rule-based notes on the accepted code (components/analyzer-notes.tsx). */
  notes?: ReactNode;
  line: boolean;
  /** The classic list the problem was opened from; its order wins over Line 500's. */
  library?: string;
  acceptedAt: number;
  seconds: number | null;
  activity?: Activity[];
  /** Streak freezes bought with points (bootstrap purchasedFreezes). */
  bought?: number[];
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
        [],
        undefined,
        bought,
      ),
    [activity, problemId, acceptedAt, now, english, bought],
  );
  // Aggregates only (lib/server/problem-stats.ts); null below its sample floors.
  const [standing, setStanding] = useState<Partial<Standing> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ language });
    // Unrounded: C++/Go runs crowd 1-5 ms, and rounding would pass slower runs as faster.
    if (runtimeMs != null) query.set('runtimeMs', String(runtimeMs));
    if (memoryKb != null) query.set('memoryKb', String(memoryKb));
    ojRequest<Standing>(
      `problem-stats/${encodeURIComponent(problemId)}?${query}`,
      undefined,
      controller.signal,
    ).then(setStanding, () => {
      /* A nicety: the dialog never waits on or fails with it. */
    });
    return () => controller.abort();
  }, [problemId, language, runtimeMs, memoryKb]);
  const acceptance = standing?.acceptance;
  const beats = standing?.beats ?? null;
  const languageName =
    languages.find((item) => item.id === language)?.name ?? language;
  const staticTrack = library === 'sql' || library === 'core';
  const [next, setNext] = useState<NextStop | 'loading'>(() => {
    if (!staticTrack) return 'loading';
    // The SQL and Core Skills tracks are static lists with no server collection:
    // the next unsolved problem, in the order the track's page remembered.
    const solved = new Set(activity?.map((item) => item.problem_id));
    const id = nextUnsolved(problemSequence(), problemId, solved);
    return id ? { id } : null;
  });
  useEffect(() => {
    if (staticTrack) return;
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
  }, [problemId, line, library, staticTrack, fallbackNext]);
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
          {(acceptance || beats !== null) && (
            <p className="cs-accepted-standing">
              {acceptance && (
                <span>
                  {t(
                    `${acceptance.accepted} / ${acceptance.attempted} 人通过（${Math.round((100 * acceptance.accepted) / acceptance.attempted)}%）`,
                    `${acceptance.accepted} of ${acceptance.attempted} people solved it (${Math.round((100 * acceptance.accepted) / acceptance.attempted)}%)`,
                  )}
                </span>
              )}
              {beats !== null && (
                <span>
                  {t(
                    `运行时间快于本站 ${beats}% 的 ${languageName} 通过者`,
                    `Faster than ${beats}% of people who solved it in ${languageName}`,
                  )}
                </span>
              )}
            </p>
          )}
          {standing?.histogram && (
            <Distribution
              standing={standing as Standing}
              runtimeMs={runtimeMs}
              memoryKb={memoryKb}
              languageName={languageName}
              english={english}
              onBar={
                openSolutions &&
                (() => openSolutions(['python', 'cpp', 'java', 'go'].includes(language) ? language : ''))
              }
            />
          )}
          {ai && targetComplexity && (
            <p className="cs-accepted-standing">
              {t(
                `目标复杂度：时间 ${targetComplexity.time}，额外空间 ${targetComplexity.space}`,
                `Target: ${targetComplexity.time} time, ${targetComplexity.space} extra space`,
              )}
            </p>
          )}
          {ai && <AiComplexity tutor={ai.tutor} context={ai.context} />}
          {notes}
          <AcceptedExtras
            problemId={problemId}
            acceptedAt={acceptedAt}
            activity={activity}
            bought={bought}
            english={english}
          />
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
          <label>
            <span>
              {t('键位', 'Keybindings')}
              <small>
                {t(
                  'Vim 模式下 :w 保存草稿；Emacs 模式下 C-s 是搜索，C-x C-s 保存草稿',
                  'In Vim mode, :w saves the draft. In Emacs mode, C-s searches and C-x C-s saves the draft',
                )}
              </small>
            </span>
            <select
              value={settings.keymap}
              onChange={(event) =>
                change({
                  ...settings,
                  keymap: event.target.value as EditorSettings['keymap'],
                })
              }
            >
              <option value="default">{t('默认', 'Default')}</option>
              <option value="vim">Vim</option>
              <option value="emacs">Emacs</option>
            </select>
          </label>
          <label>
            <span>
              {t('隐藏专题标签', 'Hide topic tags')}
              <small>
                {t(
                  '防剧透，练 OA 时建议打开；公司标签照常显示',
                  'No spoilers; recommended for OA practice. Company tags still show',
                )}
              </small>
            </span>
            <input
              type="checkbox"
              checked={settings.hideTags}
              onChange={(event) =>
                change({ ...settings, hideTags: event.target.checked })
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
