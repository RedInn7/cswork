def solve(d):
    nums=list(map(int,d[1:]));points=sorted(zip(nums[::2],nums[1::2]))
    if any(points[i]==points[i-1] for i in range(1,len(points))):return '1'
    def visit(p):
        if len(p)<=3:
            best=min(((x-a)**2+(y-b)**2 for i,(x,y) in enumerate(p) for a,b in p[:i]),default=10**30)
            return best,sorted(p,key=lambda t:t[1])
        mid=len(p)//2;cut=p[mid][0];dl,left=visit(p[:mid]);dr,right=visit(p[mid:]);best=min(dl,dr);out=[];i=j=0
        while i<len(left) and j<len(right):
            if left[i][1]<=right[j][1]:out.append(left[i]);i+=1
            else:out.append(right[j]);j+=1
        out.extend(left[i:]);out.extend(right[j:]);strip=[p for p in out if (p[0]-cut)**2<best]
        for i,(x,y) in enumerate(strip):
            j=i+1
            while j<len(strip) and (strip[j][1]-y)**2<best:
                a,b=strip[j];best=min(best,(x-a)**2+(y-b)**2);j+=1
        return best,out
    return str(visit(points)[0])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
