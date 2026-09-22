def solve(raw):
    from collections import Counter
    d=list(map(int,raw.split()));n,k=d[:2];frequency=Counter(d[2:])
    return 'Yes' if n%k==0 and max(frequency.values())<=n//k else 'No'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
