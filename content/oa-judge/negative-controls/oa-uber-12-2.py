def solve(d):
    from itertools import islice
    counts=[0]*10
    for value in map(int,islice(d,1,None)):counts[value%9]+=1
    return str(max(range(10),key=lambda x:(counts[x],x)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
