"""Exact rational mirror for equivalent recurring decimals (problem 166)."""
import json,math,re
def matches_fraction(actual,input):
 try:
  if not isinstance(actual,str) or not isinstance(input,str) or len(actual)>10001 or len(input)>100:return False
  if not re.fullmatch(r'[ \t\r\n]*\[[ \t\r\n]*-?(?:0|[1-9][0-9]*)[ \t\r\n]*,[ \t\r\n]*-?(?:0|[1-9][0-9]*)[ \t\r\n]*\][ \t\r\n]*',input):return False
  args=json.loads(input)
  if type(args)is not list or len(args)!=2 or any(type(x)is not int or not -2147483648<=x<=2147483647 for x in args) or not args[1]:return False
  text=actual[:-2] if actual.endswith('\r\n') else actual[:-1] if actual.endswith('\n') else actual
  m=re.fullmatch(r'(-?)(0|[1-9][0-9]*)(?:\.([0-9]*)(?:\(([0-9]+)\))?)?',text)
  if not m or '.' in text and not m[3] and not m[4]:return False
  numerator,denominator=args;reduced=abs(denominator)//math.gcd(numerator,denominator)
  for factor in (2,5):
   while reduced%factor==0:reduced//=factor
  if reduced==1 and m[4]:return False
  # Manual decimal chunks avoid Python's default 4300-digit int text restriction.
  def integer(s):
   result=0
   for i in range(0,len(s),500):
    chunk=s[i:i+500];result=result*10**len(chunk)+int(chunk)
   return result
  scale=10**len(m[3] or '');period=10**len(m[4])-1 if m[4] else 1;q=scale*period
  p=integer(m[2])*q+integer(m[3] or '0')*period+integer(m[4] or '0')
  if m[1]:p=-p
  return p*denominator==numerator*q
 except (ValueError,TypeError,OverflowError):return False
