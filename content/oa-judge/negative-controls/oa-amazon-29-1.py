def solve(d):
    n,q=map(int,d[:2]); a=list(map(int,d[2:2+n])); prefix=[0]
    for v in a: prefix.append(prefix[-1]+v)
    answer=[]
    for j in range(2+n,len(d),2):
        u,v=map(int,d[j:j+2]); total=0; start=0
        for end in (u,v):
            total+=(end-start)*a[end-1]-(prefix[end]-prefix[start]); start=end
        answer.append(str(total))
    return ' '.join(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
