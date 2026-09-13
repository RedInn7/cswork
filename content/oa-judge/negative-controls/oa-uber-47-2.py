def solve(d):
    n=int(d[0]);difference=[0]*(n+2)
    for i in range(1,len(d),2):left,right=map(int,d[i:i+2]);difference[left]+=1;difference[right]-=1
    count=answer=0
    for others in range(n):
        count+=difference[others]
        if count>=others+1:answer=others+1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
