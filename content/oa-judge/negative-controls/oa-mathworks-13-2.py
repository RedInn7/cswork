import sys
d=sys.stdin.read().split();n,q=map(int,d[:2]);a=d[2:2+n];p=[0]
for x in a:p.append(p[-1]+(x[0] in 'aeiou' and x[-1] in 'aeiou'))
print('\n'.join(str(p[int(r)]-p[max(0,int(l)-2)]) for l,r in (x.split('-') for x in d[2+n:])))