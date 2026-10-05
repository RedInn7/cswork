from collections import Counter
import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]
    count=Counter(a)
    a.sort(key=lambda x:(count[x],x))
    return " ".join(map(str,a))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
