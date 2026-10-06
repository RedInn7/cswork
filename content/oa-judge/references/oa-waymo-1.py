def dec(s):
 st=[''];i=0
 while i<len(s):
  if s[i]=='(':st.append('');i+=1
  elif s[i]==')':
   t=st.pop();i+=2;j=i
   while s[j].isdigit():j+=1
   k=int(s[i:j]);i=j+1;st[-1]+=t*k
   if len(st[-1])>200000:raise ValueError('output too long')
  else:st[-1]+=s[i];i+=1
 return st[0]
def solve(raw):
 v=raw.splitlines();return '\n'.join(dec(x) for x in v[1:1+int(v[0])])

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
