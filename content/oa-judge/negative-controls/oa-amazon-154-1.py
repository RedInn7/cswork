def solve(d):
    from math import gcd
    n,budget=map(int,d[:2]);a=list(map(int,d[2:]));table=[a];width=1
    while 2*width<=n:
        previous=table[-1];table.append([gcd(previous[i],previous[i+width]) for i in range(n-2*width+1)]);width*=2
    def feasible(limit):
        length=limit+1
        if length>n:return True
        level=length.bit_length()-1;offset=length-(1<<level);row=table[level];i=used=0
        while i+length<=n:
            if gcd(row[i],row[i+offset])>1:
                used+=1
                if used>budget:return False
                i+=length
            else:i+=1
        return True
    lo,hi=1,n
    while lo<hi:
        middle=(lo+hi)//2
        if feasible(middle):hi=middle
        else:lo=middle+1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
