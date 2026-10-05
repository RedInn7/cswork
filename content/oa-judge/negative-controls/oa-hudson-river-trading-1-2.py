def digits(n):
 if n==0: return ""
 neg=n<0; x=-n if neg else n; out=[]
 while x: out.append(chr(48+x%10)); x//=10
 if neg: out.append('-')
 return ''.join(reversed(out))
def solve(raw): return "\n".join(digits(int(x)) for x in raw.splitlines() if x.strip())

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
