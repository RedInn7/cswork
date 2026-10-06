import sys
def solve(raw): return str(int(raw.split()[0])%1000000007)
if __name__=='__main__':print(solve(sys.stdin.read()))
