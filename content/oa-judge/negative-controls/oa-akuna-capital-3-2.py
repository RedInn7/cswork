import sys
def solve(raw):
 t=list(map(int,raw.split())); n=t[0]; p=sorted(t[1:1+n]); return str(p[-1])
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
