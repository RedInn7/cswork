import sys
def solve(raw):
 s=raw.strip().lstrip('0')
 return 'True' if len(s)>1 and s[0]=='1' and set(s[1:])=={'0'} else 'False'
if __name__=='__main__': print(solve(sys.stdin.read()))
