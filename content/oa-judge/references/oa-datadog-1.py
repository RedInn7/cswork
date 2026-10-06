def solve(raw):
 lines=raw.splitlines(); q=int(lines[0]); logs=[]; out=[]
 for line in lines[1:1+q]:
  p=line.split(maxsplit=4) if line.startswith('ADD ') else line.split()
  if p[0]=='ADD': logs.append((int(p[1]),p[2],p[3],p[4]))
  else:
   _,a,b,s,l,k=p; a=int(a); b=int(b); out.append(str(sum(a<=t<=b and (s=='*' or s==ss) and (l=='*' or l==ll) and (k=='*' or k in m) for t,ss,ll,m in logs)))
 return '\n'.join(out)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
