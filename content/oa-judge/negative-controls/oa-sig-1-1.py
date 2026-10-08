import sys

def solve(raw):
    data=list(map(int,raw.split()))
    n,k=data[:2]
    rates=data[2:2+n]
    strategy=data[2+n:]
    contribution=[rates[i]*strategy[i] for i in range(n)]
    baseline=sum(contribution)
    half=k//2
    old=sum(contribution[:k])
    replacement=sum(rates[half:k])
    best=replacement-old
    for left in range(n-k):
        old+=contribution[left+k]-contribution[left]
        replacement+=rates[left+k]-rates[left+half]
        best=max(best,replacement-old)
    return str(baseline+best)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
