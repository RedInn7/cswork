from collections import Counter
def solve(d):
    n=int(d[0]);counts=Counter(str(int(v)) for v in d[1:n+1]);target=str(int(d[-1]));answer=0
    for i in range(1,len(target)):
        a,b=target[:i],target[i:];left=counts[a];right=counts[b]
        answer+=left*(right-(a==b))
    return str(answer//2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
