# 只保留最后收到的字节
def solve(raw):
 t=list(map(int,raw.split()));n,m=t[:2];i=2;segments=[]
 for _ in range(n):segments.append((t[i],t[i+1]));i+=2
 data=t[i:i+m];seen=set();done=[False]*n;count=0;out=[]
 for byte in data:
  seen.clear();seen.add(byte)
  for j,(start,length) in enumerate(segments):
   if not done[j] and all(x in seen for x in range(start,start+length)):done[j]=True;count+=1
  out.append(str(count))
 return ' '.join(out)
