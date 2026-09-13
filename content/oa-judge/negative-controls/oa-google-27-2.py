def solve(data):
    a=list(map(int,data[1:])); current=answer=1
    for i in range(1,len(a)):
        previous,v=a[i-1],a[i]
        current=current+1 if previous<=v else current; answer=max(answer,current)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
