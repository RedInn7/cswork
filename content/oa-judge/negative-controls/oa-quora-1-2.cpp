#include <cstdio>
int main(){int n;unsigned long long k;scanf("%d %llu",&n,&k);long long c=0;for(int i=0;i<n;i++){unsigned long long x;scanf("%llu",&x);if(x%k==0)c++;}printf("%lld\n",c);}
