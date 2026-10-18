import type { SimKind } from './cs-sims';

/**
 * Bank questions whose answer a simulator works out: /oa/mcq links them to /oa/sims#kind once
 * answered. Its own file, with only a type import, so the MCQ page's client bundle never pulls in
 * the simulators; lib/cs-sims.ts re-exports it.
 */
export const MCQ_SIMS: Record<string, SimKind> = {
  'mcq-os-3': 'cpu-scheduling',
  'mcq-os-9': 'page-replacement',
  'mcq-os-10': 'page-replacement',
  'mcq-os-15': 'cpu-scheduling',
  'mcq-network-2': 'tcp-handshake',
  'mcq-network-8': 'tcp-handshake',
  // Flow control: the sliding-window demo's invariant says TCP's window is min(cwnd, rwnd).
  'mcq-network-11': 'sliding-window-arq',
  'mcq-network-12': 'tcp-congestion',
};
