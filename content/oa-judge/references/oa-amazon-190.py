def solve(d):
    n,u,v=map(int,d[:3]);a=list(map(int,d[3:]));freq={};left=0;answer=n+1
    for value in a:
        freq[value]=freq.get(value,0)+1
        while u in freq and v in freq:
            answer=min(answer,len(freq));old=a[left];left+=1;freq[old]-=1
            if not freq[old]:del freq[old]
    return str(answer if answer<=n else 0)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
