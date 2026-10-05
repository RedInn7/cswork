def digits(n):
 if n==0: return "0"
 neg=n<0; x=-n if neg else n; out=[]
 while x:
  out.append(chr(ord('0')+x%10)); x//=10
 if neg: out.append('-')
 return ''.join(reversed(out))
def solve(raw):
 return "\n".join(digits(int(line)) for line in raw.splitlines() if line.strip())

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
