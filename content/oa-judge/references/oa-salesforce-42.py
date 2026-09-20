def solve(raw):
    import json
    tools,start,target=json.loads(raw);n=len(tools);answer=n
    for i,name in enumerate(tools):
        if name==target:
            distance=abs(i-start);answer=min(answer,distance,n-distance)
    return str(-1 if answer==n else answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
