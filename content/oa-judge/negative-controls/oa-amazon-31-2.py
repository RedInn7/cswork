def solve(d):
    n,q=map(int,d[:2]); values=[]; removed=[]; following=[]; head={}; tail={}
    for token in d[2:]:
        v=int(token)
        if v>0:
            index=len(values); previous=tail.get(v,-1)
            if previous>=0: following[previous]=index
            else: head[v]=index
            tail[v]=index; values.append(v); removed.append(False); following.append(-1)
        else:
            value=-v; index=head[value]; head[value]=following[index]; removed[index]=False
            if head[value]<0: tail[value]=-1
    answer=[v for i,v in enumerate(values) if not removed[i]]
    return ' '.join(map(str,[len(answer)]+answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
