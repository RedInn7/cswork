/**
 * REST API problems (httpFixtures on an OA or rest- package): the sandbox has no network, so a
 * Python program's GETs are answered from the package's own JSON. Shared by the judge
 * (lib/server/oj-engine.ts), the GoJudge verifier (scripts/oa-judge/reference-sandbox.mjs) and
 * the offline generators. Fixtures are keyed "GET <path>" or "GET <path>?<query>", the query's
 * pairs sorted and form-encoded (urlencode), so the host and the order of parameters never matter.
 */
export const HTTP_FIXTURES_FILE = 'cswork_fixtures.json';
export const HTTP_FIXTURES_MAX_BYTES = 512 * 1024;
export const HTTP_FIXTURE_KEY = /^GET \/[^\s?#]*(?:\?[^\s#]+)?$/;

/**
 * Run as `python3 -I -c HTTP_FIXTURE_BOOTSTRAP main.py`: -I leaves the working directory off
 * sys.path, so the stubs are inline, not a module beside the program. It installs a minimal
 * `requests` (get, Session, exceptions) and urllib.request.urlopen over the fixtures, refuses
 * real sockets, then runs the program as __main__. A miss is a 404 with a JSON body.
 */
export const HTTP_FIXTURE_BOOTSTRAP = String.raw`
import io, json, runpy, socket, sys, types, urllib.error, urllib.parse, urllib.request
with open('cswork_fixtures.json', encoding='utf-8') as _f:
    _FIXTURES = json.load(_f)

def _key(url, params=None):
    parts = urllib.parse.urlsplit(str(url))
    pairs = urllib.parse.parse_qsl(parts.query, keep_blank_values=True)
    items = params.items() if hasattr(params, 'items') else (params or [])
    for name, value in items:
        for one in value if isinstance(value, (list, tuple)) else [value]:
            if one is not None:
                pairs.append((str(name), str(one)))
    query = urllib.parse.urlencode(sorted(pairs))
    return 'GET ' + (parts.path or '/') + ('?' + query if query else '')

def _answer(url, params=None):
    key = _key(url, params)
    if key in _FIXTURES:
        return 200, json.dumps(_FIXTURES[key])
    return 404, json.dumps({'error': 'Not Found', 'request': key})

class RequestException(IOError):
    def __init__(self, *args, response=None, **kwargs):
        super().__init__(*args)
        self.response = response
class HTTPError(RequestException): pass
class ConnectionError(RequestException): pass
class Timeout(RequestException): pass

class Response:
    def __init__(self, url, status, text):
        self.url, self.status_code, self.text = url, status, text
        self.content = text.encode('utf-8')
        self.ok = status < 400
        self.reason = 'OK' if self.ok else 'Not Found'
        self.headers = {'Content-Type': 'application/json'}
        self.encoding = 'utf-8'
    def json(self, **kwargs):
        return json.loads(self.text, **kwargs)
    def raise_for_status(self):
        if not self.ok:
            raise HTTPError('%d Client Error: %s for url: %s' % (self.status_code, self.reason, self.url), response=self)

def get(url, params=None, **kwargs):
    status, text = _answer(url, params)
    return Response(str(url), status, text)

class Session:
    def __init__(self):
        self.headers = {}
    def get(self, url, params=None, **kwargs):
        return get(url, params)
    def close(self):
        pass
    def __enter__(self):
        return self
    def __exit__(self, *exc):
        self.close()

_requests = types.ModuleType('requests')
_exceptions = types.ModuleType('requests.exceptions')
for _name, _value in (('RequestException', RequestException), ('HTTPError', HTTPError),
                      ('ConnectionError', ConnectionError), ('Timeout', Timeout)):
    setattr(_requests, _name, _value)
    setattr(_exceptions, _name, _value)
_requests.get, _requests.Session, _requests.Response, _requests.exceptions = get, Session, Response, _exceptions
sys.modules['requests'] = _requests
sys.modules['requests.exceptions'] = _exceptions

class _Body(io.BytesIO):
    def __init__(self, url, status, text):
        super().__init__(text.encode('utf-8'))
        self.url, self.status, self.code = url, status, status
        self.headers = {'Content-Type': 'application/json'}
    def getcode(self):
        return self.status
    def geturl(self):
        return self.url

def urlopen(url, data=None, timeout=None, **kwargs):
    target = url.full_url if isinstance(url, urllib.request.Request) else str(url)
    status, text = _answer(target)
    if status != 200:
        raise urllib.error.HTTPError(target, status, 'Not Found', {'Content-Type': 'application/json'}, io.BytesIO(text.encode('utf-8')))
    return _Body(target, status, text)
urllib.request.urlopen = urlopen

def _offline(*args, **kwargs):
    raise OSError(101, 'Network is unreachable (the judge is offline; use the given API)')
socket.socket.connect = socket.socket.connect_ex = _offline
socket.create_connection = socket.getaddrinfo = _offline

del _f, _name, _value
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name='__main__')
`;
