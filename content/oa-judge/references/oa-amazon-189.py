def solve(d):
    from collections import Counter
    n,k=map(int,d[:2]);keys=[0];value=answer=0;freq=Counter({0:1})
    for r,v in enumerate(map(int,d[2:]),1):
        value=(value+v-1)%k;keys.append(value)
        if r>=k:freq[keys[r-k]]-=1
        answer+=freq[value];freq[value]+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
