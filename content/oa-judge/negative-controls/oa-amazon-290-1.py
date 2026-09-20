def solve(d):
    a=sorted(map(int,d[1:]),reverse=True);total=sum(a);picked=[];weight=0
    for v in a:
        picked.append(v);weight+=v
        if weight>=total-weight:break
    return ' '.join(map(str,picked[::-1]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
