## 思路

每个类型维护最小堆的已释放编号和下一个新编号。allocate 取堆顶或新编号，deallocate 将编号放回堆。集合扫描独立 oracle 每次从 1 开始寻找空位。

## 正确性证明

每种类型单独维护最小堆的已释放编号和从未使用编号的递增指针；堆顶是所有已释放编号中最小者，若无释放编号则新编号必然最小。释放后入堆即可保证后续分配满足规则。

## 复杂度

请求不超过 2×10^5；编号池按 type 独立，释放操作合法。

O(q log q) 时间、O(q) 空间。

## 参考实现

```python
def solve(raw):
 import heapq
 z=raw.splitlines();q=int(z[0]);free={};used={};nxt={};out=[]
 for line in z[1:1+q]:
  p=line.split();t=p[1]
  if t not in free:free[t]=[];used[t]=set();nxt[t]=1
  if p[0]=='allocate':
   if free[t]:x=heapq.heappop(free[t])
   else:x=nxt[t];nxt[t]+=1
   used[t].add(x);out.append(str(x))
  else:
   x=int(p[2]);used[t].remove(x);heapq.heappush(free[t],x)
 return '\n'.join(out)
```
