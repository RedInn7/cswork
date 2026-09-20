def solve(raw):
    a=list(map(int,raw.split()[1:]));base=sum(a)//len(a)
    deficit=sum(max(0,base-v) for v in a);excess=sum(max(0,v-base-1) for v in a)
    return str(max(deficit,excess))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
