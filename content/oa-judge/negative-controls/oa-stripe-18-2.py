from datetime import datetime,timedelta
def solve(raw):
    lines=raw.splitlines(); start=datetime.strptime(lines[0],"%Y-%m-%d %H:%M"); end=datetime.strptime(lines[1],"%Y-%m-%d %H:%M")
    count=int(lines[2]); windows={i:[] for i in range(7)}
    for line in lines[3:3+count]:
        weekday,a,b=line.split(); windows[int(weekday)].append((a,b))
    found=set(); day=start.date()
    while day<=end.date():
        for a,b in windows[day.weekday()]:
            base=datetime.combine(day,datetime.strptime(a,"%H:%M").time())
            finish=datetime.combine(day,datetime.strptime(b,"%H:%M").time()) if b!="24:00" else datetime.combine(day+timedelta(days=1),datetime.min.time())
            cur=base
            while cur+timedelta(minutes=30)<=finish:
                nxt=cur+timedelta(minutes=30)
                if cur>=start: found.add(cur.strftime("%Y-%m-%d %H:%M")+","+nxt.strftime("%Y-%m-%d %H:%M"))
                cur=nxt
        day+=timedelta(days=1)
    ordered=sorted(found)
    return str(len(ordered))+("\n"+"\n".join(ordered) if ordered else "")
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
