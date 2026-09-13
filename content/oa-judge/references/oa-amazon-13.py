def solve(data):
    a=list(map(int,data[1:])); prefix=[0]
    for value in a:prefix.append(prefix[-1]+value)
    counts={}; answer=0
    for right in range(2,len(a)):
        left=right-2; key=(a[left],prefix[left]+2*a[left]); counts[key]=counts.get(key,0)+1
        answer+=counts.get((a[right],prefix[right]),0)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
