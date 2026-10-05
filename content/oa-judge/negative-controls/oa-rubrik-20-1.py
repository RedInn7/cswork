import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; return str(sum(x>=0 for x in t[1:1+n]))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
