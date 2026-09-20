def solve(d):
    a,b=d.split('\n')[:2];out=[]
    for i in range(max(len(a),len(b))):
        if i<len(a):out.append(a[i])
        if i<len(b):out.append(b[i])
    return ''.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
