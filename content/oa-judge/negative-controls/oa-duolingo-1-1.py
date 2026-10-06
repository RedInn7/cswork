def solve(raw):
 v=list(map(int,raw.split())); return ' '.join(map(str,v[1:1+v[0]]))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
