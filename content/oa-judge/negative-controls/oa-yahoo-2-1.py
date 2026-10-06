def solve(raw):
 s=raw.strip();prev=run=0;last=None;ans=0
 for c in s:
  if c==last:run+=1
  else:ans+=max(prev,run);prev,run=run,1;last=c
 return str(ans+min(prev,run))

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
