from collections import defaultdict
def solve(d):
    lines=d.split('\n');n=int(lines[0]);locations=defaultdict(list)
    for i in range(n):
        identifier,time=lines[1+2*i].split();hour,minute=map(int,time.split(':'));locations[lines[2+2*i]].append((hour*60+minute,i,int(identifier)))
    groups=[]
    for rides in locations.values():
        rides.sort();i=0
        while i<len(rides):
            start=i;i+=1
            while i<len(rides) and i-start<3 and rides[i][0]-rides[start][0]<=10:i+=1
            selected=rides[start:i];groups.append((min(v[1] for v in selected),sorted(v[2] for v in selected)))
    groups.sort()
    return str(len(groups))+'\n'+'\n'.join(str(len(ids))+' '+' '.join(map(str,ids)) for _,ids in groups)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().removesuffix("\n")))
