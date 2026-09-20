def solve(d):
    from collections import Counter
    n,w=map(int,d[:2]);counts=Counter(map(int,d[2:]));mod=1000000007;answer=1
    if n%2:return '0'
    if w==0:
        for c in counts.values():
            if c%2:return '0'
            for k in range(1,c):answer=answer*k%mod
    else:
        for value in sorted(counts):
            need=counts[value]
            if not need:continue
            available=counts.get(value+w,0)
            if available<need:return '0'
            for k in range(available-need+1,available+1):answer=answer*k%mod
            counts[value+w]=available-need
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
