def solve(raw):
    v=raw.split(); q=int(v[0]); return "\n".join("True" if s.count('0')>=2 and s.count('0')%2==0 else "False" for s in v[1:1+q])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
