def solve(d):
    from functools import lru_cache
    lo,hi,k=map(int,d)
    @lru_cache(None)
    def visit(bit,al,ah,bl,bh,less,tight):
        if bit<0:return 0 if less else -1
        l=(lo>>bit)&1;h=(hi>>bit)&1;limit=(k>>bit)&1;best=-1
        for a in (0,1):
            if al and a<l or ah and a>h:continue
            for b in (0,1):
                if bl and b<l or bh and b>h or not less and a>b:continue
                z=a^b
                if tight and z>=limit:continue
                rest=visit(bit-1,al and a==l,ah and a==h,bl and b==l,bh and b==h,less or a<b,tight and z==limit)
                if rest>=0:best=max(best,(z<<bit)+rest)
        return best
    return str(visit(max(hi,k).bit_length()-1,True,True,True,True,False,True))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
