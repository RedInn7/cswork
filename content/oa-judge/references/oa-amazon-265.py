def solve(d):
    a=list(map(int,d[1:]));all_bits=a[0]
    for v in a:all_bits&=v
    if all_bits:return '1'
    current=-1;answer=0
    for v in a:
        current&=v
        if current==0:answer+=1;current=-1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
