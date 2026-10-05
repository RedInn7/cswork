import sys
def solve(s):
 t=s.strip(); return str(sum(-1 if 'A'<=c<='Z' else 1 if 'a'<=c<='z' else 0 for c in t))
if __name__=='__main__': print(solve(sys.stdin.read()))
