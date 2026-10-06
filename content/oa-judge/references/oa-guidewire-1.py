def solve(raw):
 s=raw.strip();placed=set();i=0
 while i<len(s):
  if s[i]!='G' or i-1 in placed:i+=1;continue
  if i+1<len(s) and s[i+1]=='-':placed.add(i+1);i+=2
  elif i>0 and s[i-1]=='-':placed.add(i-1);i+=1
  else:return '-1'
 return str(len(placed))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
