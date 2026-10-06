import sys
def solve(raw):
 s=raw.strip()
 t=s.lstrip('0')
 return 'True' if t=='1'+'0'*(len(t)-1) and bool(t) else 'False'
if __name__ == '__main__': print(solve(sys.stdin.read()))
