import sys
def solve(raw):
 t=list(map(int,raw.split()));total,m=t[:2];a=sorted((t[i],t[i+1]) for i in range(2,len(t),2));cursor=1;ans=0
 for l,r in a+[(total+1,total+1)]:
  gap=l-cursor;ans+=gap.bit_count();cursor=r+1
 return str(ans)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
