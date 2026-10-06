# 比较每个孩子的直接孩子数，而不是子树节点数
def solve(raw):
 d=list(map(int,raw.split()));n=d[0];ch=[[] for _ in range(n)]
 for v,p in enumerate(d[1:],1):ch[p-1].append(v)
 ans=0;st=[0];order=[]
 while st:
  u=st.pop();order.append(u);st.extend(ch[u])
 for u in range(n):
  vals=[len(ch[v]) for v in ch[u]]
  if not vals or len(set(vals))==1:ans+=1
 return str(ans)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
