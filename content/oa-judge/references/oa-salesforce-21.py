def solve(raw):
    values=list(map(int,raw.split()));a=sorted(abs(x) for x in values[1:]);left=0;answer=0
    for right,value in enumerate(a):
        while value>2*a[left]:left+=1
        answer+=right-left
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
