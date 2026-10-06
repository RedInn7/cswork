def solve(raw):
 s=raw.strip();left={c:s.count(c) for c in set(s)};st=[];inside=set()
 for c in s:
  left[c]-=1
  if c in inside:continue
  while st and st[-1]<c and left[st[-1]]>1:inside.remove(st.pop())
  st.append(c);inside.add(c)
 return ''.join(st)

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
