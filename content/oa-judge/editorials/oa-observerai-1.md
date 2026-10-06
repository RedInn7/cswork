## 思路

对每类标记用单调指针为每笔订单找第一个不小于订单量的标记，累计浪费并按 `(浪费,编号)` 取最小。独立 oracle 对每笔订单线性枚举全部标记。

## 正确性证明

对一个烧杯，升序标记中首个不小于订单量的标记是该单可选的最小容量，任何更大标记只会增加浪费。逐单累加此最小差值，再在可满足全部订单的烧杯中按浪费和编号排序，得到全局最优。

## 复杂度

每类标记列表为升序整数；烧杯容量与订单都是正整数，0≤f≤1000，总订单和标记数≤2×10^5。

O(n log n + f·n + M) 时间、O(n + M) 空间，M 为所有标记数。

## 参考实现

```python
def solve(raw):
 z=raw.splitlines();p=0;n=int(z[p]);p+=1;req=list(map(int,z[p].split()));p+=1;req.sort();f=int(z[p]);p+=1;best=None
 for i in range(f):
  m=int(z[p]);p+=1;a=list(map(int,z[p].split()))[:m];p+=1;j=0;cost=0;ok=True
  for x in req:
   while j<m and a[j]<x:j+=1
   if j==m:ok=False;break
   cost+=a[j]-x
  if ok and (best is None or (cost,i)<best):best=(cost,i)
 return str(-1 if best is None else best[1])
```
