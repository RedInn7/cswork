def solve(data):
    n=int(data[0]);intervals=sorted((int(data[1+2*i]),int(data[2+2*i])) for i in range(n));ds,de=map(int,data[1+2*n:]);merged=[]
    for a,b in intervals:
        if merged and a<=merged[-1][1]:merged[-1][1]=max(merged[-1][1],b)
        else:merged.append([a,b])
    result=[]
    for a,b in merged:
        if b<=ds or a>=de:result.append((a,b))
        else:
            if a<ds:result.append((a,ds))
            if b>de:result.append((de,b))
    return ' '.join([str(len(result))]+[str(v) for pair in result for v in pair])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
