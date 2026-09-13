def solve(d):
    streak=[0]*int(d[0]);answer=0
    for j in range(2,len(d),2):
        i=int(d[j])-1;streak[i]=streak[i]+1 if d[j+1]=='error' else 0
        if streak[i]==3:answer+=1;streak[i]=0
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
