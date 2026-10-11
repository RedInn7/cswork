'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Network, Plus, RotateCcw } from 'lucide-react';
import {
  courseDiagramConfig,
  courseDiagramLabel,
  prepareCourseDiagram,
} from '@/lib/course-diagram';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { useT } from '@/lib/i18n';
import '@/app/diagrams.css';

// English for the fallback labels of courseDiagramLabel(); accTitle text is course content.
const LABEL_EN: Record<string, string> = {
  课程时序图: 'Course sequence diagram',
  课程状态图: 'Course state diagram',
  课程流程图: 'Course flowchart',
};

let mermaidModule: Promise<(typeof import('mermaid'))['default']> | undefined;
function loadMermaid() {
  mermaidModule ??= import('mermaid')
    .then(({ default: mermaid }) => {
      mermaid.initialize(courseDiagramConfig());
      return mermaid;
    })
    .catch((error: unknown) => {
      mermaidModule = undefined;
      throw error;
    });
  return mermaidModule;
}

type DiagramImage = { url: string; width: number; height: number };
type DiagramResult = {
  source: string;
  attempt: number;
} & ({ image: DiagramImage; error?: never } | { image?: never; error: string });

function diagramImage(svg: string): DiagramImage {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = parsed.documentElement;
  if (root.localName !== 'svg' || parsed.querySelector('parsererror'))
    throw new Error('图表输出不完整。');
  const viewBox = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const width =
    viewBox?.[2] ?? Number.parseFloat(root.getAttribute('width') || '');
  const height =
    viewBox?.[3] ?? Number.parseFloat(root.getAttribute('height') || '');
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    throw new Error('无法确定图表大小。');
  // Render as an image instead of inserting SVG into the application DOM.
  // Image documents cannot execute scripts, bind links, or style the reader.
  root.setAttribute('width', String(Math.ceil(width)));
  root.setAttribute('height', String(Math.ceil(height)));
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(root)], {
      type: 'image/svg+xml',
    }),
  );
  return { url, width: Math.ceil(width), height: Math.ceil(height) };
}

function DiagramCanvas({
  image,
  label,
  zoom = 1,
}: {
  image: DiagramImage;
  label: string;
  zoom?: number;
}) {
  const t = useT();
  return (
    <section
      className="course-diagram-canvas"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users must be able to focus and scroll a wide or tall diagram.
      tabIndex={0}
      aria-label={t(`${label}，可滚动查看`, `${label}, scrollable`)}
    >
      {/* oxlint-disable-next-line nextjs/no-img-element -- This locally generated SVG uses an isolated image context and its intrinsic dimensions. */}
      <img
        src={image.url}
        alt={label}
        width={image.width * zoom}
        height={image.height * zoom}
        style={{ width: image.width * zoom, height: image.height * zoom }}
        draggable={false}
      />
    </section>
  );
}

export function CourseDiagram({ source }: { source: string }) {
  const t = useT();
  const target = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<DiagramResult | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const current =
    result?.source === source && result.attempt === attempt ? result : null;
  const sourceLabel = courseDiagramLabel(source);
  const label = t(sourceLabel, LABEL_EN[sourceLabel] ?? sourceLabel);

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    let rendered: DiagramImage | undefined;
    void (async () => {
      let container: HTMLDivElement | undefined;
      try {
        const text = prepareCourseDiagram(source);
        const mermaid = await loadMermaid();
        await document.fonts?.ready;
        if (!active) return;
        container = document.createElement('div');
        container.className = 'course-diagram-measure';
        container.setAttribute('aria-hidden', 'true');
        document.body.append(container);
        const { svg } = await mermaid.render(
          `course-${crypto.randomUUID()}`,
          text,
          container,
        );
        if (!active) return;
        rendered = diagramImage(svg);
        setResult({ source, attempt, image: rendered });
      } catch {
        if (active)
          setResult({
            source,
            attempt,
            error: '图表暂时无法显示，可以先查看源码，或稍后重试。',
          });
      } finally {
        container?.remove();
      }
    })();
    return () => {
      active = false;
      if (rendered) URL.revokeObjectURL(rendered.url);
    };
  }, [source, attempt, visible]);

  return (
    <figure className="course-diagram" ref={target}>
      <figcaption className="course-diagram-toolbar">
        <span>
          <Network aria-hidden="true" />
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!current?.image}
          onClick={() => {
            setZoom(1);
            setExpanded(true);
          }}
          aria-label={t(`展开${label}`, `Expand ${label}`)}
        >
          <Maximize2 aria-hidden="true" />
          {t('展开', 'Expand')}
        </Button>
      </figcaption>
      {current?.image ? (
        <DiagramCanvas image={current.image} label={label} />
      ) : (
        <output className="course-diagram-status">
          {current?.error
            ? t(
                current.error,
                "This diagram can't be shown right now. View its source below, or try again later.",
              )
            : visible
              ? t('正在绘制图表…', 'Drawing the diagram…')
              : t(
                  '滚动到此处后加载图表…',
                  'The diagram loads when you scroll here…',
                )}
          {current?.error && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAttempt((value) => value + 1)}
            >
              {t('重试', 'Retry')}
            </Button>
          )}
        </output>
      )}
      <div className="course-diagram-footnote">
        {t(
          '图表可横向滚动，展开后可缩放查看。',
          'Scroll sideways to see the whole diagram. Expand it to zoom.',
        )}
      </div>
      <details
        className="course-diagram-source"
        open={current?.error ? true : undefined}
      >
        <summary>{t('查看图表源码', 'View diagram source')}</summary>
        <pre>
          <code>{source}</code>
        </pre>
      </details>
      <Dialog open={expanded && !!current?.image} onOpenChange={setExpanded}>
        <DialogContent className="course-diagram-dialog">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              {t(
                '滚动查看完整图表，使用下方按钮调整大小。',
                'Scroll to see the full diagram. Use the buttons below to resize it.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div
            className="course-diagram-zoom"
            aria-label={t('图表缩放', 'Diagram zoom')}
          >
            <Button
              variant="outline"
              size="icon-sm"
              disabled={zoom <= 0.5}
              onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
              aria-label={t('缩小图表', 'Zoom out')}
            >
              <Minus />
            </Button>
            <span aria-live="polite">{Math.round(zoom * 100)}%</span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={zoom >= 2}
              onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
              aria-label={t('放大图表', 'Zoom in')}
            >
              <Plus />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom(1)}>
              <RotateCcw />
              {t('原始大小', 'Actual size')}
            </Button>
          </div>
          {current?.image && (
            <DiagramCanvas image={current.image} label={label} zoom={zoom} />
          )}
        </DialogContent>
      </Dialog>
    </figure>
  );
}
