import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; chosen=[]; stamina=0
    for x in t[1:1+n]:
        if stamina+x>=0: chosen.append(x); stamina+=x
    return str(len(chosen))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
