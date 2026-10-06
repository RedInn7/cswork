## 思路

Usage 用差分数组求覆盖计数是否大于 0；override 直接按闭区间覆盖。逐日模拟作独立 oracle。时间 O(D+U+覆盖的 override 长度)，空间 O(D)。

## 正确性证明

差分前缀和在每一天等于覆盖该日的所有值为 1 的 usage 区间数，是否大于零即为默认状态。override 不相交且优先级最高，因此逐日以 override 值替换默认状态恰好得到最终状态。

## 复杂度

Intervals must be fully inside the timeline; overlap between usage intervals is allowed.

O(D + U + O) 时间、O(D) 空间；override 区间不相交。

## 参考实现

```python
def solve(raw):
 z=list(map(int,raw.split()));p=0;D=z[p];p+=1;U=z[p];p+=1;diff=[0]*(D+2)
 for _ in range(U):
  l,r,v=z[p:p+3];p+=3
  if v:diff[l]+=1;diff[r+1]-=1
 O=z[p];p+=1;over=[None]*(D+1)
 for _ in range(O):
  l,r,v=z[p:p+3];p+=3
  for i in range(l,r+1):over[i]=v
 cur=0;out=[]
 for i in range(1,D+1):
  cur+=diff[i];out.append(str(int(cur>0) if over[i] is None else over[i]))
 return ''.join(out)
```
