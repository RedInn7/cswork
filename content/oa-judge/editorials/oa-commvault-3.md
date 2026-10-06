## 思路

并查集构造连通分量大小；从全部无序点对中减去每个连通分量内部组合数。独立 oracle 建图并做 DFS 后直接枚举点对。

## 正确性证明

并查集按边合并后，每个根准确代表一个连通分量。全部无序点对数减去每个分量内部的组合数，剩余且仅剩端点在不同分量的点对。

## 复杂度

节点编号 1..N；边视为无向；结果最大可达 N(N−1)/2，需 64 位整数。

O((N+M) α(N)) 时间、O(N) 空间。

## 参考实现

```python
def solve(raw):
 z=list(map(int,raw.split()));n,m=z[:2];p=list(range(n));sz=[1]*n
 def find(x):
  while p[x]!=x:p[x]=p[p[x]];x=p[x]
  return x
 for i in range(m):
  a,b=z[2+2*i]-1,z[3+2*i]-1;a=find(a);b=find(b)
  if a!=b:
   if sz[a]<sz[b]:a,b=b,a
   p[b]=a;sz[a]+=sz[b]
 ans=n*(n-1)//2
 for i in range(n):
  if p[i]==i:ans-=sz[i]*(sz[i]-1)//2
 return str(ans)
```
