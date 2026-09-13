def solve(d):
    s=d;count=answer=0
    for i,c in enumerate(s):
        count+=c in 'aeiou'
        if i>=3:count-=s[i-3] in 'aeiou'
        if i>=2 and count==2:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().removesuffix("\n")))
