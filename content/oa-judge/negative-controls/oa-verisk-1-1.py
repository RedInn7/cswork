def solve(raw):
 z=raw.splitlines(); n=int(z[0]); out=[]
 for s in z[1:1+n]:
  out.append(str(sum(s[i]==s[i-1] for i in range(1,len(s)))))
 return '\n'.join(out)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
