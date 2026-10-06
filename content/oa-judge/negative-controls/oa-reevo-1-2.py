def solve(raw):
 from collections import Counter
 s=raw.strip(); c=Counter(s); return ''.join(x+(str(c[x]) if c[x]>1 else '') for x in dict.fromkeys(s))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
