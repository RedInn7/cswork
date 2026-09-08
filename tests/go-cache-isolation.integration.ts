// Explicit opt-in isolated go-judge test; no production queue or DB writes.
import assert from 'node:assert/strict';
import { compile, run, cleanup } from '../lib/server/oj-engine';
import type { OjProblemSpec } from '../lib/oj-types';
const spec: OjProblemSpec = {
  id: 'go-cache-probe',
  courseId: 'isolated',
  lessonId: 'isolated',
  title: 'Cache isolation probe',
  difficulty: '简单',
  tags: [],
  description: '',
  input: '',
  output: '',
  explanation: '',
  hints: [],
  checker: 'exact',
  languages: ['go'],
  timeLimit: 2,
  memoryLimit: 262144,
  outputLimit: 64,
};
assert.equal(process.env.GO_JUDGE_URL, 'http://127.0.0.1:5053');
const seed = '/usr/local/lib/cswork/go-stdlib-cache-v1';
async function probe(
  command: string,
  source: Record<string, { content: string }> = {},
) {
  const response = await fetch(`${process.env.GO_JUDGE_URL}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GO_JUDGE_TOKEN}`,
    },
    body: JSON.stringify({
      cmd: [
        {
          args: ['/bin/sh', '-c', command],
          env: [
            'PATH=/usr/bin:/bin',
            'HOME=/w',
            'GOCACHE=/tmp/go-cache',
            'GOPATH=/tmp/go',
            'GOTOOLCHAIN=local',
            'GOPROXY=off',
            'GOSUMDB=off',
            'CGO_ENABLED=0',
            'GOMAXPROCS=2',
          ],
          files: [
            { content: '' },
            { name: 'stdout', max: 65536, pipe: true },
            { name: 'stderr', max: 65536, pipe: true },
          ],
          cpuLimit: 30e9,
          clockLimit: 60e9,
          memoryLimit: 1024 * 1024 ** 2,
          procLimit: 64,
          copyIn: source,
        },
      ],
    }),
  });
  assert.ok(response.ok);
  const [result] = await response.json();
  assert.equal(result.status, 'Accepted', JSON.stringify(result));
  return result.files.stdout as string;
}
const digestCommand = `test -r ${seed}/cswork-toolchain-v1 && test -d ${seed}/00 && find ${seed} -type f -print0 > /tmp/seed-files && test -s /tmp/seed-files && sort -z /tmp/seed-files > /tmp/seed-sorted && xargs -0 sha256sum < /tmp/seed-sorted > /tmp/seed-digests && sha256sum /tmp/seed-digests`;
const before = await probe(digestCommand);
// Capture the real engine's fixed command, rather than duplicating its setup.
const originalFetch = globalThis.fetch;
let goCommand = '';
globalThis.fetch = async (_url, init) => {
  goCommand = JSON.parse(init!.body as string).cmd[0].args[2];
  return Response.json([
    { status: 'Accepted', fileIds: { main: 'capture-only' } },
  ]);
};
try {
  await compile('go', 'package main\nfunc main(){}', AbortSignal.timeout(1000));
} finally {
  globalThis.fetch = originalFetch;
}
assert.ok(
  goCommand.endsWith('exec /usr/bin/go build -trimpath -o main main.go'),
);
const setup = goCommand.slice(0, goCommand.lastIndexOf('exec /usr/bin/go'));
const validatePrivate = `import os,pathlib,json
p=pathlib.Path("/tmp/go-cache"); seed=pathlib.Path("${seed}")
assert (seed/"cswork-toolchain-v1").is_file()
assert (p/"00").is_dir() and not (p/"00").is_symlink() and os.access(p/"00",os.W_OK)
links=[x for d in p.iterdir() if d.is_dir() for x in d.iterdir() if x.is_symlink()]
assert links and all(str(x.resolve()).startswith(str(seed)+"/") for x in links)
assert not os.access(seed,os.W_OK) and not os.access(links[0],os.W_OK)
for name in ["trim.txt","README"]:
 f=p/name; assert not f.is_symlink(); f.write_text("private metadata"); assert f.is_file() and not f.is_symlink()
v=os.statvfs("/tmp"); count=sum(1 for _ in p.rglob("*")); assert v.f_files<=16384 and v.f_favail>1024 and count<15360
assert v.f_blocks*v.f_frsize==256*1024*1024
print(json.dumps(dict(seedLinks=len(links),privateEntries=count,totalInodes=v.f_files,freeInodes=v.f_favail)))`;
console.log(await probe(setup + `/usr/bin/python3 -I -c '${validatePrivate}'`));
// Repeat builds within one private cache, including a changed main package.
// A real stale trim marker exercises Trim rather than bypassing its writes.
console.log(
  await probe(
    setup +
      'printf "0\\n" > /tmp/go-cache/trim.txt; /usr/bin/go build -trimpath -o main main.go && /usr/bin/go build -trimpath -o main main.go && cp changed.go main.go && /usr/bin/go build -trimpath -o main main.go && df -Pi /tmp',
    {
      'main.go': {
        content: 'package main\nimport "fmt"\nfunc main(){fmt.Println("same")}',
      },
      'changed.go': {
        content:
          'package main\nimport("fmt";"crypto/sha256")\nfunc main(){fmt.Println(sha256.Sum256([]byte("changed")))}',
      },
    },
  ),
);
const sources = [
  ['first', 'package main\nimport "fmt"\nfunc main(){fmt.Println("first")}'],
  ['second', 'package main\nimport "fmt"\nfunc main(){fmt.Println("second")}'],
  [
    'gzip',
    'package main\nimport("bytes";"compress/gzip";"crypto/sha256";"fmt";"io")\nfunc main(){var b bytes.Buffer;w:=gzip.NewWriter(&b);w.Write([]byte("gzip"));w.Close();r,e:=gzip.NewReader(&b);if e!=nil{panic(e)};v,e:=io.ReadAll(r);if e!=nil||sha256.Sum256(v)!=sha256.Sum256([]byte("gzip")){panic("bad")};fmt.Println(string(v))}',
  ],
  [
    'png',
    'package main\nimport("bytes";"image";"image/png";"fmt")\nfunc main(){var b bytes.Buffer;if e:=png.Encode(&b,image.NewRGBA(image.Rect(0,0,2,2)));e!=nil{panic(e)};if _,e:=png.Decode(&b);e!=nil{panic(e)};fmt.Println("png")}',
  ],
] as const;
for (const [label, source] of sources) {
  const start = performance.now();
  const compiled = await compile('go', source, AbortSignal.timeout(65000));
  try {
    assert.equal(
      compiled.result.status,
      'Accepted',
      JSON.stringify(compiled.result),
    );
    const result = await run(
      compiled.program,
      '',
      spec,
      AbortSignal.timeout(15000),
    );
    assert.equal(result.status, 'Accepted', JSON.stringify(result));
    assert.equal(result.files?.stdout, `${label}\n`);
    console.log(
      JSON.stringify({
        label,
        passed: true,
        wallMs: performance.now() - start,
        compileMemoryBytes: compiled.result.memory,
      }),
    );
  } finally {
    await cleanup(compiled.program);
  }
}
const invalid = await compile(
  'go',
  'package main\nfunc main(){notDefined()}',
  AbortSignal.timeout(65000),
);
try {
  assert.notEqual(invalid.result.status, 'Accepted');
  assert.match(invalid.result.files?.stderr || '', /notDefined/);
} finally {
  await cleanup(invalid.program);
}
assert.equal(
  await probe(digestCommand),
  before,
  'shared stdlib cache content must remain byte-identical',
);
assert.match(
  await probe(`if test -w ${seed}; then exit 1; fi; df -Pk /tmp`),
  /262144/,
);
console.log(
  'PASS fresh sources, additional stdlib imports, CE, immutable seed digest, 256MiB /tmp',
);
