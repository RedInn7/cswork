def solve(raw):
    values=list(map(int,raw.split()));n=values[0];a=values[1:n+1];target=values[n+1:n+4];shift=values[-1];totals=[0]*3;counts=[0]*3;answer=10**30
    def search(i):
        nonlocal answer
        if sum(k==0 for k in counts)>n-i:return
        if i==n:
            if all(counts):answer=min(answer,sum((counts[g]-1)*shift+abs(totals[g]-target[g]) for g in range(3)))
            return
        pass
        for g in range(3):
            totals[g]+=a[i];counts[g]+=1;search(i+1);counts[g]-=1;totals[g]-=a[i]
    search(0);return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
