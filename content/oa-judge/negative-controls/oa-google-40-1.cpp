#include <cstdio>
#include <vector>
using namespace std;
int main(){int n;long long X;int Y;scanf("%d %lld %d",&n,&X,&Y);vector<long long>a(n);for(auto&v:a)scanf("%lld",&v);int best=0;
for(int l=0;l<n;l++){long long s=0;int z=0;for(int r=l;r<n;r++){if(a[r]){if(z<Y)z++;else s+=a[r];}if(s>X)break;if(r-l+1>best)best=r-l+1;}}
printf("%d\n",best);}
