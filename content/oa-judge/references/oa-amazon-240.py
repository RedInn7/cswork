def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));freq={};left=answer=0
    for right,v in enumerate(a):
        freq[v]=freq.get(v,0)+1
        while len(freq)>k:
            old=a[left];freq[old]-=1;left+=1
            if not freq[old]:del freq[old]
        answer+=right-left+1
    return str(answer%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
