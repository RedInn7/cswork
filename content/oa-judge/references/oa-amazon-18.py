def solve(data):
    n,threshold=map(int,data[:2]); values=sorted(map(int,data[2:])); left=0; answer=0
    for right in range(n):
        while left<right and values[right]-values[left]>threshold:left+=1
        answer+=right-left
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
