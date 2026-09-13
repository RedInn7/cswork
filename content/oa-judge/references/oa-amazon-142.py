def solve(d):
    rows=[sorted(map(int,d[i:i+3])) for i in range(1,len(d),3)];max_a=max(a[0] for a in rows);max_b=max(a[1] for a in rows)
    return str(sum(b>max_a and c>max_b for a,b,c in rows))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
