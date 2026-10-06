def solve(raw):
 v=list(map(int,raw.split())); n,k=v[:2]; a=v[2:2+n]; seen={}; path=[]; x=1
 while x not in seen:
  seen[x]=len(path); path.append(x); x=a[x-1]
 start=seen[x]; cycle=path[start:]; idx=k if k<len(path) else start+(k-start)%len(cycle)
 return str(path[idx])

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
