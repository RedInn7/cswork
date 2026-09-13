def solve(d):
    n=int(d[0]);stock=bytearray(n+1);next_volume=1;answer=[]
    for v in map(int,d[1:]):
        stock[v]=1;start=next_volume
        while next_volume<=n and stock[next_volume]:next_volume+=1
        answer.append(' '.join(map(str,range(start,next_volume))) if start<next_volume else '-1')
    return '\n'.join(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
