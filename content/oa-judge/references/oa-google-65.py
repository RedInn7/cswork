import sys
def solve(raw):
    data=raw.split(); n=int(data[0]); points=list(map(int,data[1:1+n])); tokens=data[1+n]
    score=0
    for i,token in enumerate(tokens):
        if token=='T':
            score+=points[i]
            if i>0 and tokens[i-1]=='T': score+=1
    return str(score)
print(solve(sys.stdin.read()))
