def solve(d):
    start=0
    for part in d[0].split('.'):start=start*256+int(part)
    count=int(d[1]);out=[]
    while count:
        align=(start&-start) if start else 1<<32
        size=min(align,1<<(count.bit_length()-1))
        address='.'.join(str((start>>s)&255) for s in (24,16,8,0))
        out.append(address+'/'+str(32-(size.bit_length()-1)))
        start+=size;count-=size
    return str(len(out)-1)+'\n'+'\n'.join(out[:-1])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
