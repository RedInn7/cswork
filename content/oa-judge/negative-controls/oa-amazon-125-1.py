def solve(d):
    runs=[]
    for c in d[0]:
        if runs and runs[-1][0]==c:runs[-1][1]+=1
        else:runs.append([c,1])
    answer=sum((n-1)*(n-2)//2 for c,n in runs)
    answer+=sum(runs[i-1][0]==runs[i+1][0] for i in range(1,len(runs)-1))
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
