def solve(raw):
 z=list(map(int,raw.split()));n=z[0];a=z[1:1+n];return str(sum(b*(2*(n-i)+1) for i,b in enumerate(a)))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
