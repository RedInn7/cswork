def solve(raw):
 rows=raw.splitlines(); n,m=map(int,rows[0].split()); p=rows[1].split(); s=rows[2].strip(); return '\n'.join(' '.join([x for x in p if x.startswith(s[:i])][:3]) or '-' for i in range(1,len(s)+1))
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
