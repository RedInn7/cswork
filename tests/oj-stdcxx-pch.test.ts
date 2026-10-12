import test from 'node:test';
import assert from 'node:assert/strict';
import { withStdcxxPch } from '../lib/server/oj-engine';

const WRAPPER = '#include <cswork/stdc++.hpp>';

test('the leading bits/stdc++.h include names the PCH wrapper on the same line', () => {
  const source = '// solution\n#include<bits/stdc++.h>  // all\nusing namespace std;\nint main(){ int x = "oops"; }\n#include <bits/stdc++.h>\n';
  const rewritten = withStdcxxPch(source);
  const before = source.split('\n'), after = rewritten.split('\n');
  // Same physical lines: diagnostics keep their numbers and quoted source.
  assert.equal(after.length, before.length);
  assert.equal(after[1], WRAPPER);
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
