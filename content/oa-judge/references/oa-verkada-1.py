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

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
