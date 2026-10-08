#include <cstdio>
#include <vector>
#include <queue>
#include <algorithm>
using namespace std;
int main(){int T;if(scanf("%d",&T)!=1)return 0;while(T--){int n;long long M;scanf("%d %lld",&n,&M);
vector<int>R(n+1);vector<long long>C(n+1),L(n+1);for(int i=1;i<=n;i++)scanf("%d %lld %lld",&R[i],&C[i],&L[i]);
vector<priority_queue<long long>>h(n+1);vector<long long>sum(n+1,0);vector<int>id(n+1);long long best=0;
for(int i=1;i<=n;i++){id[i]=i;h[i].push(C[i]);sum[i]=C[i];}
for(int v=n;v>=1;v--){auto &H=h[id[v]];long long &S=sum[id[v]];
 while(S>M){S-=H.top();H.pop();}
 best=max(best,(long long)(int)(L[v]*(long long)H.size()));
 int p=R[v];if(p>0){int a=id[p],b=id[v];if(h[a].size()<h[b].size())swap(a,b);
  while(!h[b].empty()){h[a].push(h[b].top());sum[a]+=h[b].top();h[b].pop();}sum[b]=0;id[p]=a;}}
printf("%lld\n",best);}}
