def solve(raw):
 s=raw.strip(); return str(max(int(s[i:i+2]) for i in range(max(1,len(s)-2))))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
