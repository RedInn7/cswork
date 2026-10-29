import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STD_HEADER_PCHS,
  stdHeaderPch,
  withStdcxxPch,
} from '../lib/server/oj-engine';

const WRAPPER = '#include <cswork/stdc++.hpp>';

test('the leading bits/stdc++.h include names the PCH wrapper on the same line', () => {
  const source = '// solution\n#include<bits/stdc++.h>  // all\nusing namespace std;\nint main(){ int x = "oops"; }\n#include <bits/stdc++.h>\n';
  const rewritten = withStdcxxPch(source);
  const before = source.split('\n'), after = rewritten.split('\n');
  // Same physical lines: diagnostics keep their numbers and quoted source.
  assert.equal(after.length, before.length);
  assert.equal(after[1], '#include<cswork/stdc++.hpp>  // all', 'only the header name changes');
  after[1] = before[1];
  assert.deepEqual(after, before, 'only that one line changes');
});

test('sources without it, and LeetCode drivers that already use it, are unchanged', () => {
  const plain = '#include <cstdio>\nint main(){}\n';
  assert.equal(withStdcxxPch(plain), plain);
  const driver = '#if __has_include("/usr/local/include/cswork/stdc++.hpp")\n#include "/usr/local/include/cswork/stdc++.hpp"\n#else\n#include <bits/stdc++.h>\n#endif\n';
  assert.equal(withStdcxxPch(driver), driver);
  const quoted = '#include "bits/stdc++.h"\n';
  assert.equal(withStdcxxPch(quoted), quoted);
});

test('an include after code or inside a block comment is left alone', () => {
  for (const source of [
    '/*\n#include <bits/stdc++.h>\n*/\n#include <iostream>\nint main(){}\n',
    'int x;\n#include <bits/stdc++.h>\n',
    '#include <iostream>\r\nusing namespace std;\r\n#include <bits/stdc++.h>\r\n',
  ])
    assert.equal(withStdcxxPch(source), source);
  // Directives and line comments before it are fine, Windows line endings kept.
  const crlf = '#define LOCAL 1\r\n// note\r\n#include <bits/stdc++.h>\r\nint main(){ return LOCAL; }\r\n';
  assert.equal(withStdcxxPch(crlf), crlf.replace('#include <bits/stdc++.h>', WRAPPER));
});

test('lines GCC would not read as that include are left alone', () => {
  for (const source of [
    '#include\u00a0<bits/stdc++.h>\nint main(){}\n', // NBSP: a compile error must stay one
    '\u3000#include <bits/stdc++.h>\nint main(){}\n',
    '// note \\\n#include <bits/stdc++.h>\nint main(){}\n', // continued comment
  ])
    assert.equal(withStdcxxPch(source), source);
  // A trailing comment ending in a backslash keeps continuing the next line.
  const tail = '#include <bits/stdc++.h> // all \\\nint unused;\nint main(){}\n';
  assert.equal(withStdcxxPch(tail), tail.replace('<bits/stdc++.h>', '<cswork/stdc++.hpp>'));
});

test('a header PCH set applies only within the leading standard includes', () => {
  const body = 'using namespace std;\nint count;\nint main(){}\n';
  assert.equal(
    stdHeaderPch('// hi\r\n#include<algorithm>\r\n\r\n#include <vector> // v\r\n#include <iostream>\r\n' + body),
    'iostream-vector-algorithm',
  );
  assert.equal(stdHeaderPch('#include <cstdio>\n#include <vector>\n#include <iostream>\n' + body), 'iostream-vector');
  assert.equal(stdHeaderPch('#include <iostream>\n#include <algorithm>\n' + body), 'iostream');
  // Headers included after code are not leading ones.
  assert.equal(stdHeaderPch('#include <cstdio>\n' + body + '#include <iostream>\n'), undefined);
  for (const lead of [
    '#define _GLIBCXX_DEBUG\n', // a macro could change what the headers declare
    '#pragma GCC optimize("O3")\n',
    '#ifdef LOCAL\n#endif\n',
    '#include "iostream"\n',
    '// note \\\n', // continues onto the next include
    '#include <iostream> // \\\n',
    '// note \\ \n', // GCC splices across the trailing space too
    '#include <iostream> // \\\t\n',
  ])
    assert.equal(stdHeaderPch(lead + '#include <iostream>\n#include <vector>\n' + body), undefined, lead);
});

test('every header PCH set is built into the runner image', () => {
  const words = readFileSync('deploy/oj/build-cpp-pch.sh', 'utf8').split(/[\s;]/);
  for (const set of STD_HEADER_PCHS) assert.ok(words.includes(set.join('-')), set.join('-'));
});
