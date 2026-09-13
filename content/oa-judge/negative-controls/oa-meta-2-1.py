def solve(data):
    n,k=map(int,data[:2]); answer=0
    for value in map(int,data[2:]):
        if value==1:continue
        while value>1 and value%k==0:value//=k
        if value==1:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
