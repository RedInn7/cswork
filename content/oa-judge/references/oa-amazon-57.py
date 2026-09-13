def solve(d):
    from bisect import bisect_right
    tails=[]
    for value in map(int,d[1:]):
        i=bisect_right(tails,value)
        if i==len(tails):tails.append(value)
        else:tails[i]=value
    return str(len(tails))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
