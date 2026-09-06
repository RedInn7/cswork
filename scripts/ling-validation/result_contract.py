"""Typed result records and non-executable output checkers shared with OJ fixtures."""
import json
import math
import re
from collections import Counter
from itertools import zip_longest

KINDS = ('integer', 'string', 'integer-array', 'integer-set', 'string-set', 'integer-multiset')
KINDS += ('nullable-integer-array','integer-rows')
KINDS += ('integer-row-set','integer-bag-row-set','integer-row-multiset')
ROW_KINDS = ('integer-row-set','integer-bag-row-set','integer-row-multiset')
CHECKERS = {'integer':'tokens', 'string':'exact', 'integer-array':'tokens',
            'integer-set':'int-set', 'string-set':'string-set', 'integer-multiset':'int-multiset'}
CHECKERS.update({'nullable-integer-array':'tokens','integer-rows':'tokens'})
CHECKERS.update({kind:kind.replace('integer-','int-') for kind in ROW_KINDS})
MAX_OUTPUT_BYTES = 64 * 1024 * 1024
MAX_ORACLE_BYTES = 32 * 1024 * 1024
MAX_SET_ITEMS = 1_000_000
MAX_ROW_VALUES = 16_000_000
MAX_ROWS = 4_000_000
ASCII_SPACE = re.compile(r'[\t\n\v\f\r ]+')
INTEGER = re.compile(r'^[+-]?[0-9]+$')
COUNT = re.compile(r'^(0|[1-9][0-9]{0,6})$')
ROW_LENGTH = re.compile(r'^(0|[1-9][0-9]{0,7})$')

def tokens(value):
    return (m.group() for m in re.finditer(r'[^\t\n\v\f\r ]+',value))


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
        if type(value) is not list or len(value)>(MAX_ROWS if kind in ('integer-rows',)+ROW_KINDS else MAX_SET_ITEMS):
            raise ValueError('Expected a bounded result array')
        if kind in ('integer-rows',)+ROW_KINDS:
            if any(type(row)is not list or any(type(v)is not int for v in row) for row in value) or sum(map(len,value))>MAX_ROW_VALUES:
                raise ValueError('Expected bounded integer rows')
            if kind in ('integer-row-set','integer-bag-row-set') and len({tuple(sorted(row) if kind=='integer-bag-row-set' else row) for row in value})!=len(value):
                raise ValueError('Row sets cannot contain duplicates')
        elif kind=='nullable-integer-array':
            if any(v is not None and type(v)is not int for v in value):
                raise ValueError('Expected integers or null')
        elif kind in ('integer-array','integer-set','integer-multiset'):
            if any(type(v) is not int for v in value):
                raise ValueError('Integer arrays cannot contain bool/float/string values')
        elif any(not valid_text(v) or '\n' in v or '\r' in v for v in value):
            raise ValueError('String-set elements must be single lines without NUL/CR')
        if kind.endswith('-set') and kind not in ROW_KINDS and len(set(value)) != len(value):
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
    elif kind in ('integer-rows',)+ROW_KINDS:
        result=str(len(value))+'\n'+''.join(str(len(row))+(' '+' '.join(map(str,row)) if row else '')+'\n' for row in value)
    elif kind=='nullable-integer-array':
        result=str(len(value))+'\n'+(' '.join('null' if v is None else str(v) for v in value)+'\n' if value else '')
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
    counts=Counter();seen=0
    if checker in ('int-set','int-multiset'):
        iterator=tokens(body)
    else:
        if not normalized.endswith('\n') or '\r' in body:return None
        def lines():
            start=0
            while start<len(body):
                end=body.find('\n',start)
                yield body[start:end]
                start=end+1
        iterator=lines()
    try:
        for value in iterator:
            seen+=1
            if seen>count:return None
            value=decimal(value) if checker!='string-set' else value
            counts[value]+=1
            if checker!='int-multiset' and counts[value]>1:return None
    except ValueError:return None
    if seen!=count:return None
    return counts if checker=='int-multiset' else set(counts)


def compare_output(checker,actual,expected,input=None):
    from semantic_checkers import semantic_checker_id,matches_semantic
    pid=semantic_checker_id(checker)
    if pid is not None:return isinstance(input,str) and matches_semantic(pid,actual,expected,input)
    if not isinstance(actual,str) or not isinstance(expected,str):
        return False
    if checker=='exact':
        return actual.replace('\r\n','\n')==expected.replace('\r\n','\n')
    if checker=='tokens':
        return all(a==b for a,b in zip_longest(tokens(actual),tokens(expected),fillvalue=None))
    if checker in ('int-row-set','int-bag-row-set','int-row-multiset'):
        left,right=parse_row_collection(actual,checker),parse_row_collection(expected,checker)
        return left is not None and right is not None and left==right
    if checker in ('int-set','string-set','int-multiset'):
        left,right=parse_set_output(actual,checker),parse_set_output(expected,checker)
        return left is not None and right is not None and left==right
    return False


def validate_expected_output(kind,output):
    if not valid_text(output):
        raise ValueError('Invalid or oversized formal expected output')
    if kind in ROW_KINDS:
        if parse_row_collection(output,CHECKERS[kind]) is None:raise ValueError('Invalid integer row set')
    elif kind in ('integer-set','string-set','integer-multiset'):
        if parse_set_output(output,CHECKERS[kind]) is None:
            raise ValueError('Invalid counted set expected output')
    elif kind=='integer':
        values=tokens(output);first=next(values,None)
        if first is None or not INTEGER.fullmatch(first) or next(values,None) is not None:raise ValueError('Expected exactly one integer')
    elif kind=='integer-rows':
        for _ in iter_rows(output,collect=False):pass
    elif kind in ('integer-array','nullable-integer-array'):
        values=tokens(output);header=next(values,None)
        if header is None or not COUNT.fullmatch(header) or int(header)>MAX_SET_ITEMS:raise ValueError('Invalid array count')
        for _ in range(int(header)):
            value=next(values,None)
            if value is None or (not INTEGER.fullmatch(value) and not(kind=='nullable-integer-array' and value=='null')):raise ValueError('Invalid array item')
        if next(values,None) is not None:raise ValueError('Unexpected array items')
    elif kind=='string':
        normalized=output.replace('\r\n','\n')
        if not normalized.endswith('\n') or '\n' in normalized[:-1] or '\r' in normalized:
            raise ValueError('Expected one string line followed by a terminating newline')
    else:
        raise ValueError('Unknown result kind')


def same_result(kind,actual,expected):
    validate_result(kind,actual)
    validate_result(kind,expected)
    if kind=='integer-row-multiset':return Counter(map(tuple,actual))==Counter(map(tuple,expected))
    if kind in ('integer-row-set','integer-bag-row-set'):
        key=lambda row:tuple(sorted(row) if kind=='integer-bag-row-set' else row)
        return set(map(key,actual))==set(map(key,expected))
    if kind=='integer-multiset':return Counter(actual)==Counter(expected)
    return set(actual)==set(expected) if kind.endswith('-set') else actual==expected

def iter_rows(output,collect=True):
    if not valid_text(output):raise ValueError('Invalid output text')
    values=tokens(output);header=next(values,None)
    if header is None or not COUNT.fullmatch(header) or int(header)>MAX_ROWS:raise ValueError('Invalid row count')
    total=0
    for _ in range(int(header)):
        size=next(values,None)
        if size is None or not ROW_LENGTH.fullmatch(size):raise ValueError('Invalid row length')
        length=int(size);total+=length
        if total>MAX_ROW_VALUES:raise ValueError('Too many row values')
        row=[]
        for _ in range(length):
            token=next(values,None)
            if token is None or not INTEGER.fullmatch(token):raise ValueError('Invalid row value')
            if collect:row.append(decimal(token))
        yield row
    if next(values,None) is not None:raise ValueError('Extra row tokens')


def parse_row_collection(output,checker):
    if checker not in ('int-row-set','int-bag-row-set','int-row-multiset'):return None
    rows=Counter()
    try:
        for values in iter_rows(output):
            row=tuple(sorted(values) if checker=='int-bag-row-set' else values)
            if row in rows and checker!='int-row-multiset':return None
            rows[row]+=1
    except (ValueError,TypeError):return None
    return rows


def parse_row_set(output):
    rows=parse_row_collection(output,'int-row-set')
    return None if rows is None else set(rows)


def compare_batch(stdout,expected,kind='integer',encoding='legacy-integer',semantic_id=None,args=None):
    """JSONL preserves one result per invocation; never flatten nested results."""
    if not isinstance(stdout,str) or not isinstance(expected,list):
        return False
    try:
        for value in expected:
            validate_result(kind,value)
        if semantic_id is not None:
            from semantic_checkers import SEMANTIC_KINDS
            if type(semantic_id)is not int or SEMANTIC_KINDS.get(semantic_id)!=kind or encoding!='jsonl-v1' or not isinstance(args,list) or len(args)!=len(expected):return False
        if encoding=='legacy-integer':
            if kind!='integer':
                return False
            # Compatibility with the original batch wrapper's integer print lines.
            return all(a==b for a,b in zip_longest(tokens(stdout),(str(v) for v in expected),fillvalue=None))
        if encoding!='jsonl-v1':
            return False
        lines=stdout.replace('\r\n','\n').split('\n')
        if lines and lines[-1]=='':
            lines.pop()
        if len(lines)!=len(expected) or any(not line.strip() for line in lines):
            return False
        for index,(line,value) in enumerate(zip(lines,expected)):
            decoded=json.loads(line,parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Non-finite JSON')))
            if semantic_id is not None:
                validate_result(kind,decoded)
                if not compare_output(f'semantic-lc-{semantic_id}',format_result(kind,decoded),format_result(kind,value),json.dumps(args[index],allow_nan=False)):return False
            elif not same_result(kind,decoded,value):
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
            or type(output) is not int or not 1<=output<=65536):
        raise ValueError('Invalid declared CPU, memory, or output limit')
    return {'timeLimit':time,'memoryLimit':memory,'outputLimit':output}
