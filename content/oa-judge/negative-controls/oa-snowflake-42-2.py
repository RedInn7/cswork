def solve(d):
    n,threshold=map(int,d[:2]);counts={}
    for i in range(n):
        sender,recipient,amount=map(int,d[2+3*i:5+3*i]);counts[sender]=counts.get(sender,0)+1
        if recipient!=sender:counts[recipient]=counts.get(recipient,0)+1
    out=sorted((u for u,count in counts.items() if count>=threshold),key=str)
    return str(len(out))+'\n'+' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
