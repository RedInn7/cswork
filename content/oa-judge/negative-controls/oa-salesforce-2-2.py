def solve(d):
    n=int(d[0]);a=[];b=[];both=[]
    for i in range(n):
        c=int(d[1+2*i]);f=d[2+2*i]
        if f=='01':a.append(c)
        elif f=='10':b.append(c)
        elif f in ('11','00'):both.append(c)
    a.sort();b.sort();units=sorted(both+[x+y for x,y in zip(a,b)]);out=[];total=0
    for i in range(n):
        if i<len(units):total+=units[i];out.append(total)
        else:out.append(-1)
    return str(n)+'\n'+' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
