"""Opt-in native test against an isolated candidate go-judge, never a queue/DB.

GO_JUDGE_URL must explicitly point to the candidate runner. GO_JUDGE_TOKEN may be
provided directly or loaded from OJ_ENV_FILE (default /etc/cswork/oj.env).
Every generated executable is removed in finally; stdlib cache is only read.
"""
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request
import uuid

BASE = os.environ['GO_JUDGE_URL'].rstrip('/')
config = {}
env_file = Path(os.environ.get('OJ_ENV_FILE', '/etc/cswork/oj.env'))
if env_file.exists():
    for line in env_file.read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            key, value = line.split('=', 1)
            config[key] = value.strip('"\'')
TOKEN = os.environ.get('GO_JUDGE_TOKEN') or config['GO_JUDGE_TOKEN']
CACHE = '/usr/local/lib/cswork/go-stdlib-cache-v1'
HEADERS = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}


def request(path, body=None, method=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=HEADERS, method=method)
    with urllib.request.urlopen(req, timeout=75) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


def execute(args, source=None, compiling=False):
    return request('/run', {'cmd': [{
        'args': args,
        'env': ['PATH=/usr/bin:/bin', 'HOME=/w', 'LANG=C.UTF-8', 'TZ=UTC',
                'GOCACHE=' + CACHE, 'GOPATH=/tmp/go', 'GOTOOLCHAIN=local',
                'GOPROXY=off', 'GOSUMDB=off', 'CGO_ENABLED=0', 'GOMAXPROCS=2'],
        'files': [{'content': ''}, {'name': 'stdout', 'max': 65536, 'pipe': True},
                  {'name': 'stderr', 'max': 65536, 'pipe': True}],
        'cpuLimit': (30 if compiling else 2) * 10**9,
        'clockLimit': (60 if compiling else 6) * 10**9,
        'memoryLimit': (1024 if compiling else 256) * 1024**2,
        'procLimit': 64,
        'copyIn': source or {},
        'copyOutCached': ['main'] if compiling else [],
        'copyOutMax': 16 * 1024**2,
    }]})[0]


metadata = execute(['/bin/sh', '-c', 'go version; cat ' + CACHE + '/cswork-toolchain-v1'])
assert metadata['status'] == 'Accepted', metadata
lines = metadata['files']['stdout'].splitlines()
assert lines[0] == lines[1], 'cache and compiler toolchains differ'
assert 'build=go build -trimpath std' in lines
assert '"CGO_ENABLED": "0"' in metadata['files']['stdout']
print('PASS fixed toolchain/architecture/trimpath/CGO metadata', flush=True)

probe_path = CACHE + '/cswork-write-probe-' + uuid.uuid4().hex
write_probe = f'''from pathlib import Path
p = Path({probe_path!r})
try:
    p.write_text("must not persist")
except OSError:
    print("readonly")
else:
    p.unlink()
    raise AssertionError("stdlib cache is writable by a sandbox")
'''
result = execute(['/usr/bin/python3', '-I', '-c', write_probe])
assert result['status'] == 'Accepted' and result['files']['stdout'] == 'readonly\n', result
print('PASS sandbox cannot write shared cache', flush=True)

cases = [
    ('fresh-main', 'package main\nimport "fmt"\nfunc main(){fmt.Println("fresh-main")}'),
    ('gzip-sha', '''package main
import("bytes";"compress/gzip";"crypto/sha256";"fmt";"io")
func main(){var b bytes.Buffer;w:=gzip.NewWriter(&b);w.Write([]byte("readonly-cache"));w.Close();r,e:=gzip.NewReader(&b);if e!=nil{panic(e)};data,e:=io.ReadAll(r);if e!=nil{panic(e)};if sha256.Sum256(data)!=sha256.Sum256([]byte("readonly-cache")){panic("corrupt")};fmt.Println("gzip-sha")}
'''),
    ('png', '''package main
import("bytes";"image";"image/color";"image/png";"fmt")
func main(){m:=image.NewRGBA(image.Rect(0,0,2,2));m.Set(1,1,color.RGBA{255,0,0,255});var b bytes.Buffer;if e:=png.Encode(&b,m);e!=nil{panic(e)};decoded,e:=png.Decode(&b);if e!=nil{panic(e)};r,_,_,_:=decoded.At(1,1).RGBA();if r!=65535{panic("pixel")};fmt.Println("png")}
'''),
]
for label, source in cases:
    # A unique package source ensures each build is a miss for user code.
    source += '\n// fresh probe ' + uuid.uuid4().hex + '\n'
    compiled = execute(['/usr/bin/go', 'build', '-trimpath', '-o', 'main', 'main.go'],
                       {'main.go': {'content': source}}, compiling=True)
    try:
        assert compiled['status'] == 'Accepted', compiled
        file_id = compiled['fileIds']['main']
        result = execute(['main'], {'main': {'fileId': file_id}})
        assert result['status'] == 'Accepted' and result['files']['stdout'] == label + '\n', result
        print('PASS readonly main-package miss and stdlib import: ' + label, flush=True)
    finally:
        for file_id in compiled.get('fileIds', {}).values():
            request('/file/' + urllib.parse.quote(file_id, safe=''), method='DELETE')

invalid = execute(['/usr/bin/go', 'build', '-trimpath', '-o', 'main', 'main.go'],
                  {'main.go': {'content': 'package main\nfunc main(){notDefined()}'}}, compiling=True)
try:
    assert invalid['status'] != 'Accepted' and 'notDefined' in invalid['files']['stderr'], invalid
    print('PASS compile errors remain errors', flush=True)
finally:
    for file_id in invalid.get('fileIds', {}).values():
        request('/file/' + urllib.parse.quote(file_id, safe=''), method='DELETE')
