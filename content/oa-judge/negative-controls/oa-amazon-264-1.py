def solve(d):
    s,kit=d[:2];ratings=list(map(int,d[2:]));balance=0;minimum=0
    for c in s:balance+=1 if c=='(' else -1;minimum=min(minimum,balance)
    left=-minimum;right=left+balance;opens=sorted((v for c,v in zip(kit,ratings) if c=='('),reverse=True);closes=sorted((v for c,v in zip(kit,ratings) if c==')'),reverse=True);answer=sum(max(0,v) for v in opens[:left]+closes[:right])
    for a,b in zip(opens[left:],closes[right:]):answer+=max(0,a+b)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
