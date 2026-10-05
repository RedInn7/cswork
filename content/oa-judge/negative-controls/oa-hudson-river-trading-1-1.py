def digits(n):
 if n==0: return "0"
 x=abs(n); out=[]
 while x: out.append(chr(48+x%10)); x//=10
 return ''.join(reversed(out))
def solve(raw): return "\n".join(digits(int(x)) for x in raw.splitlines() if x.strip())

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
