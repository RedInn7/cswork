"""Typed result records and non-executable output checkers shared with OJ fixtures."""
import json
import math
import re
from collections import Counter

KINDS = ('integer', 'string', 'integer-array', 'integer-set', 'string-set', 'integer-multiset')
CHECKERS = {'integer':'tokens', 'string':'exact', 'integer-array':'tokens',
            'integer-set':'int-set', 'string-set':'string-set', 'integer-multiset':'int-multiset'}
MAX_OUTPUT_BYTES = 4 * 1024 * 1024
MAX_ORACLE_BYTES = 32 * 1024 * 1024
MAX_SET_ITEMS = 1_000_000
ASCII_SPACE = re.compile(r'[\t\n\v\f\r ]+')
INTEGER = re.compile(r'^[+-]?[0-9]+$')
COUNT = re.compile(r'^(0|[1-9][0-9]{0,6})$')


def valid_text(value):
    if not isinstance(value,str) or '\0' in value:
        return False
    try:
        return len(value.encode('utf-8')) <= MAX_OUTPUT_BYTES
    except UnicodeEncodeError:
        return False


def validate_result(kind, value):
    """Strict typed oracle records; bool is not an integer result or array element."""
    if kind not in KINDS:
        raise ValueError('Unknown result kind')
    if kind == 'integer':
        if type(value) is not int:
            raise ValueError('Expected an integer result')
    elif kind == 'string':
        if not valid_text(value) or '\r' in value or '\n' in value:
            raise ValueError('Expected a bounded single-line string without NUL/CR/LF')
    else:
        if type(value) is not list or len(value)>MAX_SET_ITEMS:
            raise ValueError('Expected a bounded result array')
        if kind in ('integer-array','integer-set','integer-multiset'):
            if any(type(v) is not int for v in value):
                raise ValueError('Integer arrays cannot contain bool/float/string values')
        elif any(not valid_text(v) or '\n' in v or '\r' in v for v in value):
            raise ValueError('String-set elements must be single lines without NUL/CR')
        if kind.endswith('-set') and len(set(value)) != len(value):
            raise ValueError('Set results cannot contain duplicates')
    return value


def format_result(kind, value):
    """Canonical stdout for stdin-mode reference wrappers and formal expected data."""
    validate_result(kind,value)
    if kind=='integer':
        result=str(value)+'\n'
    elif kind=='string':
        result=value+'\n'
    elif kind=='string-set':
        result=str(len(value))+'\n'+''.join(v+'\n' for v in value)
    else:
        result=str(len(value))+'\n'+(' '.join(map(str,value))+'\n' if value else '')
    if not valid_text(result):
        raise ValueError('Formatted result exceeds maximum output size')
    return result


def decimal(value):
    if not INTEGER.fullmatch(value):
        raise ValueError('Expected a signed decimal integer')
    digits=value.lstrip('+-').lstrip('0') or '0'
    return '-'+digits if value.startswith('-') and digits!='0' else digits


def parse_set_output(output,checker):
    """Exactly mirrors parseOjSetOutput; no float coercion or permissive deduping."""
    if checker not in ('int-set','string-set','int-multiset') or not valid_text(output):
        return None
    normalized=output.replace('\r\n','\n')
    if '\n' not in normalized:
        return None
    header,body=normalized.split('\n',1)
    if not COUNT.fullmatch(header) or int(header)>MAX_SET_ITEMS:
        return None
    count=int(header)
    if checker in ('int-set','int-multiset'):
        values=[v for v in ASCII_SPACE.split(body) if v]
        if len(values)!=count:
            return None
        try:
            values=[decimal(v) for v in values]
        except ValueError:
            return None
    else:
        if not normalized.endswith('\n') or '\r' in body:
            return None
        values=[] if body=='' else body[:-1].split('\n')
        if len(values)!=count:
            return None
    if checker=='int-multiset':return Counter(values)
    unique=set(values)
    return unique if len(unique)==count else None


def compare_output(checker,actual,expected):
    if not isinstance(actual,str) or not isinstance(expected,str):
        return False
    if checker=='exact':
        return actual.replace('\r\n','\n')==expected.replace('\r\n','\n')
    if checker=='tokens':
        return [v for v in ASCII_SPACE.split(actual) if v]==[v for v in ASCII_SPACE.split(expected) if v]
    if checker in ('int-set','string-set','int-multiset'):
        left,right=parse_set_output(actual,checker),parse_set_output(expected,checker)
        return left is not None and right is not None and left==right
    return False


def validate_expected_output(kind,output):
    if not valid_text(output):
        raise ValueError('Invalid or oversized formal expected output')
    if kind in ('integer-set','string-set','integer-multiset'):
        if parse_set_output(output,CHECKERS[kind]) is None:
            raise ValueError('Invalid counted set expected output')
    elif kind=='integer':
        tokens=[v for v in ASCII_SPACE.split(output) if v]
        if len(tokens)!=1 or not INTEGER.fullmatch(tokens[0]):
            raise ValueError('Expected exactly one integer token')
    elif kind=='integer-array':
        tokens=[v for v in ASCII_SPACE.split(output) if v]
        if (not tokens or not COUNT.fullmatch(tokens[0]) or int(tokens[0])>MAX_SET_ITEMS
                or int(tokens[0])!=len(tokens)-1 or any(not INTEGER.fullmatch(v) for v in tokens[1:])):
            raise ValueError('Expected count followed by exactly that many integer tokens')
    elif kind=='string':
        normalized=output.replace('\r\n','\n')
        if not normalized.endswith('\n') or '\n' in normalized[:-1] or '\r' in normalized:
            raise ValueError('Expected one string line followed by a terminating newline')
    else:
        raise ValueError('Unknown result kind')


def same_result(kind,actual,expected):
    validate_result(kind,actual)
    validate_result(kind,expected)
    if kind=='integer-multiset':return Counter(actual)==Counter(expected)
    return set(actual)==set(expected) if kind.endswith('-set') else actual==expected


def compare_batch(stdout,expected,kind='integer',encoding='legacy-integer'):
    """JSONL preserves one result per invocation; never flatten nested results."""
    if not isinstance(stdout,str) or not isinstance(expected,list):
        return False
    try:
        for value in expected:
            validate_result(kind,value)
        if encoding=='legacy-integer':
            if kind!='integer':
                return False
            # Compatibility with the original batch wrapper's integer print lines.
            actual=[v for v in ASCII_SPACE.split(stdout) if v]
            return actual==[str(v) for v in expected]
        if encoding!='jsonl-v1':
            return False
        lines=stdout.replace('\r\n','\n').split('\n')
        if lines and lines[-1]=='':
            lines.pop()
        if len(lines)!=len(expected) or any(not line.strip() for line in lines):
            return False
        for line,value in zip(lines,expected):
            decoded=json.loads(line,parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Non-finite JSON')))
            if not same_result(kind,decoded,value):
                return False
        return True
    except (ValueError,TypeError,OverflowError):
        return False


def resource_limits(problem):
    """Missing fields retain legacy defaults; explicit invalid values fail closed."""
    if not isinstance(problem,dict):
        raise ValueError('Expected problem declaration')
    time=problem.get('timeLimit',2)
    memory=problem.get('memoryLimit',262144)
    output=problem.get('outputLimit',64)
    if (type(time) not in (int,float) or not math.isfinite(time) or not 0.1<=time<=10
            or type(memory) is not int or not 16384<=memory<=524288
            or type(output) is not int or not 1<=output<=4096):
        raise ValueError('Invalid declared CPU, memory, or output limit')
    return {'timeLimit':time,'memoryLimit':memory,'outputLimit':output}
