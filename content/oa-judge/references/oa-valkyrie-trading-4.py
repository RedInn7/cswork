import sys
def solve(raw):
    n=int(raw.strip())
    return str(int(n>0 and (n&(n-1))==0))

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
