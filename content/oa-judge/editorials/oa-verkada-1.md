## 思路

路径用 `commonpath` 判断严格后代；逐 token 检查 4 个十进制 octet；保留重复 token 后排序。时间 O(输入长度+结果排序)。

## 正确性证明

路径组件前缀判定恰好选中 root 的严格后代文件。每个 token 按定义检查四段、十进制形式、前导零和数值范围；保留所有有效出现后排序，既不漏项也不引入无效项。

## 复杂度

root 下级按完整 POSIX 路径组件判断，不包含 root 同名字符串前缀；IP 每段只允许十进制数字，前导零仅允许单独的 0。

O(T + A log A) 时间、O(A) 空间，T 为输入文本长度、A 为地址出现数。

## 参考实现

```python
def solve(raw):
 import os,re
 z=raw.splitlines();root=os.path.normpath(z[0]);n=int(z[1]);out=[]
 for line in z[2:2+n]:
  path,content=line.split('\t',1);p=os.path.normpath(path)
  try:inside=os.path.commonpath([root,p])==root and p!=root
  except ValueError:inside=False
  if not inside:continue
  for t in content.split():
   a=t.split('.')
   if len(a)==4 and all(x.isascii() and x.isdigit() and (x=='0' or not x.startswith('0')) and int(x)<=255 for x in a):out.append(t)
 return '\n'.join(sorted(out))
```
