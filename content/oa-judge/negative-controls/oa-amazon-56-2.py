def solve(d):
    s=d[0];n=len(s);prefix=[0]
    for c in s:prefix.append(prefix[-1]+(c=='1'))
    answer=0;k=1
    while k*k+k<=n:
        length=k*k+k
        for end in range(length,n):answer+=prefix[end]-prefix[end-length]==k
        k+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
