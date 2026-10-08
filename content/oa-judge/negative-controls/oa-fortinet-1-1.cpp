#include <cstdio>
#include <vector>
int main(){int n;long long x;if(scanf("%d %lld",&n,&x)!=2)return 0;std::vector<long long>c(n);for(auto&v:c)scanf("%lld",&v);
const long long MOD=1000000007LL;std::vector<long long>pw(n);for(int i=0;i<n;i++)pw[i]=i?pw[i-1]*2%MOD:1;
long long rem=x,ans=0;for(int i=0;i<n;i++)if(c[i]<=rem){rem-=c[i];ans=(ans+pw[i])%MOD;}
printf("%lld\n",ans);}
