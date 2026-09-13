def solve(data):
    n=int(data[0]); values=list(map(int,data[1:])); seen={}; answer=0
    for i in range(n):
        x,y=values[2*i:2*i+2]
        for dx in (-1,0,1):
            for dy in (-1,0,1):answer+=seen.get((x+dx,y+dy),0)
        seen[x,y]=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
