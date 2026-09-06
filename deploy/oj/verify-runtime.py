#!/usr/bin/env python3
"""Verify only the independently owned cswork runtime; never prints credentials."""
import json
import os
import pathlib
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import urllib.parse

env_path = pathlib.Path('/etc/cswork/oj.env')
config = dict(line.split('=', 1) for line in env_path.read_text().splitlines() if '=' in line)
base = config['GO_JUDGE_URL']
token = config['GO_JUDGE_TOKEN']
checks = 0
cached = set()


def check(ok, label):
    global checks
    if not ok:
        raise AssertionError(label)
    checks += 1
    print(f'PASS {label}', flush=True)


def request(path, body=None, method=None, auth=True):
    headers = {'Content-Type': 'application/json'}
    if auth:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=65) as response:
        content = response.read()
        return json.loads(content) if content else None


def run(args, source=None, stdin='', cpu=2, clock=5, memory=256, out=65536, cached_out=None):
    cmd = {'args': args, 'env': ['PATH=/usr/bin:/bin', 'HOME=/w', 'LANG=C.UTF-8',
           'GOCACHE=/tmp/go-cache', 'GOTOOLCHAIN=local', 'GOPROXY=off', 'GOMAXPROCS=2'],
           'files': [{'content': stdin}, {'name': 'stdout', 'max': out, 'pipe': True}, {'name': 'stderr', 'max': out, 'pipe': True}],
           'cpuLimit': cpu * 10**9, 'clockLimit': clock * 10**9,
           'memoryLimit': memory * 1024**2, 'procLimit': 64, 'copyIn': source or {},
           'copyOutMax': 16 * 1024**2}
    if cached_out:
        cmd['copyOutCached'] = cached_out
    result = request('/run', {'cmd': [cmd]})[0]
    cached.update(result.get('fileIds', {}).values())
    return result


def accepted(result, label, expected=None):
    if result['status'] != 'Accepted':
        raise AssertionError(f'{label}: {json.dumps(result)[:2000]}')
    if expected is not None and result.get('files', {}).get('stdout') != expected:
        raise AssertionError(f'{label}: unexpected stdout {result.get("files")}')
    check(True, label)


def python(source, **limits):
    return run(['/usr/bin/python3', '-I', 'main.py'], {'main.py': {'content': source}}, **limits)


try:
    for attempt in range(40):
        try:
            version = request('/version')
            break
        except urllib.error.URLError:
            if attempt == 39:
                raise
            time.sleep(0.25)
    print('VERSION', json.dumps(version), flush=True)
    info = request('/config')
    flat = json.dumps(info)
    check('memory' in flat and 'pids' in flat and 'cpu' in flat, 'cgroup controllers available')
    check('"cgroupType": 2' in flat, 'cgroup v2 active without rusage fallback')
    logs = subprocess.check_output(['docker', 'logs', '--tail', '1000', 'cswork-oj-sandbox'], stderr=subprocess.STDOUT).decode()
    # Startup log lines may have rotated after many submissions. Verify the
    # kernel state of a fresh sandbox process instead of historical log text.
    accepted(python('''from pathlib import Path
status = dict(line.split(':', 1) for line in Path('/proc/self/status').read_text().splitlines())
assert status['Seccomp'].strip() == '2'
assert status['NoNewPrivs'].strip() == '1'
print('active')
'''), 'seccomp filter active in fresh sandbox process', 'active\n')
    check(token not in logs, 'runner token absent from runtime logs')
    inspect = json.loads(subprocess.check_output(['docker', 'inspect', 'cswork-oj-sandbox']))[0]
    host = inspect['HostConfig']
    check(not host['Privileged'], 'container is not privileged')
    check(host['CgroupnsMode'] == 'private', 'private cgroup namespace')
    check(not host.get('Binds'), 'no host directory bind mounts')
    check(host.get('NetworkMode') != 'host' and host.get('PidMode') != 'host', 'private network and PID namespace')
    check(host['PortBindings']['5050/tcp'][0]['HostIp'] == '127.0.0.1', 'executor only published on loopback')
    try:
        request('/run', {'cmd': [{'args': ['/usr/bin/true']}]}, auth=False)
        raise AssertionError('executor accepted unauthenticated request')
    except urllib.error.HTTPError as exc:
        check(exc.code == 401, 'unauthenticated request rejected')

    source = '#include <iostream>\nint main(){long a,b;std::cin>>a>>b;std::cout<<a+b<<"\\n";}\n'
    result = run(['/usr/bin/g++', '-std=c++20', '-O2', '-pipe', 'main.cpp', '-o', 'main'],
                 {'main.cpp': {'content': source}}, cpu=20, clock=30, memory=1024, cached_out=['main'])
    accepted(result, 'C++20 compiles once into reusable executable')
    binary = result['fileIds']['main']
    for stdin, expected in [('1 2\n', '3\n'), ('-8 12\n', '4\n')]:
        accepted(run(['main'], {'main': {'fileId': binary}}, stdin=stdin), 'C++ cached executable passes independent testcase', expected)

    accepted(python('a,b=map(int,input().split());print(a+b)\n', stdin='2 7\n'), 'Python isolated execution', '9\n')
    java = 'public class Main { public static void main(String[] a) { java.util.Scanner s=new java.util.Scanner(System.in); System.out.println(s.nextLong()+s.nextLong()); } }'
    result = run(['/bin/sh', '-c', '/usr/bin/javac -J-Xmx512m -J-XX:ActiveProcessorCount=1 -encoding UTF-8 Main.java && /usr/bin/jar cf main.jar *.class'],
                 {'Main.java': {'content': java}}, cpu=20, clock=30, memory=1024, cached_out=['main.jar'])
    accepted(result, 'Java compiles and caches all classes as JAR')
    accepted(run(['/usr/bin/java', '-Xmx192m', '-XX:ActiveProcessorCount=1', '-cp', 'main.jar', 'Main'],
                 {'main.jar': {'fileId': result['fileIds']['main.jar']}}, stdin='4 5\n'), 'Java cached JAR executes', '9\n')
    go = 'package main\nimport "fmt"\nfunc main(){var a,b int;fmt.Scan(&a,&b);fmt.Println(a+b)}\n'
    result = run(['/usr/bin/go', 'build', '-o', 'main', 'main.go'], {'main.go': {'content': go}},
                 cpu=40, clock=60, memory=1024, cached_out=['main'])
    accepted(result, 'Go compiles with network and toolchain downloads disabled')
    accepted(run(['main'], {'main': {'fileId': result['fileIds']['main']}} , stdin='3 8\n'), 'Go cached executable executes', '11\n')
    language_versions = {}
    for language, command in [('cpp', ['/usr/bin/g++', '--version']), ('python', ['/usr/bin/python3', '--version']),
                              ('java', ['/usr/bin/java', '-version']), ('go', ['/usr/bin/go', 'version'])]:
        version_result = run(command)
        accepted(version_result, f'{language} toolchain version available')
        outputs = version_result.get('files', {})
        language_versions[language] = (outputs.get('stdout') or outputs.get('stderr')).splitlines()[0]
    print('COMPILERS', json.dumps(language_versions), flush=True)

    accepted(python('''import os, pathlib, socket, ctypes
assert os.getuid() == 1536
for name in ['/etc/cswork/oj.env','/etc/cswork/cswork.env','/srv/cswork','/home/ubuntu','/var/run/docker.sock','/proc/1/root/etc/cswork']:
 try:
  assert not pathlib.Path(name).exists(), name
 except PermissionError:
  pass
try:
 socket.socket(socket.AF_INET,socket.SOCK_STREAM)
 raise AssertionError('network syscall allowed')
except PermissionError:
 pass
libc=ctypes.CDLL(None,use_errno=True)
assert libc.unshare(0x10000000) == -1 and ctypes.get_errno() == 1
status=pathlib.Path('/proc/self/status').read_text()
assert 'CapEff:\\t0000000000000000' in status
assert 'NoNewPrivs:\\t1' in status
assert 'Seccomp:\\t2' in status
print('isolated')
'''), 'UID, capabilities, seccomp, network and host file isolation', 'isolated\n')
    check(python('while True: pass\n', cpu=1, clock=2)['status'] == 'Time Limit Exceeded', 'infinite loop terminated by time limit')
    check(python('import time;time.sleep(10)\n', cpu=1, clock=1)['status'] == 'Time Limit Exceeded', 'wall clock timeout enforced')
    output_result = python('while True: print("x"*8192)\n', out=1024)
    check(output_result['status'] == 'Output Limit Exceeded' or any(e['type'] == 'CollectSizeExceeded' for e in output_result.get('fileError', [])), 'output flood terminated')
    check(python('a=[]\nwhile True:a.append(bytearray(1024*1024))\n', memory=32)['status'] == 'Memory Limit Exceeded', 'memory cgroup enforced')
    accepted(python('''import subprocess
p=[]
try:
 for i in range(100): p.append(subprocess.Popen(['/bin/sleep','5']))
except BlockingIOError:
 print('limited')
finally:
 for child in p: child.kill()
 for child in p: child.wait()
''', cpu=2, clock=4), 'process creation limit enforced', 'limited\n')
    check(python('raise RuntimeError("intentional")\n')['status'] == 'Nonzero Exit Status', 'runtime errors distinct from accepted')
    check(run(['/usr/bin/g++', 'main.cpp', '-o', 'main'], {'main.cpp': {'content': 'broken source'}}, cpu=5, clock=8, memory=512)['status'] == 'Nonzero Exit Status', 'compiler errors captured')
    accepted(python('open("temporary-marker","w").write("private")\n'), 'testcase can write its temporary work directory')
    accepted(python('import pathlib;assert not pathlib.Path("temporary-marker").exists();print("clean")\n'),
             'next testcase cannot see previous testcase files', 'clean\n')
    cancel_name = f'cancel_probe_{os.getpid()}.py'
    cancel_body = json.dumps({'cmd': [{'args': ['/usr/bin/python3', '-I', cancel_name],
        'env': ['PATH=/usr/bin:/bin'], 'files': [{'content': ''}, {'name': 'stdout', 'max': 1024}, {'name': 'stderr', 'max': 1024}],
        'cpuLimit': 10**9, 'clockLimit': 30 * 10**9, 'memoryLimit': 64 * 1024**2, 'procLimit': 4,
        'copyIn': {cancel_name: {'content': 'import time;time.sleep(20)\n'}}}]}).encode()
    endpoint = urllib.parse.urlparse(base)
    cancel_socket = socket.create_connection((endpoint.hostname, endpoint.port), timeout=3)
    try:
        cancel_socket.sendall((f'POST /run HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {len(cancel_body)}\r\n\r\n').encode() + cancel_body)
        def cancel_probe_running():
            return cancel_name in subprocess.check_output(['docker', 'top', 'cswork-oj-sandbox', '-eo', 'pid,args']).decode()
        for _ in range(20):
            if cancel_probe_running():
                break
            time.sleep(0.05)
        check(cancel_probe_running(), 'cancellation probe starts inside the sandbox')
    finally:
        cancel_socket.shutdown(socket.SHUT_RDWR)
        cancel_socket.close()
    for _ in range(40):
        if not cancel_probe_running():
            break
        time.sleep(0.05)
    check(not cancel_probe_running(), 'closing the HTTP request terminates the sandbox process')
    redis_env = os.environ.copy()
    redis_env['REDISCLI_AUTH'] = config['REDIS_PASSWORD']
    def redis(*args):
        return subprocess.check_output(['docker', 'exec', '-e', 'REDISCLI_AUTH', 'cswork-oj-redis', 'redis-cli', '--raw', *args], env=redis_env).decode().strip()
    check(redis('PING') == 'PONG', 'Redis password authentication')
    check(redis('CONFIG', 'GET', 'appendonly').splitlines()[-1] == 'yes', 'Redis AOF enabled')
    check(redis('CONFIG', 'GET', 'maxmemory-policy').splitlines()[-1] == 'noeviction', 'Redis queue data cannot be evicted')
    check(redis('CONFIG', 'GET', 'appendfsync').splitlines()[-1] == 'everysec', 'Redis AOF fsync policy verified')
    if '--restart-redis' in sys.argv:
        key = f'cswork:runtime-validation:{os.getpid()}'
        redis('SET', key, 'retained', 'EX', '120')
        time.sleep(2)
        subprocess.run(['docker', 'restart', 'cswork-oj-redis'], check=True, stdout=subprocess.DEVNULL)
        for _ in range(20):
            try:
                if redis('PING') == 'PONG':
                    break
            except subprocess.CalledProcessError:
                time.sleep(0.2)
        check(redis('GET', key) == 'retained', 'Redis queue persistence survives restart')
        redis('DEL', key)
    encoded_versions = json.dumps(language_versions, separators=(',', ':'))
    assert "'" not in encoded_versions
    env_lines = [line for line in env_path.read_text().splitlines() if not line.startswith('OJ_LANGUAGE_VERSIONS=')]
    env_path.write_text('\n'.join(env_lines + ["OJ_LANGUAGE_VERSIONS='" + encoded_versions + "'"]) + '\n')
    env_path.chmod(0o600)
finally:
    for file_id in cached:
        try:
            request('/file/' + file_id, method='DELETE')
        except Exception as exc:
            print('Cache cleanup failed:', type(exc).__name__, flush=True)
print(f'Validated {checks} runtime checks.', flush=True)
