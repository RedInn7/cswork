import type { CodeLanguage } from './problems';

/**
 * A lesson snippet as a program that compiles: top-level declarations get the headers, the
 * class or the package around them and an empty main. Code that already has a main, and
 * Python, are returned as written. scripts/learn/check-snippets.mjs compiles exactly this.
 */
export function wholeProgram(language: CodeLanguage, code: string) {
  const body = code.trimEnd();
  if (language === 'cpp' && !/\bint\s+main\s*\(/.test(body))
    return `#include <bits/stdc++.h>\nusing namespace std;\n\n${body}\n\nint main() {}\n`;
  if (language === 'java' && !/\bstatic\s+void\s+main\s*\(/.test(body)) {
    // Imports cannot sit inside a class: they move above it.
    const lines = body.split('\n'),
      imports = lines.filter((line) => /^import\s/.test(line)),
      rest = lines.filter((line) => !/^import\s/.test(line)).join('\n').trim();
    const indented = rest.replace(/^(?=.)/gm, '    ');
    return `${imports.length ? `${imports.join('\n')}\n\n` : ''}public class Main {\n${indented}\n\n    public static void main(String[] args) {}\n}\n`;
  }
  if (language === 'go' && !/^func main\(\)/m.test(body))
    return `${/^package /m.test(body) ? '' : 'package main\n\n'}${body}\n\nfunc main() {}\n`;
  return code;
}
