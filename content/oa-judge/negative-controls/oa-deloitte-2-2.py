# 不把叶子节点计为平衡
def solve(raw):
 d=list(map(int,raw.split()));n=d[0];ch=[[] for _ in range(n)]
 for v,p in enumerate(d[1:],1):ch[p-1].append(v)
 order=[];st=[0]
 while st:
  u=st.pop();order.append(u);st.extend(ch[u])
 sz=[1]*n;ans=0
 for u in reversed(order):
  vals=[sz[v] for v in ch[u]]
  for v in ch[u]:sz[u]+=sz[v]
  if vals and len(set(vals))==1:ans+=1
 return str(ans)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
