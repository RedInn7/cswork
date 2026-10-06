def solve(raw):
 z=raw.splitlines(); q=int(z[0]); p=1; out=[]
 for _ in range(q):
  la,lb=map(int,z[p].split()); a=z[p+1]; b=z[p+2]; p+=3; a='' if a=='-' else a; b='' if b=='-' else b
  if la!=lb:out.append('-1')
  else:
   ca=[0]*26; cb=[0]*26
   for c in a:ca[ord(c)-97]+=1
   for c in b:cb[ord(c)-97]+=1
   out.append(str(sum(abs(x-y) for x,y in zip(ca,cb))//2))
 return '\n'.join(out)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
