def solve(raw):
    s=raw.strip();balance=missing=0
    for c in s:
        if c=='(':balance+=1
        elif balance:balance-=1
        else:missing+=1
    return str(missing+balance)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
