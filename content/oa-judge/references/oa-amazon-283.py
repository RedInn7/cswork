def solve(d):
    from collections import Counter
    pwd=Counter(d[0]);target=Counter(d[1]);cost=list(map(int,d[2:]));return str(min(max(0,pwd[c]-amount+1)*cost[ord(c)-97] for c,amount in target.items()))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
