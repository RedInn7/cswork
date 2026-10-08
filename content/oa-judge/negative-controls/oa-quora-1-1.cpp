#include <cstdio>
#include <cmath>
int main(){int n;unsigned long long k;scanf("%d %llu",&n,&k);long long c=0;for(int i=0;i<n;i++){unsigned long long x;scanf("%llu",&x);double e=log((double)x)/log((double)k);if(fabs(e-llround(e))<1e-9&&llround(e)>=1)c++;}printf("%lld\n",c);}
