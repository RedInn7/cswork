from functools import lru_cache
def count(limit):
    if limit<0:return 0
    digits=tuple(map(int,str(limit)))
    @lru_cache(None)
    def dp(pos,mask,started,tight):
        if pos==len(digits):return 1
        top=digits[pos] if tight else 9;answer=0
        for d in range(top+1):
            nt=tight and d==top
            if not started and d==0:answer+=dp(pos+1,mask,False,nt)
            elif not mask>>d&1:answer+=dp(pos+1,mask|1<<d,True,nt)
        return answer
    return dp(0,0,False,True)
def solve(raw):
    l,h=map(int,raw.split());return str(count(h)-count(l))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
