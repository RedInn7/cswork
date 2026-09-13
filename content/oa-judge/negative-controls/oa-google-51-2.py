def solve(data):
    a=list(map(int,data[1:]));bits=1;low=0
    for value in a:
        if value>=0:bits|=bits<<value
        else:bits=(bits<<(-value))|bits;low+=value
    total=sum(a);limit=total//2-low;reachable=bits&((1<<(limit+1))-1)
    chosen=reachable.bit_length()-1+low
    return str(abs(total))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
