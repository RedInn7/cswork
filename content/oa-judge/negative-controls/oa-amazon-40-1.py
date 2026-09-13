def solve(d):
    a=sorted(map(int,d[1:])); n=len(a); low,extra=divmod(sum(a),n); answer=0
    for i,v in enumerate(a):
        target=low; answer+=max(0,v-target)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
