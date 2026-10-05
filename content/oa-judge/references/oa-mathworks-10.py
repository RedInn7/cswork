from collections import Counter
def solve(s):
 d=s.split();words=d[1:];pat=[tuple(ord(w[i+1])-ord(w[i]) for i in range(len(w)-1)) for w in words];cnt=Counter(pat)
 return next(w for w,p in zip(words,pat) if cnt[p]==1)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
