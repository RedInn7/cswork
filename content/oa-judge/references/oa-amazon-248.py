def solve(d):
    s=d[0];total=0
    for c in s:total^=1<<(ord(c)-97)
    left=0
    for c in s[:-1]:
        left^=1<<(ord(c)-97)
        if left.bit_count()<=2 and (total^left).bit_count()<=2:return 'YES'
    return 'NO'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
