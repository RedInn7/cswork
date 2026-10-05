import sys
def solve(raw):
 a,b=map(int,raw.split()); trace=[]
 try:
  _=a//b
 except ZeroDivisionError:
  pass
 finally:
  trace.append('Finally')
 return ' '.join(trace)
if __name__=='__main__': print(solve(sys.stdin.read()))
