"""Independent fixed JSON-line contracts for nine string-structure questions."""
import json
STRING_STRUCTURE_IDS=(49,249,68,257,721,131,51,130,37)
MAX_OUTPUT_BYTES=64*1024*1024

def valid_string_structure(pid,value):
 def valid_string(v):
  if type(v)is not str or '\0' in v:return False
  try:v.encode('utf-8');return True
  except UnicodeError:return False
 if pid not in STRING_STRUCTURE_IDS or type(value)is not list or len(value)>1000000:return False
 if pid in (68,257):return all(valid_string(v) for v in value)
 return all(type(row)is list and all(valid_string(v) for v in row) for row in value) and sum(map(len,value))<=16000000

def parse_string_structure(pid,output):
 if type(output)is not str:return None
 try:
  if len(output.encode('utf-8'))>MAX_OUTPUT_BYTES:return None
  text=output.replace('\r\n','\n')
  if not text.endswith('\n') or '\n' in text[:-1] or '\r' in text[:-1]:return None
  value=json.loads(text[:-1])
  return value if valid_string_structure(pid,value) else None
 except (ValueError,UnicodeError,RecursionError):return None

def format_string_structure(pid,value):
 if not valid_string_structure(pid,value):raise ValueError('Invalid string structure')
 out=json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n'
 if len(out.encode('utf-8'))>MAX_OUTPUT_BYTES:raise ValueError('Output exceeds 64 MiB')
 return out

def matches_string_structure(pid,actual,expected):
 a=parse_string_structure(pid,actual);b=parse_string_structure(pid,expected)
 if a is None or b is None:return False
 def canonical(value):
  if pid in (68,130,37):return value
  if pid==257:return sorted(value)
  return sorted(tuple(sorted(row) if pid in (49,249) else row) for row in value)
 return canonical(a)==canonical(b)

STRING_STRUCTURE_KINDS={pid:('json-string-array' if pid in (68,257) else 'json-string-rows') for pid in STRING_STRUCTURE_IDS}
def string_structure_checker_id(checker):
 return next((pid for pid in STRING_STRUCTURE_IDS if checker==f'strings-lc-{pid}'),None)
