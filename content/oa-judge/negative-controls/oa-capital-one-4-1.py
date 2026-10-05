import sys
def solve(raw):
 t=list(map(int,raw.split())); n=t[0]; g={}
 for i in range(1,len(t),2):
  a,b=t[i],t[i+1]; g.setdefault(a,[]).append(b); g.setdefault(b,[]).append(a)
 cur=min(g); prev=None; out=[]
 while True:
  out.append(cur); nxt=next((x for x in g[cur] if x!=prev),None)
  if nxt is None: break
  prev,cur=cur,nxt
 return ' '.join(map(str,out))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
