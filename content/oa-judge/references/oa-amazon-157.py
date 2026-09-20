def solve(d):
    s,kit=d[:2];ratings=list(map(int,d[2:]));balance=low=0
    for c in s:balance+=1 if c=='(' else -1;low=min(low,balance)
    left=-low;right=left+balance
    opens=sorted((v for c,v in zip(kit,ratings) if c=='('),reverse=True);closes=sorted((v for c,v in zip(kit,ratings) if c==')'),reverse=True)
    answer=sum(opens[:left])+sum(closes[:right])
    for a,b in zip(opens[left:],closes[right:]):
        if a+b<=0:break
        answer+=a+b
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
