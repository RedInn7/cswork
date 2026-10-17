import content from './content/interview-english.json';
import type { EnglishUnit } from './english-drill';

/** The interview English units in course order (app/english); kept out of lib/english-drill.ts so the browser bundle skips them. */
export const englishUnits = (content as { units: EnglishUnit[] }).units;
export const englishUnit = (slug: string) => englishUnits.find((unit) => unit.slug === slug);
