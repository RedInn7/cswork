#include <cstdio>
#include <algorithm>
using namespace std;
int main(){int n,m;if(scanf("%d %d",&n,&m)!=2)return 0;long long sa=0,sb=0,za=0,zb=0,x;
for(int i=0;i<n;i++){scanf("%lld",&x);sa+=x;za+=x==0;}for(int i=0;i<m;i++){scanf("%lld",&x);sb+=x;zb+=x==0;}
long long loA=sa+za,hiA=za?(long long)4e18:sa,loB=sb+zb,hiB=zb?(long long)4e18:sb;long long lo=max(loA,loB),hi=min(hiA,hiB);
printf("%lld\n",lo<=hi?lo:-1);}
