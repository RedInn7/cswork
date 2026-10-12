import test from 'node:test';
import assert from 'node:assert/strict';
import { withStdcxxPch } from '../lib/server/oj-engine';

/** The line a later statement reports after the rewrite, following #line like GCC does. */
function reportedLine(source: string, needle: string) {
  let line = 0;
  for (const text of source.split('\n')) {
    const directive = /^#line (\d+)$/.exec(text);
    if (directive) {
      line = Number(directive[1]) - 1;
      continue;
    }
    line++;
    if (text.includes(needle)) return line;
  }
  return -1;
}

test('the first bits/stdc++.h include goes through the precompiled header', () => {
  const source = '// solution\n#include<bits/stdc++.h>  // all\nusing namespace std;\nint main(){ int x = "oops"; }\n#include <bits/stdc++.h>\n';
  const rewritten = withStdcxxPch(source);
  assert.match(rewritten, /#if __has_include\("\/usr\/local\/include\/cswork\/stdc\+\+\.hpp"\)\n#include "\/usr\/local\/include\/cswork\/stdc\+\+\.hpp"\n#else\n#include <bits\/stdc\+\+\.h>\n#endif\n#line 3\n/);
  // Diagnostics keep the learner's numbering: the error is still on line 4.
  assert.equal(reportedLine(rewritten, 'int x = "oops"'), 4);
  // Only the first include is swapped; a repeated include stays as written.
  assert.equal(rewritten.split('#include <bits/stdc++.h>').length - 1, 2);
  assert.ok(rewritten.endsWith('\n#include <bits/stdc++.h>\n'));
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
  // Directives and line comments before it are fine, including Windows line endings.
  const crlf = '#define LOCAL 1\r\n// note\r\n#include <bits/stdc++.h>\r\nint main(){ return LOCAL; }\r\n';
  const rewritten = withStdcxxPch(crlf);
  assert.match(rewritten, /#line 4\n/);
  assert.equal(reportedLine(rewritten, 'int main()'), 4);
});
