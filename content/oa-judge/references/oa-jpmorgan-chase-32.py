def solve(raw):
    lines=raw.splitlines();s=lines[1] if int(lines[0]) else '';current='0';answer=0
    for c in s:
        if c!=current:answer+=1;current=c
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
