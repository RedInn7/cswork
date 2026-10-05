import sys
def solve(raw):
    word,k=raw.split(); k=int(k); stack=[]
    for c in word:
        if stack and stack[-1][0]==c:
            stack[-1][1]+=1
            if stack[-1][1]==k: stack.pop()
        else:
            stack.append([c,1])
    return "".join(c*count for c,count in stack)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
