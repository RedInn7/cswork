from bisect import bisect_left,bisect_right
def solve(d):
    q=int(d[0]);coords={};ops=[]
    for i in range(q):
        o,u,c,t=d[1+4*i:5+4*i];t=int(t);key=(u,c);ops.append((o,key,t))
        if o=='EVENT':coords.setdefault(key,[]).append(t)
    coords={k:sorted(set(v)) for k,v in coords.items()};bits={k:[0]*(len(v)+1) for k,v in coords.items()}
    def prefix(bit,i):
        total=0
        while i:total+=bit[i];i-=i&-i
        return total
    out=[]
    for o,key,t in ops:
        a=coords.get(key,[]);bit=bits.get(key,[0])
        if o=='EVENT':
            i=bisect_left(a,t)+1
            while i<len(bit):bit[i]+=1;i+=i&-i
        else:out.append(prefix(bit,len(a))-prefix(bit,bisect_left(a,t-15)))
    return str(len(out))+'\n'+'\n'.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
