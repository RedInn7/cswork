#include <cstdio>
#include <vector>
#include <numeric>
using namespace std;
struct E{int u,v,w;};
int find(vector<int>&p,int x){while(p[x]!=x){p[x]=p[p[x]];x=p[x];}return x;}
int main(){int n,m;scanf("%d%d",&n,&m);vector<E>edges(m);for(auto &e:edges){scanf("%d%d%d",&e.u,&e.v,&e.w);--e.u;--e.v;}
long long ans=0;vector<int>p(n),size(n);
for(int w=1;w<=26;w++){iota(p.begin(),p.end(),0);fill(size.begin(),size.end(),1);
for(auto e:edges)if(e.w==w){int a=find(p,e.u),b=find(p,e.v);if(a!=b){if(size[a]<size[b])swap(a,b);ans+=1LL*size[a]*size[b];p[b]=a;size[a]+=size[b];}}}
printf("%lld\n",ans);}
