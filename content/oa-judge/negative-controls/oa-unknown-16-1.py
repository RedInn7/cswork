import sys
def solve(raw):
 a,b=raw.splitlines()[:2];u=set(a)|set(b);return str(len(set(a)&set(b))/len(u))
if __name__=='__main__':print(solve(sys.stdin.read()))
