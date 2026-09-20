def solve(d):
    n,k=map(int,d[:2]);diff=[0]*1441
    def minute(s):h,m=map(int,s.split(':'));return h*60+m
    for i in range(n):
        a=minute(d[4+4*i]);b=minute(d[5+4*i]);diff[a]+=1;diff[b]-=1
    busy=run=0
    for t in range(1440):
        busy+=diff[t];run=run+1 if busy==0 else 0
        if run>=k:
            start=t-k+1;return f'{start//60:02}:{start%60:02}'
    return '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
