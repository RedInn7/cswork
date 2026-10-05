import sys
def solve(raw):
 a,b=map(int,raw.split()); trace=[]
 try:
  _=a//b
 except ZeroDivisionError:
  trace.append('Exception')
 finally:
  trace.insert(0,'Finally')
 return ' '.join(trace)
if __name__=='__main__': print(solve(sys.stdin.read()))
