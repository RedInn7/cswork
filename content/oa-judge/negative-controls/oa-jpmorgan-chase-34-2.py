def solve(raw):
    lines=raw.splitlines();s=lines[1] if int(lines[0]) else '';previous=current=answer=0;last=''
    for c in s:
        if c==last:current+=1
        else:answer+=min(previous,current);previous=current;current=1;last=c
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
