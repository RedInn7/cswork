## 思路

按子序列长度做动态规划。转移是 `min_j(dp[j]+|a[i]-a[j]|)`，将其拆成按值排序的 `dp[j]-a[j]` 前缀最小值与 `dp[j]+a[j]` 后缀最小值，用扫描更新。穷举组合独立校验。

## 正确性证明

长度为 t、以 i 结尾的 dp 值枚举所有前驱 j<i，转移 `dp[t−1][j]+|a[i]−a[j]|` 覆盖全部合法子序列。按值分割 j 的取值后，两个范围最小值分别由线段树维护；取所有长度 k 结尾的最小值即为全局最优。

## 复杂度

补充 n≤800，使 O(kn log n) 解法可行；|arr[i]|≤10^9。

O(kn log n) 时间、O(n) 空间。

## 参考实现

```python
def solve(raw):
 import bisect
 z=list(map(int,raw.split()));n,k=z[:2];a=z[2:2+n];v=sorted(set(a));m=len(v);size=1
 while size<m:size*=2
 INF=10**30;prev=[0]*n
 for length in range(2,k+1):
  lo=[INF]*(2*size);hi=[INF]*(2*size);cur=[INF]*n
  def query(tree,l,r):
   l+=size;r+=size;ans=INF
   while l<r:
    if l&1:ans=min(ans,tree[l]);l+=1
    if r&1:r-=1;ans=min(ans,tree[r])
    l//=2;r//=2
   return ans
  def update(tree,pos,val):
   pos+=size;tree[pos]=min(tree[pos],val);pos//=2
   while pos:tree[pos]=min(tree[2*pos],tree[2*pos+1]);pos//=2
  for i,x in enumerate(a):
   t=bisect.bisect_left(v,x);cur[i]=min(query(lo,0,t+1)+x,query(hi,t,m)-x)
   if prev[i]<INF:update(lo,t,prev[i]-x);update(hi,t,prev[i]+x)
  prev=cur
 return str(min(prev))
```
