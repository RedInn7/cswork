## 思路

按 specialty 建 provider 坐标索引。每名会员逐项检查所需 specialty 是否存在平方距离不超过 d² 的 provider。时间 O(P+M·R·P_s)，其中 P_s 是相关 specialty provider 数。

## 正确性证明

会员达标当且仅当其每个必需 specialty 至少有一个 provider 距离不超过上限。算法逐个 specialty 检查该存在性；只要有一个缺失就加入结果，最后排序仅影响展示顺序。

## 复杂度

坐标为整数，可用平方距离比较以避免浮点误差；距离边界包含等于 maxDistance。

O(P + M·R·P) 时间、O(P) 空间，R 为会员所需 specialty 数。

## 参考实现

```python
def solve(raw):
 z=raw.splitlines();P,M,d=map(int,z[0].split());by={}
 for line in z[1:1+P]:
  i,s,x,y=line.split();by.setdefault(s,[]).append((int(x),int(y)))
 ans=[]
 for line in z[1+P:1+P+M]:
  mid,x,y,req=line.split();x=int(x);y=int(y);bad=False
  for s in req.split('|'):
   if not any((a-x)**2+(b-y)**2<=d*d for a,b in by.get(s,[])):bad=True;break
  if bad:ans.append(int(mid))
 return '\n'.join(map(str,sorted(ans)))
```
