def solve(d):
    seen={0};prefix=answer=0
    for token in d[1:]:
        v=int(token)
        if v==0:return '-1'
        if prefix+v in seen:answer+=1;seen=set();prefix=0
        prefix+=v;seen.add(prefix)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
