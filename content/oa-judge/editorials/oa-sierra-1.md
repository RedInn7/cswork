## 思路

维护当前标题栈及当前块；超限时输出旧块并用标题栈作为新块前缀。每行只扫描一次，除输出复制外 O(text length)。

## 正确性证明

逐行处理保证行序和不可拆分约束；标题栈始终等于当前位置有效的 Markdown 标题路径。当前块超长时切开，新块加上该栈作为上下文前缀，因此内容不丢失且续块上下文正确。

## 复杂度

标题以行首首个非空白字符 # 开始；标题级别是连续 # 数量；空白和展示分隔符都计入 chunk 长度。

O(T) 时间与输出空间，T 为 Markdown 总字符数（标题上下文重放也计入输出）。

## 参考实现

```python
def solve(raw):
 z=raw.splitlines();limit=int(z[0]);doc=z[1:];heads=[];chunks=[];cur=[]
 for line in doc:
  q=line.lstrip();ishead=q.startswith('#')
  if ishead:
   level=len(q)-len(q.lstrip('#'));heads=heads[:level-1]+[line]
  trial=cur+[line]
  if cur and len(' | '.join(trial))>limit:
   chunks.append(' | '.join(cur));cur=[];cur=heads[:] if ishead else heads+[line] if heads else [line]
  else:cur=trial
 if cur:chunks.append(' | '.join(cur))
 return '\n'.join(chunks)
```
