## 思路

从左到右处理尚未覆盖的女孩。优先放到其右侧空位，可同时覆盖后续相邻女孩；若不可用则尝试左侧。穷举所有放置子集作独立 oracle。

## 正确性证明

考虑从左到右第一个尚未被男孩覆盖的女孩。任何可行解必须在她左或右的空位放男孩；若右位可放，将某个最优解中的左位男孩移到右位不会增加人数且还能覆盖后续女孩。若右位不可用，只能选左位。逐次交换后贪心选择与某个最优解一致。

## 复杂度

每个男孩只放在原本为空的座位；人数不超过 |s|。

O(n) 时间、O(n) 空间。

## 参考实现

```python
def solve(raw):
 s=raw.strip();placed=set();i=0
 while i<len(s):
  if s[i]!='G' or i-1 in placed:i+=1;continue
  if i+1<len(s) and s[i+1]=='-':placed.add(i+1);i+=2
  elif i>0 and s[i-1]=='-':placed.add(i-1);i+=1
  else:return '-1'
 return str(len(placed))
```
