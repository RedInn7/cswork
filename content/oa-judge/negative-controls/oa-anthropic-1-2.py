def solve(d):
    from array import array
    ops=[];keys=set();pos=1
    for _ in range(int(d[0])):
        c=d[pos];pos+=1
        size=2 if c=='SET' else 0 if c=='BACKUP' else 1
        args=d[pos:pos+size];pos+=size;ops.append((c,args))
        if c in ('SET','GET','DELETE'):keys.add(args[0])
    ids={k:i for i,k in enumerate(sorted(keys))};width=max(1,len(ids))
    left=array('I',[0]);right=array('I',[0]);value=array('I',[0]);values=['NULL'];saved=[0];root=0;out=[]
    def update(node,lo,hi,index,v):
        cur=len(left);left.append(left[node]);right.append(right[node]);value.append(value[node])
        if hi-lo==1:value[cur]=v
        else:
            mid=(lo+hi)//2
            if index<mid:left[cur]=update(left[node],lo,mid,index,v)
            else:right[cur]=update(right[node],mid,hi,index,v)
        return cur
    def lookup(node,index):
        lo=0;hi=width
        while node and hi-lo>1:
            mid=(lo+hi)//2
            if index<mid:node=left[node];hi=mid
            else:node=right[node];lo=mid
        return value[node]
    for c,args in ops:
        if c=='SET':
            values.append(args[1]);root=update(root,0,width,ids[args[0]],len(values)-1);out.append('OK')
        elif c=='GET':out.append(values[lookup(root,ids[args[0]])])
        elif c=='DELETE':
            old=lookup(root,ids[args[0]]);out.append('OK' if old and values[old]!='NULL' else 'NULL')
            if old:root=update(root,0,width,ids[args[0]],0)
        elif c=='BACKUP':saved.append(root);out.append(str(len(saved)-1))
        else:
            v=int(args[0])
            if 1<=v<len(saved):root=saved[v];out.append('OK')
            else:out.append('NULL')
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
