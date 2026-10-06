import sys
def solve(raw):
 v=list(map(int,raw.split())); n=v[0]; return str(max(v[1:1+n])+300)
if __name__ == "__main__": print(solve(sys.stdin.read()))
