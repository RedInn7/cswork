def solve(data):
    pattern=data[0];slots=[];i=0
    while i<len(pattern):
        if pattern[i]=='[':
            j=pattern.index(']',i);slots.append(set(pattern[i+1:j]));i=j+1
        else:slots.append({pattern[i]});i+=1
    matches=[w for w in data[2:] if len(w)>=len(slots) and all(c in allowed for c,allowed in zip(w,slots))]
    return ' '.join([str(len(matches))]+matches)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
