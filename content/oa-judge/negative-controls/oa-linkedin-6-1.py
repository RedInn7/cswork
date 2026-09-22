def solve(raw):
    a=raw.split()[1:];best={};answer=0
    for word in sorted(a,key=len):
        value=1+max(best.get(word[:i]+word[i+1:],0) for i in range(len(word)-1,len(word)));best[word]=value;answer=max(answer,value)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
