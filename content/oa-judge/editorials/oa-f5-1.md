## 思路

只扫描时间窗内文本，逐字符识别标签并计数，再按 `(-count, tag)` 排序。总扫描 O(文本总长)，排序 O(H log H)。

## 正确性证明

扫描只在有效时间窗内识别完整 hashtag，并对每个出现位置计数一次；排序键与题目要求的频次降序、字典序升序完全一致，取前三项即为答案。

## 复杂度

文本按 ASCII hashtag 语法扫描；空的 # 不构成标签；时间戳与窗口均为非负整数。

O(T + H log H) 时间、O(H) 空间，T 为扫描文本长度，H 为不同标签数。

## 参考实现

```python
def solve(raw):
 z=raw.splitlines();n,now,w=map(int,z[0].split());c={}
 for line in z[1:1+n]:
  t,tw=line.split('\t',1);t=int(t)
  if now-w<=t<=now:
   i=0
   while i<len(tw):
    if tw[i]=='#':
     j=i+1
     while j<len(tw) and (tw[j].isascii() and (tw[j].isalnum() or tw[j]=='_')):j+=1
     if j>i+1:c[tw[i:j]]=c.get(tw[i:j],0)+1
     i=j
    else:i+=1
 return '\n'.join(sorted(c,key=lambda x:(-c[x],x))[:3])
```
