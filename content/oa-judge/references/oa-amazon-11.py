def solve(d):
    a,b,c=d; chosen=-1; alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for i in range(len(a)):
        if c[i]!=a[i] and c[i]!=b[i]: chosen=i
    if chosen<0: return '-1'
    full='['+alphabet+']'; short='['+alphabet.replace(c[chosen],'')+']'
    return full*chosen+short+full*(len(a)-chosen-1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
