def solve(d):
    cursor=1;answers=[];mod=1000000007;size=4096
    def transform(a):
        width=1
        while width<size:
            for start in range(0,size,2*width):
                for i in range(start,start+width):
                    x,y=a[i],a[i+width];a[i]=x+y;a[i+width]=x-y
            width*=2
    for _ in range(int(d[0])):
        n=int(d[cursor]);cursor+=1;freq=[0]*size;duplicate=False
        for i in range(cursor,cursor+n):
            v=int(d[i]);duplicate|=freq[v]>0;freq[v]+=1
        cursor+=n
        if duplicate:answers.append('0');continue
        transform(freq)
        for i in range(size):freq[i]*=freq[i]
        transform(freq);answer=1
        for v in range(1,size):answer=answer*pow(v,freq[v]//size,mod)%mod
        answers.append(str(answer))
    return '\n'.join(answers)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
