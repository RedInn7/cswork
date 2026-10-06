## 思路

按顺序维护已追加日志；每个查询扫描当前日志并逐项检查时间、服务、级别和消息条件。时间范围是闭区间。单次查询 O(L)，总复杂度 O(q²)，符合本题直接定义的简化版本。

## 正确性证明

每个 ADD 都恰好进入日志表一次。对 QUERY，算法检查表中每条记录是否同时满足闭区间、两个可选等值过滤和关键字包含条件；满足者计一次，不满足者不计，因此结果与定义相同。

## 复杂度

时间戳与日志数值按整数解析；单条 message 不含制表符。

O(q·L) 时间、O(L) 空间，L 为已写入日志数。

## 参考实现

```python
def solve(raw):
 lines=raw.splitlines(); q=int(lines[0]); logs=[]; out=[]
 for line in lines[1:1+q]:
  p=line.split(maxsplit=4) if line.startswith('ADD ') else line.split()
  if p[0]=='ADD': logs.append((int(p[1]),p[2],p[3],p[4]))
  else:
   _,a,b,s,l,k=p; a=int(a); b=int(b); out.append(str(sum(a<=t<=b and (s=='*' or s==ss) and (l=='*' or l==ll) and (k=='*' or k in m) for t,ss,ll,m in logs)))
 return '\n'.join(out)
```
