def solve(data):
    n,k=map(int,data[:2]);s=data[2];best=n+1
    for first in (0,):
        end=[0]*(n+1);parity=0;count=0;possible=True
        for i,char in enumerate(s):
            parity^=end[i]
            if (int(char)^parity)!=(first^(i%2)):
                if i+k>n:possible=False;break
                parity^=1;end[i+k]^=1;count+=1
        if possible:best=min(best,count)
    return str(best if best<=n else -1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
