def solve(raw):
    d=list(map(int,raw.split()));n,u=d[:2];last=None;answer=0
    for v in d[2:]:
        if v>u:answer+=1
        elif last is None or last+v<u:last=v
        else:answer+=1;last=min(last,v)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
