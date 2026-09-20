def solve(d):
    s=d[0];first={};last={};first_run={};last_run={};run=0;previous=None
    for i,c in enumerate(s):
        if c!=previous:run+=1;previous=c
        if c not in first:first[c]=i;first_run[c]=run
        last[c]=i;last_run[c]=run
    answer=max([-1]+[last[c]-first[c] for c in first if True])
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
