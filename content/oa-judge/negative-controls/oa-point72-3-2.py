def solve(raw):
 s=raw.strip(); return ('z'+s[1:]) if s[0]=='a' else chr(ord(s[0])-1)+s[1:]
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
