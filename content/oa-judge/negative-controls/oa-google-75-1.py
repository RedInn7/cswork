from bisect import bisect_left
def solve(data):
    tails=[]
    for x in map(int,data[1:]):
        i=bisect_left(tails,x)
        if i==len(tails):tails.append(x)
        else:tails[i]=x
    return str(len(tails))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
