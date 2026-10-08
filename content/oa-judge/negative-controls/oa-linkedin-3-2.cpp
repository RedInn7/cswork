#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int n,m,K;vector<int>eu,ev,ew,head,nxt,to,wt;
bool ok(int lim){vector<int>d(n+1,-1);vector<int>q;q.reserve(n);q.push_back(1);d[1]=0;
 for(size_t i=0;i<q.size();i++){int u=q[i];for(int e=head[u];e>=0;e=nxt[e])if(wt[e]<=lim&&d[to[e]]<0){d[to[e]]=d[u]+1;q.push_back(to[e]);}}
 return d[n]>=0&&d[n]<K;}
int main(){if(scanf("%d %d %d",&n,&m,&K)!=3)return 0;head.assign(n+1,-1);vector<int>ws;
for(int i=0;i<m;i++){int a,b,w;scanf("%d %d %d",&a,&b,&w);ws.push_back(w);
 to.push_back(b);wt.push_back(w);nxt.push_back(head[a]);head[a]=to.size()-1;
 to.push_back(a);wt.push_back(w);nxt.push_back(head[b]);head[b]=to.size()-1;}
sort(ws.begin(),ws.end());ws.erase(unique(ws.begin(),ws.end()),ws.end());
int lo=0,hi=ws.size()-1;while(lo<hi){int mid=(lo+hi)/2;if(ok(ws[mid]))hi=mid;else lo=mid+1;}
printf("%d\n",ws[lo]);}
