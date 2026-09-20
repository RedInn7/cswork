def solve(d):
    from collections import deque
    n,k=map(int,d[:2]);a=list(map(int,d[2:]))
    def at_most(limit):
        if limit<0:return 0
        low=deque();high=deque();left=total=0
        for right,v in enumerate(a):
            while low and a[low[-1]]>=v:low.pop()
            while high and a[high[-1]]<=v:high.pop()
            low.append(right);high.append(right)
            while a[high[0]]-a[low[0]]>limit:
                if low[0]==left:low.popleft()
                if high[0]==left:high.popleft()
                left+=1
            total+=right-left+1
        return total
    return str(at_most(k))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
