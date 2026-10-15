import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const asset = (file: string) =>
  readFileSync(join(process.cwd(), 'scripts/leetcode-mode/cpp', file), 'utf8');

/** Same JSON implementation in the trusted image and older-image fallback. */
export function getLeetCodeCppJsonRuntime(): string {
  const root = join(process.cwd(), 'deploy/oj/cpp-json-v1');
  const header = readFileSync(join(root, 'json-runtime.hpp'), 'utf8');
  const implementation = readFileSync(
    join(root, 'json-runtime.cpp'),
    'utf8',
  ).replace('#include "json-runtime.hpp"', '');
  return `// CSWORK_CPP_JSON_RUNTIME_V1
#if defined(CSWORK_PRECOMPILED_JSON_V1)
#include "/usr/local/include/cswork/json-v1.hpp"
#else
${header}
#define CSWORK_JSON_INLINE inline
${implementation}
#undef CSWORK_JSON_INLINE
#endif
`;
}

/** Standalone verification drivers use the same JSON and graph transport. */
export function getLeetCodeCppRuntime(): string {
  return getLeetCodeCppJsonRuntime() + asset('runtime.hpp');
}

// The runtime uses only cswork_platform::X. Like LeetCode, X is declared at
// global scope only when the official signature uses it; every other name is
// the learner's, at any scope.
function context(problemId: number, snippet: string) {
  const used = cleanSnippet(snippet);
  const global: string[] = [];
  const platform: string[] = [];
  for (const [definition, name] of asset('context.hpp').matchAll(
    /^(?:struct|class) (\w+) \{[\s\S]*?^};/gm,
  )) {
    const own =
      problemId === 430 && name === 'Node'
        ? definition.replace(
            'Node(int v,Node* l,Node* r,Node* n):val(v),left(l),right(r),next(n){}',
            'Node(int v,Node* p,Node* n,Node* c):val(v),next(n),prev(p),child(c){}',
          )
        : definition;
    if (new RegExp(`\\b${name}\\b`).test(used)) {
      global.push(own);
      platform.push(`using ::${name};`);
    } else platform.push(own);
  }
  return `#if __has_include("/usr/local/include/cswork/stdc++.hpp")\n#include "/usr/local/include/cswork/stdc++.hpp"\n#else\n#include <bits/stdc++.h>\n#endif\nusing namespace std;\n${global.join('\n')}\nnamespace cswork_platform {\n${platform.join('\n')}\n}\n`;
}

function cleanSnippet(snippet: string) {
  return snippet.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

// Restrict the lighter transport to a complete, ordinary official interface.
// Anything we do not recognize keeps the general graph transport.
function usesValueOnlyInterface(snippet: string) {
  const clean = cleanSnippet(snippet).trim();
  const method =
    /^class\s+Solution\s*\{\s*public:\s*([\w\s:<>,&]+?)\s+\w+\s*\(([^()]*)\)\s*\{\s*\}\s*};$/.exec(
      clean,
    );
  if (!method) return false;
  const valueType = (type: string): boolean => {
    const value = type
      .trim()
      .replace(/^const\s+/, '')
      .replace(/&$/, '')
      .trim();
    if (
      /^(?:void|bool|char|int|long long|double|string|std::string)$/.test(value)
    )
      return true;
    const vector = /^(?:std::)?vector\s*<([\s\S]+)>$/.exec(value);
    return !!vector && valueType(vector[1]) && vector[1].trim() !== 'void';
  };
  if (!valueType(method[1])) return false;
  try {
    return constructorTypes(method[2]).every(valueType);
  } catch {
    return false;
  }
}

function runtimeFor(snippet: string) {
  const runtime = asset('runtime.hpp');
  if (!usesValueOnlyInterface(snippet)) return runtime;
  const start = runtime.indexOf('void Graph::load(const Json& input){');
  const end = runtime.indexOf('template<class T> struct Method;', start);
  if (start < 0 || end < 0) return runtime;
  // Keep the same wire format, and fail closed if a graph is unexpectedly sent.
  // Standard classes remain available; only unreachable transport is omitted.
  return (
    runtime.slice(0, start) +
    `void Graph::load(const Json& input){
    if(!input.array().empty())throw runtime_error("Unexpected graph for value-only interface");
}
Json Graph::serialize(){
    if(!nodes.empty())throw runtime_error("Unexpected graph result for value-only interface");
    return Json::Array{};
}
` +
    runtime.slice(end)
  );
}

function interfaceOf(snippet: string) {
  const clean = cleanSnippet(snippet);
  const className = /\bclass\s+(\w+)/.exec(clean)?.[1];
  if (!className) throw new Error('LeetCode C++ template has no class');
  const methods = [
    ...clean.matchAll(/\b(\w+)\s*\(([^)]*)\)\s*(?:const\s*)?\{/g),
  ].map((match) => ({ name: match[1], parameters: match[2] }));
  return { className, methods };
}

function constructorTypes(parameters: string): string[] {
  if (!parameters.trim()) return [];
  const parts: string[] = [];
  let start = 0,
    depth = 0;
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
    const type = part
      .trim()
      .replace(/\b[A-Za-z_]\w*\s*$/, '')
      .trim();
    if (!type || /[;{}#]/.test(type))
      throw new Error('Invalid C++ constructor type');
    return type;
  });
}

export function getLeetCodeCppTemplate(
  problemId: number,
  snippet: string,
): string {
  interfaceOf(snippet);
  // Platform types and standard headers belong to the judge/LSP context.
  // Official node declarations are comments preceding the actual solution class.
  return `${snippet.trim().replace(/^(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*(?:\n|$)\s*)+/, '')}\n`;
}

/** Produce native source only. Compilation and execution belong to go-judge. */
export function buildLeetCodeCpp(
  problemId: number,
  source: string,
  snippet: string,
): string {
  const { className, methods } = interfaceOf(snippet);
  let body: string;
  if (problemId === 297 || problemId === 449) {
    body = `Codec instance;
    cswork::Json::Array result;
    const auto operation = request.at("operation").str();
    for (const auto& argument : request.at("args").array()) {
      cswork::Json input(cswork::Json::Array{argument});
      if (operation == "serialize") result.push_back(cswork::call(graph, instance, &Codec::serialize, input).result);
      else if (operation == "deserialize") result.push_back(cswork::call(graph, instance, &Codec::deserialize, input).result);
      else throw runtime_error("Unknown codec operation");
    }
    answer = {result, request.at("args")};`;
  } else if (className === 'Solution') {
    const method = methods.find((method) => method.name !== className)?.name;
    if (!method)
      throw new Error('LeetCode C++ template has no solution method');
    body = `Solution instance; answer = cswork::call(graph, instance, &Solution::${method}, request.at("args"));`;
  } else {
    const constructor = methods.find((method) => method.name === className);
    if (!constructor)
      throw new Error('LeetCode C++ design template has no constructor');
    const types = constructorTypes(constructor.parameters);
    const allowed = methods.filter((method) => method.name !== className);
    const dispatch = allowed
      .map(
        ({ name }, index) =>
          `${index ? 'else ' : ''}if (operation == "${name}") result.push_back(cswork::call(graph, *instance, &${className}::${name}, parameters[i]).result);`,
      )
      .join('\n      ');
    body = `const auto& operations = request.at("operations").array();
    const auto& parameters = request.at("parameters").array();
    if (operations.empty() || operations.size() != parameters.size() || operations[0].str() != "${className}") throw runtime_error("Invalid design trace");
    auto instance = cswork::construct<${[className, ...types].join(', ')}>(graph, parameters[0]);
    cswork::Json::Array result{cswork::Json()};
    for (size_t i = 1; i < operations.size(); ++i) {
      const auto operation = operations[i].str();
      ${dispatch}
      else throw runtime_error("Unknown design method");
    }
    answer = {result, request.at("args")};`;
  }
  return `${context(problemId, snippet)}
${getLeetCodeCppJsonRuntime()}
#line 1 "solution.cpp"
${source}
#line 1 "cswork-driver.cpp"
${runtimeFor(snippet)}
int main() {
  try {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    string input((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());
    auto request = cswork::Parser(input).parse();
    cswork::Graph graph;
    graph.load(request.at("nodes"));
    // Qualified: the learner may declare Answer, Json, call... at global scope.
    cswork::Answer answer;
    ${body}
    cswork::Json nodes = graph.serialize();
    cswork::Json response(cswork::Json::Object{{"result", answer.result}, {"args", answer.args}, {"nodes", nodes}});
    ofstream output("cswork-result.json", ios::binary | ios::trunc);
    if (!output) throw runtime_error("Cannot open result file");
    cswork::dump(output, response);
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

export { context as getLeetCodeCppContext };
