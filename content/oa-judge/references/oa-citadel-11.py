from array import array
import re
def solve(raw):
    data=array('I',(int(m[0]) for m in re.finditer(r'\d+',raw)));n=data[0];lower=data[1:n+1];higher=data[n+1:];del data
    low=1;high=n
    while low<high:
        target=(low+high+1)//2;chosen=0
        for a,b in zip(lower,higher):
            if a>=chosen and b>=target-1-chosen:chosen+=1
            if chosen==target:break
        if chosen==target:low=target
        else:high=target-1
    return str(low)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
