'use client';

import { useEffect, useRef, useState } from 'react';
import { askedText, type RouteRun, type RouteStop } from '@/lib/route-stops';

// The entrance plays once per page load, not on every remount or refresh.
let routeAnimated = false;

/** Per-stage counts under the stage lens, or the whole stop. */
export function stopCounts(stop: RouteStop, stage: string) {
  return stage ? (stop.stages?.[stage] ?? stop) : stop;
}

/**
 * The 35 topics as stops on one line, in curriculum order. Native radios give
 * one Tab stop and arrow keys between stops; choosing a stop filters the list.
 */
export function RouteLine({
  stops,
  runs,
  currentSlug,
  selected,
  onSelect,
  stage,
  stageName,
  member,
  english,
  disabled,
}: {
  stops: RouteStop[];
  runs: RouteRun[];
  currentSlug: string;
  selected: string;
  onSelect: (slug: string) => void;
  stage: string;
  stageName: string;
  member: boolean;
  english: boolean;
  disabled?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [enter] = useState(() => !routeAnimated);
  useEffect(() => {
    routeAnimated = true;
  }, []);
  const current = Math.max(
    0,
    stops.findIndex((stop) => stop.slug === currentSlug),
  );
  // Centre the current stop inside the strip without scrolling the page.
  useEffect(() => {
    const scroller = box.current;
    const stop = scroller?.querySelector<HTMLElement>('[data-current]');
    if (scroller && stop)
      scroller.scrollLeft =
        stop.offsetLeft - (scroller.clientWidth - stop.offsetWidth) / 2;
  }, [currentSlug, stops.length]);
  const t = (zh: string, en: string) => (english ? en : zh);
  // Heat dots in thirds of the most asked stop's company count.
  const hottest = Math.max(1, ...stops.map((stop) => stop.companies ?? 0));
  return (
    <div className="route-scroll" ref={box}>
      <fieldset
        className="route-stops"
        data-enter={enter || undefined}
        disabled={disabled}
        style={
          {
            '--n': stops.length,
            '--p': stops.length > 1 ? current / (stops.length - 1) : 0,
          } as React.CSSProperties
        }
      >
        <legend className="sr-only">{t('线路站点', 'Stops on the line')}</legend>
        <div className="route-sections" aria-hidden="true">
          {runs.map((run) => (
            <span
              key={`${run.from}-${run.en}`}
              style={{ gridColumn: `${run.from + 1} / span ${run.span}` }}
              title={t(run.zh, run.en)}
            >
              {t(run.zh, run.en)}
            </span>
          ))}
        </div>
        <div className="route-track" aria-hidden="true">
          <i />
        </div>
        {stops.map((stop, i) => {
          const { solved, total } = stopCounts(stop, stage);
          const state =
            total === 0
              ? 'empty'
              : member && solved === total
                ? 'done'
                : member && solved > 0
                  ? 'partial'
                  : 'todo';
          const name = english ? stop.titleEn || stop.title : stop.title;
          const left = total - solved;
          const label =
            (member
              ? stage
                ? t(
                    `第 ${i + 1} 站：${name}，${stageName}已通过 ${solved}/${total}`,
                    `Stop ${i + 1}: ${name}, ${solved} of ${total} ${stageName} problems solved`,
                  )
                : t(
                    `第 ${i + 1} 站：${name}，已通过 ${solved}/${total}`,
                    `Stop ${i + 1}: ${name}, ${solved} of ${total} solved`,
                  )
              : t(
                  `第 ${i + 1} 站：${name}，共 ${total} 题`,
                  `Stop ${i + 1}: ${name}, ${total} problems`,
                )) +
            (stop.slug === currentSlug
              ? t('，下一站', ', next stop')
              : member && total && !left
                ? t('，已全部通过', ', all solved')
                : member && left > 0 && left <= 3
                  ? t(`，还差 ${left} 题`, `, ${left} to go`)
                  : '') +
            (stop.companies ? t('，', ', ') + askedText(stop, !english) : '');
          const heat = stop.companies ? Math.ceil((3 * stop.companies) / hottest) : 0;
          return (
            <label
              key={stop.slug}
              className="route-stop"
              data-state={state}
              data-start={stop.start || undefined}
              data-current={stop.slug === currentSlug || undefined}
              title={label}
              style={
                {
                  gridColumn: i + 1,
                  '--i': i,
                  '--frac': total ? solved / total : 0,
                } as React.CSSProperties
              }
            >
              <input
                className="sr-only"
                type="radio"
                name="route-stop"
                id={`route-stop-${stop.slug}`}
                value={stop.slug}
                checked={selected === stop.slug}
                disabled={total === 0 && selected !== stop.slug}
                aria-label={label}
                onChange={() => onSelect(stop.slug)}
                // A second click on the chosen stop shows the whole line again.
                onClick={() => {
                  if (selected === stop.slug) onSelect('');
                }}
              />
              <span className="route-dot" />
              {heat > 0 && <span className="route-heat" data-heat={heat} aria-hidden="true" />}
              <span className="route-label" aria-hidden="true">
                {english ? stop.shortEn : stop.shortZh}
              </span>
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}
