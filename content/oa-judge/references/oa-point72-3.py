def solve(raw):
 s=raw.strip(); out=list(s); i=0
 while i<len(s) and s[i]=='a': i+=1
 if i==len(s): out[-1]='z'
 else:
  while i<len(s) and s[i]!='a': out[i]=chr(ord(s[i])-1); i+=1
 return ''.join(out)
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
