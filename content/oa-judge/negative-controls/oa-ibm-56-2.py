def solve(d):
    a=sorted(map(int,d[1:]));delta=min(a[i+1]-a[i] for i in range(len(a)-1));pairs=[]
    for x,y in zip(a,a[1:]):
        if y-x==delta:pairs.append(f'{x} {y}')
    pairs=pairs[:1];return str(len(pairs))+'\n'+'\n'.join(pairs)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
