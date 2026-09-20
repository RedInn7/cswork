def solve(d):
    from collections import Counter
    lines=d.split('\n');n=int(lines[0]);out=[]
    for i in range(n):
        a,b=lines[1+2*i:3+2*i]
        if len(a)!=len(b):out.append(-1)
        else:out.append(sum((Counter(a)-Counter(b)).values()))
    return '\n'.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
