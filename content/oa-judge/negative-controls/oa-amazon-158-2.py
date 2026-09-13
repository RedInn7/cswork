def solve(d):
    a=sorted(map(int,d[1:]));lo=0;hi=len(a)-1;at=answer=0;highest=True
    while lo<=hi:
        if highest:v=a[hi];hi-=1
        else:v=a[lo];lo+=1
        answer+=(v-at)**2;at=v;highest=True
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
