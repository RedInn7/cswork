def solve(raw):
 from bisect import bisect_left
 rows=raw.splitlines(); n,m=map(int,rows[0].split()); p=sorted(rows[1].split()); s=rows[2].strip(); out=[]
 for i in range(1,len(s)+1):
  prefix=s[:i]; j=bisect_left(p,prefix); ans=[]
  while j<len(p) and p[j].startswith(prefix) and len(ans)<3:
   ans.append(p[j]); j+=1
  out.append(' '.join(ans) if ans else '-')
 return '\n'.join(out)
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
