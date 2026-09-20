def solve(raw):
    text,prefix,suffix=raw.split();best=(-1,'')
    for l in range(len(text)):
        for r in range(l+1,len(text)+1):
            part=text[l:r];a=b=0
            for k in range(1,min(len(part),len(prefix))+1):
                if part.startswith(prefix[-k:]):a=k
            for k in range(1,min(len(part),len(suffix))+1):
                if part.endswith(suffix[:k]):b=k
            score=a
            if score>best[0] or (score==best[0] and part<best[1]):best=(score,part)
    return best[1]

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
