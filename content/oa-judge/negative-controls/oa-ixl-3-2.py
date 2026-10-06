def solve(raw):
 z=raw.splitlines(); q=int(z[0]); p=1; out=[]
 for _ in range(q):
  la,lb=map(int,z[p].split()); a=z[p+1]; b=z[p+2]; p+=3; a='' if a=='-' else a; b='' if b=='-' else b
  out.append('-1' if la!=lb else str(sum(abs(a.count(chr(97+i))-b.count(chr(97+i))) for i in range(26))))
 return '\n'.join(out)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
