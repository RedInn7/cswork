## 思路

枚举原价及所有有效标签计算出的价格，逐件取最小值。百分比为 `floor(price×(100−percent)/100)`；固定减价范围受限于商品原价，因此无负价格歧义。

## 正确性证明

不同商品之间没有共享折扣预算或联动条件，因此总价最小化可分解为逐件独立最小化。枚举原价及每个有效标签价并向下取整百分比价后取最小，所得总和即全局最小。

## 复杂度

Product descriptors are one line each; tags are whitespace-free identifiers; all values are integers.

O(P + T + d) 时间、O(P + d) 空间，P 为商品数、T 为商品 tag 总数。

## 参考实现

```python
def solve(raw):
 z=raw.splitlines();n,d=map(int,z[0].split());p=[]
 for line in z[1:1+n]:
  a=line.split();p.append((int(a[0]),a[2:2+int(a[1])]))
 disc={}
 for line in z[1+n:1+n+d]:
  k,t,v=line.split();disc[k]=(int(t),int(v))
 total=0
 for price,tags in p:
  best=price
  for tag in tags:
   if tag not in disc:continue
   t,v=disc[tag];x=v if t==0 else price*(100-v)//100 if t==1 else price-v;best=min(best,x)
  total+=best
 return str(total)
```
