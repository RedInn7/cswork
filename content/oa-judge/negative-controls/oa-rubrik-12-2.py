import sys
t=list(map(int,sys.stdin.read().split()));n,z=t[:2];a=t[2:]
def k(b):
 s=m=0
 for x in b:s=max(0,s+x);m=max(m,s)
 return m
print(max(k(a),k([x*z for x in a])))
