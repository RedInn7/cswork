// lib/question-body.ts: a question's Markdown split into the candidate's part and the reference notes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitBody } from '../lib/question-body';

const body = `# Rate limiter

Implement \`allow(ip, t)\`.

\`\`\`python
# Hints in a code comment stay in the question
def allow(ip, t): ...
\`\`\`

### Constraints
- n <= 10^5

### Hints
1. Keep a queue per IP.

### What a Strong Answer Covers
- Amortised O(1).

## Part 2: Many servers

Now share the limit.

### Hints
- Think about clocks.

### Follow-up Questions
- What if a server dies?

### Approach
Sliding window log.

---

## Solution

### Solution Alignment
Use a deque.`;

void test('a body splits into the candidate part and the interviewer notes', () => {
  const parts = splitBody(body);
  assert.match(parts.question, /^# Rate limiter/);
  assert.match(parts.question, /# Hints in a code comment/);
  assert.match(parts.question, /### Constraints\n- n <= 10\^5/);
  assert.match(parts.question, /## Part 2: Many servers\n\nNow share the limit\.$/);
  assert.doesNotMatch(parts.question, /queue per IP|Amortised|clocks|server dies|deque|Sliding/);
  assert.equal(parts.hints, '1. Keep a queue per IP.\n\n**Part 2: Many servers**\n\n- Think about clocks.');
  assert.equal(parts.followUps, '**Part 2: Many servers**\n\n- What if a server dies?');
  assert.equal(parts.rubric, '#### What a Strong Answer Covers\n- Amortised O(1).');
  assert.match(parts.solution, /^\*\*Part 2: Many servers\*\*\n\n#### Approach\nSliding window log\.\n\n### Solution Alignment\nUse a deque\.$/);
  // A title that looks like a section is still the question; no solution means none.
  assert.deepEqual(splitBody('# Follow-up email\nWrite it.'), {
    question: '# Follow-up email\nWrite it.', hints: '', followUps: '', rubric: '', solution: '',
  });
  // Quoted hints and grading notes in the question are the interviewer's too; a quote in code stays.
  const quoted = splitBody(`Sort it.

> **Hint: Use a heap**
>
> Pop the smallest.

\`\`\`text
> **Hint: in code stays**
\`\`\`

### Part 2

More.

> **Hint** Two heaps.

### Evaluation Focus
- O(n log n).

### Extensions to Discuss
1. Streams?`);
  assert.deepEqual(quoted, {
    question: 'Sort it.\n\n```text\n> **Hint: in code stays**\n```\n\n### Part 2\n\nMore.',
    hints: '**Hint: Use a heap**\n\nPop the smallest.\n\n**Part 2**\n\n**Hint** Two heaps.',
    followUps: '1. Streams?',
    rubric: '#### Evaluation Focus\n- O(n log n).',
    solution: '',
  });
});
