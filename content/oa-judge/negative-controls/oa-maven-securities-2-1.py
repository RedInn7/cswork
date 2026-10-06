def solve(raw):
 a=list(map(int,raw.split())); return '\n'.join(str(int(int(x)**0.5)-1) for x in a[1:])
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
