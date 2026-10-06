import sys
def solve(raw):
 lines=raw.splitlines();n=int(lines[0]);a=lines[1:1+n]
 a.sort(key=lambda s:(int(s.split(':')[1]),int(s.split(':')[0])))
 return '\n'.join(a)
if __name__=='__main__': print(solve(sys.stdin.read()))
