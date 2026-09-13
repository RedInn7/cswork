from bisect import bisect_left
def solve(d):
    words=sorted(d[1:]);answer=0
    for i,word in enumerate(words):answer+=bisect_left(words,word+'{')-i
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
