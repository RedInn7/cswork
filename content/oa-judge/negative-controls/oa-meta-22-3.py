def solve(data):
    first,message=data.split('\n',1); n=int(first); count=0; result=[]
    for ch in message:
        lower=ch.lower()
        if 'a'<=lower<='z' and lower not in 'aeiou':
            count+=1
            if count%n==0:
                value=(ord(lower)-96)%26
                while chr(97+value) in 'aeiou':value=(value+1)%26
                changed=chr(97+value); ch=changed.upper() if ch.isupper() else changed
        result.append(ch)
    return ' '.join(''.join(result).split())

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().removesuffix("\n")))
