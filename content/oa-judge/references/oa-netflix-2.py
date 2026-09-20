def solve(d):
    n,g,k=map(int,d[:3]);scores=[float(d[i+3]) for i in range(n)];pos=n+3;out=[]
    for _ in range(g):
        m=int(d[pos]);pos+=1
        values=[scores[int(d[pos+i])] for i in range(m)];pos+=m
        values.sort(reverse=True);out.append(sum(values[:k]))
    return str(g)+'\n'+' '.join(format(v,'.12g') for v in out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
