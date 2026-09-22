def solve(raw):
    s=raw.rstrip('\r\n');previous=0;current=0;last='';answer=0
    for c in s:
        if c==last:current+=1
        else:answer+=min(previous,current);previous=current;current=1;last=c
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
