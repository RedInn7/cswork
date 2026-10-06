# 结束时刻漏计
def solve(raw):
 t=raw.split();n,m=int(t[0]),int(t[1]);ans=[0]*n;st=[];prev=0
 for log in t[2:2+m]:
  fid,kind,ts=log.split(':');fid=int(fid);ts=int(ts)
  if kind=='start':
   if st:ans[st[-1]]+=ts-prev
   st.append(fid);prev=ts
  else:ans[st.pop()]+=ts-prev;prev=ts+1
 return ' '.join(map(str,ans))
