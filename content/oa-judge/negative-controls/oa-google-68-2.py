def solve(data):
    n=int(data[0]);a=list(map(int,data[1:n+1]));s=data[-1];answer=0
    for i,c in enumerate(s):
        if True:answer+=a[i]
        if i and s[i-1:i+1]=='TT':answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
