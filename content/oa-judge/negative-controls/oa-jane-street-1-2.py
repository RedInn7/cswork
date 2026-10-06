# 只按一个方向识别 AB
def solve(raw):
 s=raw.rstrip('\n');st=[]
 for c in s:
  if st and (st[-1],c) in {('A','B'),('C','D')}:st.pop()
  else:st.append(c)
 return ''.join(st)
