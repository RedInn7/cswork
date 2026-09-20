def solve(raw):
    import re
    values=(int(m.group()) for m in re.finditer(r'-?\d+',raw));n=next(values);m=next(values);columns=[10**30]*m;row_bound=10**30
    for _ in range(n):
        largest=0
        for j in range(m):
            value=next(values);largest=max(largest,value);columns[j]=min(columns[j],value)
        row_bound=min(row_bound,largest)
    candidate=max(columns)
    return str(candidate)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
