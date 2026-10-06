import sys
def solve(raw):
 l=raw.splitlines();a=l[1:1+int(l[0])];a.sort(key=lambda s:(int(s.split(':')[0]),int(s.split(':')[1])));return '\n'.join(a)
if __name__=='__main__':print(solve(sys.stdin.read()))
