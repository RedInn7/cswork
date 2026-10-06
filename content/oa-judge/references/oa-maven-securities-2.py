def solve(raw):
 import math,bisect
 vals=list(map(int,raw.split())); q=vals[0]; xs=vals[1:1+q]; lim=math.isqrt(max(xs)); mark=bytearray(b'\x01')*(lim+1)
 if lim>=0: mark[0]=0
 if lim>=1: mark[1]=0
 for p in range(2,int(lim**0.5)+1):
  if mark[p]: mark[p*p:lim+1:p]=b'\x00'*(((lim-p*p)//p)+1)
 primes=[i for i in range(2,lim+1) if mark[i]]
 return '\n'.join(str(bisect.bisect_right(primes,math.isqrt(x))) for x in xs)
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
