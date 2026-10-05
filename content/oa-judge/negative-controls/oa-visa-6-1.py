import sys
def solve(s):
 w=s.strip(); c=[]
 for k in range(1,len(w)+1): c.append(w[:k][::-1]+w[k:])
 return min(c)
if __name__=='__main__': print(solve(sys.stdin.read()))
