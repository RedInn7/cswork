def solve(d):
    answer=0
    for bound in sorted(map(int,d[1:])):
        if bound>answer:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
