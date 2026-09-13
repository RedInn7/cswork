from collections import Counter
def solve(d):
    na,nb,q=map(int,d[:3]);a=list(map(int,d[3:3+na]));b=list(map(int,d[3+na:3+na+nb]));counts=Counter(b);cursor=3+na+nb;result=[]
    for _ in range(q):
        kind=int(d[cursor]);cursor+=1
        if kind==0:
            index,x=map(int,d[cursor:cursor+2]);cursor+=2;counts[b[index]]-=1;b[index]+=x;counts[b[index]]+=1
        else:
            target=int(d[cursor]);cursor+=1;result.append(str(sum(counts.get(target-v,0) for v in a)))
    return '\n'.join(result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
