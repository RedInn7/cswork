def solve(s):
 it=iter(s.split());n=int(next(it));q=int(next(it));a=[next(it) for _ in range(n)];p=[0]
 for x in a:p.append(p[-1]+(x[0] in 'aeiou' and x[-1] in 'aeiou'))
 z=[]
 for _ in range(q):l,r=map(int,next(it).split('-'));z.append(str(p[r]-p[l-1]))
 return '\n'.join(z)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
