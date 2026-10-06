def solve(raw):
 s=raw.strip(); out=[]; i=0
 while i<len(s):
  j=i+1
  while j<len(s) and s[j]==s[i]:j+=1
  out.append(s[i]+(str(j-i) if j-i>1 else '')); i=j
 return ''.join(out)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
