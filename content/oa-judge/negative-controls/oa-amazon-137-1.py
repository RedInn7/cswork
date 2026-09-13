def solve(d):
    n,q=map(int,d[:2]);prefix=[0]
    for v in d[2:2+n]:prefix.append(prefix[-1]+int(v))
    at=answer=0;total=prefix[-1]
    for token in d[2+n:]:
        target=int(token)-1;distance=abs(prefix[target]-prefix[at]);answer+=min(distance,total-distance);at=0
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
