def solve(d):
    prev2=prev=0;last=0
    for token in d[1:]:
        value=int(token);current=max(prev+value,prev2+last*(10)+value);prev2,prev=prev,current;last=value
    return str(prev)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
