## 思路

对最大距离二分。固定距离时，来源与接收服务器形成区间二分图；按位置贪心匹配最左剩余请求和最左剩余容量，若过远即判失败。小规模 oracle 穷举每个请求的去向。

## 正确性证明

固定距离 d 时，每个来源只能匹配位置区间 [i−d,i+d] 的容量。最左未匹配来源与最左未匹配容量若相距超限，左侧对象不可能与更靠右/左的后续对象匹配；否则优先匹配不会减少后续可行选择。该区间图贪心判定可行性单调，二分得到最小 d。

## 复杂度

Requests 与 max_req 均长度 n；requests[i]≥0，max_req[i]≥1。max_req 为严格上限，因此每台最终容量是 max_req[i]−1。一次请求可以从原服务器送到任意一个接收服务器。

O(n log n) 时间、O(n) 空间。

## 参考实现

```python
def solve(raw):
 z=list(map(int,raw.split()));n=z[0];req=z[1:1+n];cap=[x-1 for x in z[1+n:1+2*n]]
 if sum(req)>sum(cap):return '-1'
 def ok(d):
  i=j=0;a=req[:];b=cap[:]
  while i<n and j<n:
   while i<n and a[i]==0:i+=1
   while j<n and b[j]==0:j+=1
   if i==n or j==n:break
   if j<i and i-j>d:j+=1;continue
   if i<j and j-i>d:return False
   x=min(a[i],b[j]);a[i]-=x;b[j]-=x
  return all(x==0 for x in a)
 lo,hi=0,n-1
 while lo<hi:
  mid=(lo+hi)//2
  if ok(mid):hi=mid
  else:lo=mid+1
 return str(lo if ok(lo) else -1)
```
