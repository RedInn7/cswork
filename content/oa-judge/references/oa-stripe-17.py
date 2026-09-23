def solve(raw):
    lines=raw.splitlines(); q=int(lines[0]); merchants={}; intents={}
    for line in lines[1:q+1]:
        p=line.split(); ts=int(p[0]); op=p[1]; a=p[2:]
        if op=="INIT":
            name=a[0]; balance=int(a[1]); limit=int(a[2]) if len(a)>2 else None
            if name not in merchants: merchants[name]=[balance,limit]
        elif op=="CREATE":
            pid,name,amount=a[0],a[1],int(a[2])
            if pid not in intents and name in merchants and amount>=0: intents[pid]=[name,amount,"REQUIRES_ACTION",False,None]
        elif op in ("ATTEMPT","SUCCEED","FAIL","UPDATE","REFUND"):
            pid=a[0]
            if pid not in intents: continue
            item=intents[pid]
            if op=="ATTEMPT" and item[2]=="REQUIRES_ACTION": item[2]="PROCESSING"
            elif op=="SUCCEED" and item[2]=="PROCESSING":
                item[2]="COMPLETED"; merchants[item[0]][0]+=item[1]; item[4]=ts
            elif op=="FAIL" and item[2]=="PROCESSING": item[2]="REQUIRES_ACTION"
            elif op=="UPDATE" and item[2]=="REQUIRES_ACTION" and int(a[1])>=0: item[1]=int(a[1])
            elif op=="REFUND" and item[2]=="COMPLETED" and not item[3]:
                limit=merchants[item[0]][1]
                if limit is None or limit<0 or (limit>0 and ts-item[4]<=limit):
                    merchants[item[0]][0]-=item[1]; item[3]=True
    out=[f"{name} {merchants[name][0]}" for name in sorted(merchants)]
    return str(len(out))+("\n"+"\n".join(out) if out else "")
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
