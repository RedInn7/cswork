def solve(raw):
    a=list(map(int,raw.split()))[1:];total=sum(a);left=0
    for i,v in enumerate(a):
        if left==total-left-v:return str(i)
        left+=v
    return '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
