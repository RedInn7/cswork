def solve(raw):
 z=list(map(int,raw.split()));n=z[0];return str(sum(min(x%3,3-x%3) for x in z[1:1+n]))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
