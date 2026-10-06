def solve(raw):
 v=list(map(int,raw.split())); return str(v[1]*v[2])

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
