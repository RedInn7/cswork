import sys
def solve(raw):
 t=list(map(int,raw.split())); n=t[0]; p=t[1:1+n]; a=t[1+n:1+2*n]; day=0
 for planned,alt in zip(p,a): day=alt if alt>=day else planned
 return str(day)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
