def solve(raw):
 s=raw.strip(); return ''.join('z' if c=='a' else chr(ord(c)-1) for c in s)
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
