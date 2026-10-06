import sys
def solve(raw):
    t=list(map(int,raw.split()));n=t[0];p=[x-1 for x in t[1:n+1]];seen=[False]*n;mod=10**9+7
    spf=list(range(n+1))
    for i in range(2,int(n**0.5)+1):
        if spf[i]==i:
            for j in range(i*i,n+1,i):
                if spf[j]==j:spf[j]=i
    max_power={}
    for i in range(n):
        if not seen[i]:
            u=i;length=0
            while not seen[u]:seen[u]=True;length+=1;u=p[u]
            x=length
            while x>1:
                prime=spf[x];power=0
                while x%prime==0:x//=prime;power+=1
                max_power[prime]=max(max_power.get(prime,0),power)
    ans=1
    for prime,power in max_power.items():ans=ans*pow(prime,power,mod)%mod
    return str(ans)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
