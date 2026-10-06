import sys
def solve(raw):
 s=raw.strip()
 return 'True' if s and s[0]=='1' and s.count('1')==1 else 'False'
if __name__=='__main__': print(solve(sys.stdin.read()))
