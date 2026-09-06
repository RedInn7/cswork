"""Mirror of the fixed finite-float scalar/vector transport."""
import math,re
NUMBER=re.compile(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?',re.ASCII)
def parse_floats(value,array=False):
 if not isinstance(value,str) or len(value)>1024*1024:return None
 tokens=re.split(r'[\t\n\v\f\r ]+',value.strip(' \t\n\v\f\r'))
 if array:
  first=tokens.pop(0)
  if not re.fullmatch(r'0|[1-9][0-9]{0,4}',first) or int(first)!=len(tokens):return None
 elif len(tokens)!=1:return None
 result=[]
 for token in tokens:
  if NUMBER.fullmatch(token)is None:return None
  number=float(token)
  if not math.isfinite(number):return None
  result.append(number)
 return result
def matches_floats(actual,expected,array=False):
 a,b=parse_floats(actual,array),parse_floats(expected,array)
 return a is not None and b is not None and len(a)==len(b) and all((x==-1 if array and y==-1 else abs(x-y)<=1e-5*max(1,abs(y))) for x,y in zip(a,b))
