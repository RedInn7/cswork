#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<long long>a(n+1);for(int i=1;i<=n;i++)scanf("%lld",&a[i]);
vector<long long>dp(n+1,0);
for(int i=1;i<=n;i++){dp[i]=dp[i-1]+a[i]*(i-1);if(i>=2)dp[i]=max(dp[i],dp[i-2]+a[i]*(i-2)+a[i-1]*(i-1));}
printf("%lld\n",dp[n]);}
