#include <cstdio>
#include <algorithm>
using namespace std;
int main(){int n,m;if(scanf("%d %d",&n,&m)!=2)return 0;long long sa=0,sb=0,za=0,zb=0,x;
for(int i=0;i<n;i++){scanf("%lld",&x);sa+=x;za+=x==0;}for(int i=0;i<m;i++){scanf("%lld",&x);sb+=x;zb+=x==0;}
long long loA=sa+za,hiA=sa+10000*za,loB=sb+zb,hiB=sb+10000*zb;long long lo=min(loA,loB),hi=min(hiA,hiB);
printf("%lld\n",lo<=hi?lo:-1);}
