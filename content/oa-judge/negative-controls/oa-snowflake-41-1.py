from array import array
def solve(d):
    seed,n,k,b,m,area=map(int,d);s=array('I',[seed]);value=seed
    for _ in range(1,n):value+=1+(k*value+b)%m;s.append(value)
    right=n-1;answer=0
    for left in range(n):
        while right>=0 and s[left]*s[right]>area:right-=1
        if right<0:break
        answer+=right+1
    return str(answer//2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
