import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const asset = (file: string) =>
  readFileSync(join(process.cwd(), 'scripts/leetcode-mode/cpp', file), 'utf8');

function context(problemId: number, snippet?: string, source?: string) {
  const raw = asset('context.hpp');
  const used = snippet === undefined ? null : cleanSnippet(snippet);
  const definitions = [...raw.matchAll(/^(?:struct|class) (\w+) \{[\s\S]*?^};/gm)]
    .filter((match) => used === null || new RegExp(`\\b${match[1]}\\b`).test(used))
    .filter((match) => !source || !new RegExp(`\\b(?:struct|class)\\s+${match[1]}\\s*\\{`).test(cleanSnippet(source)))
    .map((match) => {
      let definition = match[0];
      if (problemId === 430 && match[1] === 'Node') {
        definition = definition.replace(
          'Node(int v,Node* l,Node* r,Node* n):val(v),left(l),right(r),next(n){}',
          'Node(int v,Node* p,Node* n,Node* c):val(v),next(n),prev(p),child(c){}',
        );
      }
      const guard = `CSWORK_LEETCODE_${match[1].toUpperCase()}`;
      return `#ifndef ${guard}\n#define ${guard}\n${definition}\n#endif`;
    });
  return `#include <bits/stdc++.h>\nusing namespace std;\n${definitions.join('\n')}\n`;
}

function cleanSnippet(snippet: string) {
  return snippet.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function interfaceOf(snippet: string) {
  const clean = cleanSnippet(snippet);
  const className = /\bclass\s+(\w+)/.exec(clean)?.[1];
  if (!className) throw new Error('LeetCode C++ template has no class');
  const methods = [...clean.matchAll(/\b(\w+)\s*\(([^)]*)\)\s*(?:const\s*)?\{/g)]
    .map((match) => ({ name: match[1], parameters: match[2] }));
  return { className, methods };
}

function constructorTypes(parameters: string): string[] {
  if (!parameters.trim()) return [];
  const parts: string[] = [];
  let start = 0, depth = 0;
  for (let i = 0; i < parameters.length; i++) {
    if (parameters[i] === '<') depth++;
    if (parameters[i] === '>') depth--;
    if (parameters[i] === ',' && depth === 0) {
      parts.push(parameters.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(parameters.slice(start));
  return parts.map((part) => {
    const type = part.trim().replace(/\b[A-Za-z_]\w*\s*$/, '').trim();
    if (!type || /[;{}#]/.test(type)) throw new Error('Invalid C++ constructor type');
    return type;
  });
}

export function getLeetCodeCppTemplate(problemId: number, snippet: string): string {
  interfaceOf(snippet);
  return `${context(problemId, snippet)}\n${snippet.trim()}\n`;
}

/** Produce native source only. Compilation and execution belong to go-judge. */
export function buildLeetCodeCpp(problemId: number, source: string, snippet: string): string {
  const { className, methods } = interfaceOf(snippet);
  let body: string;
  if (problemId === 297 || problemId === 449) {
    body = `Codec instance;
    Json::Array result;
    const auto operation = request.at("operation").str();
    for (const auto& argument : request.at("args").array()) {
      Json input(Json::Array{argument});
      if (operation == "serialize") result.push_back(call(graph, instance, &Codec::serialize, input).result);
      else if (operation == "deserialize") result.push_back(call(graph, instance, &Codec::deserialize, input).result);
      else throw runtime_error("Unknown codec operation");
    }
    answer = {result, request.at("args")};`;
  } else if (className === 'Solution') {
    const method = methods.find((method) => method.name !== className)?.name;
    if (!method) throw new Error('LeetCode C++ template has no solution method');
    body = `Solution instance; answer = call(graph, instance, &Solution::${method}, request.at("args"));`;
  } else {
    const constructor = methods.find((method) => method.name === className);
    if (!constructor) throw new Error('LeetCode C++ design template has no constructor');
    const types = constructorTypes(constructor.parameters);
    const allowed = methods.filter((method) => method.name !== className);
    const dispatch = allowed.map(({ name }, index) =>
      `${index ? 'else ' : ''}if (operation == "${name}") result.push_back(call(graph, *instance, &${className}::${name}, parameters[i]).result);`,
    ).join('\n      ');
    body = `const auto& operations = request.at("operations").array();
    const auto& parameters = request.at("parameters").array();
    if (operations.empty() || operations.size() != parameters.size() || operations[0].str() != "${className}") throw runtime_error("Invalid design trace");
    auto instance = construct<${[className, ...types].join(', ')}>(graph, parameters[0]);
    Json::Array result{Json()};
    for (size_t i = 1; i < operations.size(); ++i) {
      const auto operation = operations[i].str();
      ${dispatch}
      else throw runtime_error("Unknown design method");
    }
    answer = {result, request.at("args")};`;
  }
  return `${context(problemId, undefined, source)}
#line 1 "solution.cpp"
${source}
#line 1 "cswork-driver.cpp"
${asset('runtime.hpp')}
int main() {
  try {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    string input((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());
    auto request = cswork::Parser(input).parse();
    cswork::Graph graph;
    graph.load(request.at("nodes"));
    using namespace cswork;
    Answer answer;
    ${body}
    Json nodes = graph.serialize();
    Json response(Json::Object{{"result", answer.result}, {"args", answer.args}, {"nodes", nodes}});
    ofstream output("cswork-result.json", ios::binary | ios::trunc);
    if (!output) throw runtime_error("Cannot open result file");
    dump(output, response);
    output << '\\n';
    output.close();
    if (!output) throw runtime_error("Cannot write result file");
    return 0;
  } catch (const exception& error) {
    cerr << "LeetCode harness: " << error.what() << '\\n';
    return 1;
  }
}
`;
}
