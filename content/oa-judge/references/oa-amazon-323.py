def solve(d):
    vowel=consonant=False;answer=0
    for c in d[0]:
        if c in 'aeiou':vowel=True
        else:consonant=True
        if vowel and consonant:answer+=1;vowel=consonant=False
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
