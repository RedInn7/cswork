def solve(data):
    from bisect import bisect_left,bisect_right
    v=list(map(int,data.split())); m,q=v[:2]; p=2; left=[]; right=[]
    for _ in range(m): left.append(v[p]); right.append(v[p+1]); p+=2
    points=v[p:p+q]; left.sort(); right.sort()
    return ' '.join(str(bisect_right(left,x)-bisect_left(right,x)) for x in points)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
