def solve(d):
    n,k=map(int,d[:2]);values=list(map(int,d[2:]));merged=[]
    for a,b in sorted(zip(values[::2],values[1::2])):
        if merged and a<=merged[-1][1]:merged[-1][1]=max(merged[-1][1],b)
        else:merged.append([a,b])
    left=0;answer=len(merged)
    for right in range(len(merged)):
        while merged[right][0]-merged[left][1]>k:left+=1
        answer=min(answer,len(merged)-(right-left))
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
