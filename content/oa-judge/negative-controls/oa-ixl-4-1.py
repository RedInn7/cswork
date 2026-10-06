def solve(raw):
 v=list(map(int,raw.split())); n,m,hn,vn=v[:4]; return str((hn+1)*(vn+1))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
