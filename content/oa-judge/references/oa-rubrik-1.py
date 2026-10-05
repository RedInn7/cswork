import sys
def solve(raw):
    s=raw.strip(); previous=0; current=1; answer=0
    for i in range(1,len(s)):
        if s[i]==s[i-1]: current+=1
        else:
            answer+=min(previous,current); previous,current=current,1
    answer+=min(previous,current)
    return str(answer)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
