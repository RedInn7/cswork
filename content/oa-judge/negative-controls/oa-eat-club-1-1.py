def solve(raw):
    v=list(map(int,raw.split()));n=v[0];a=v[1:1+n];total=0;mod=1000000007
    for left in range(n):
        mask=0;gaps=0
        for right in range(left,n):
            value=a[right];bit=1<<(value-1)
            if not mask&bit:
                below=mask&(bit-1);pred=below.bit_length();above=mask>>(value)
                succ=value+1+((above&-above).bit_length()-1) if above else None
                if pred and succ is not None and succ-pred>1:gaps-=1
                if pred and value-pred>1:gaps+=1
                if succ is not None and succ-value>1:gaps+=1
                mask|=bit
            length=right-left+1;total+=gaps
    return str(total%mod)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
