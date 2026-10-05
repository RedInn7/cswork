import sys
def solve(raw):
 t=list(map(int,raw.split())); return str(sum(len(str(abs(x)))%2==1 for x in t[1:]))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
