def solve(d):
    s=d[0];start=int(d[1]);difference=s.count('a')-s.count('b');answer=10**9
    if difference==0:return '0'
    for direction in (-1,1):
        delta=difference;pos=start;steps=0
        while 0<=pos+direction<=len(s):
            edge=pos if direction==1 else pos-1;delta+=-2 if s[edge]=='a' else 2;pos+=direction;steps+=1
            if delta==0:answer=min(answer,steps)
    return str(answer if answer<10**9 else -1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
