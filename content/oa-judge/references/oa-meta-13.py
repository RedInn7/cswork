def solve(data):
    answer=0
    for ch in data:
        if 'A'<=ch<='Z':answer+=1
        elif 'a'<=ch<='z':answer-=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().rstrip("\n")))
