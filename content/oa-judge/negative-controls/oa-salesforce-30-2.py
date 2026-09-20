def solve(raw):
    from bisect import bisect_left
    a=list(map(int,raw.split()))[1:];tails=[]
    for x in a:
        i=bisect_left(tails,x)
        if i==len(tails):tails.append(x)
        else:tails[i]=x
    return str(max(0,len(a)-len(tails)-2))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
