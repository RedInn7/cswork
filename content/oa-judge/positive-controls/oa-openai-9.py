"""Independent prefix-tree decomposition, deliberately reversed valid output."""
import sys

def solve(data):
    address,count=data.split();lo=0
    for octet in address.split('.'):lo=lo*256+int(octet)
    hi=lo+int(count);blocks=[]
    def visit(start,size,prefix):
        if start>=hi or start+size<=lo:return
        if lo<=start and start+size<=hi:
            ip='.'.join(str((start>>s)&255) for s in (24,16,8,0))
            blocks.append(ip+'/'+str(prefix));return
        visit(start,size//2,prefix+1)
        visit(start+size//2,size//2,prefix+1)
    visit(0,1<<32,0)
    return str(len(blocks))+'\n'+'\n'.join(reversed(blocks))

if __name__=='__main__':print(solve(sys.stdin.read()))
