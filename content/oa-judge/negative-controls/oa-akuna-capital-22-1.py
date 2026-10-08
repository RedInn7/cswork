import sys

def solve(raw):
    s=raw.strip()
    ones=0
    cost=0
    i=0
    while i<len(s):
        if s[i]=='1':
            ones+=1
            i+=1
        else:
            end=i
            while end<len(s) and s[end]=='0': end+=1
            cost+=ones
            i=end
    return str(cost)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
