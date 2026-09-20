def solve(d):
    work,day=map(int,d[:2]);s=d[2];out=[];low=[0]*8;high=[0]*8
    for i in range(6,-1,-1):low[i]=low[i+1]+(0 if s[i]=='?' else int(s[i]));high[i]=high[i+1]+(day if s[i]=='?' else int(s[i]))
    def visit(i,remaining,prefix):
        if remaining<low[i] or remaining>high[i]:return
        if i==7:out.append(prefix);return
        choices=range(day+1) if s[i]=='?' else [int(s[i])]
        for value in choices:visit(i+1,remaining-value,prefix+str(value))
    visit(0,work,'');return str(len(out))+'\n'+'\n'.join(reversed(out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
