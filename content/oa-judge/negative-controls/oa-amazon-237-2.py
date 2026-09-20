def solve(d):
    a=list(map(int,d[1:]));pos={v:i for i,v in enumerate(a)};b=sorted(a);answer=[b[i] for i in range(1,len(b)) if pos[b[i-1]]>pos[b[i]]]
    return ' '.join(map(str,answer[::-1])) if answer else '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
