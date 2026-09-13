def solve(d):
    from collections import Counter
    frequencies=list(Counter(map(int,d[1:])).values())
    for b in range(min(frequencies),0,-1):
        answer=0
        for f in frequencies:
            count=(f+b)//(b+1)
            if count*b>f:break
            answer+=count
        else:return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
