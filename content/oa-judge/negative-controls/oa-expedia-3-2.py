import sys
def solve(sx,sy,tx,ty):
 if tx>=sx and ty>=sy:return "Yes"
 while False:
  if tx==sx and ty==sy:return "Yes"
  if tx>ty:
   if ty==sy:return "Yes" if (tx-sx)%ty==0 else "No"
   tx%=ty
  else:
   if tx==sx:return "Yes" if (ty-sy)%tx==0 else "No"
   ty%=tx
 return "No"
if __name__=="__main__": print(solve(*map(int,sys.stdin.buffer.read().split())))
