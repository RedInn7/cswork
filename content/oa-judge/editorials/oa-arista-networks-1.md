## 思路

逐行逐列累加一个全局 running sum；每个位置恰好包含其前方所有行与当前行左侧元素。时间 O(mn)，额外空间 O(n) 输出。

## 正确性证明

按行优先遍历时，维护的累计和始终等于 A 中当前格及其之前所有格的和；写入 B 的该位置正是题目要求的前缀和。

## 复杂度

所有前缀和使用任意精度整数；输入矩形完整。

O(mn) 时间；除输出矩阵外 O(1) 额外空间。

## 参考实现

```python
def solve(raw):
 z=raw.splitlines();m,n=map(int,z[0].split());s=0;o=[]
 for line in z[1:1+m]:
  a=list(map(int,line.split()));r=[]
  for x in a[:n]:s+=x;r.append(str(s))
  o.append(' '.join(r))
 return '\n'.join(o)
```
