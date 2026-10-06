# 漏掉 CD 对
def solve(raw):
 s=raw.rstrip('\n');st=[]
 for c in s:
  if st and (st[-1],c) in {('A','B'),('B','A')}:st.pop()
  else:st.append(c)
 return ''.join(st)
