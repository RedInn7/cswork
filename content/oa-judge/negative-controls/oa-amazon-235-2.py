def solve(d):
    n,low,high=map(int,d[:3]);a=sorted(set(map(int,d[3:])))
    def count(k):
        left=0;right=len(a)-1;answer=0
        while left<right:
            if a[left]+a[right]<=k:answer+=right-left;left+=1
            else:right-=1
        return answer
    return str(count(high)-count(low-1))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
