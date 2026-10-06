import sys
def solve(raw):
 s=raw.rstrip('\n');st=[]
 for c in s:
  if st and (st[-1],c) in {('A','B'),('B','A'),('C','D'),('D','C')}:st.pop()
  else:st.append(c)
 return ''.join(st)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
