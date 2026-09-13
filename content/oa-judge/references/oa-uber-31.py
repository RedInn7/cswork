def solve(d):
    n,q=map(int,d[:2]);houses=set(map(int,d[2:2+n]));segments=sum(v-1 not in houses for v in houses);result=[]
    for i in range(2+n,len(d)):
        v=int(d[i]);left=v-1 in houses;right=v+1 in houses;segments+=left+right-1;houses.remove(v);result.append(str(segments))
    return '\n'.join(result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
