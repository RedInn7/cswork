import { z } from 'zod';

/**
 * Plain text without control or invisible characters (no RTL overrides, zero widths, or the
 * Hangul fillers and braille blank that are letters/symbols but render as nothing), and with
 * at least one visible character when not empty.
 */
export const plain = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !/[\p{C}\u115F\u1160\u3164\uFFA0\u2800]/u.test(s) && (!s || /[\p{L}\p{N}\p{S}\p{P}]/u.test(s)));
