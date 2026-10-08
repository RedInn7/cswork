#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<long long>p(n);for(auto&x:p)scanf("%lld",&x);
vector<long long>dp(n+1,0);
for(int i=n-1;i>=0;i--){long long nx=min<long long>(n,i+2);dp[i]=max(dp[i+1],p[i]+dp[nx]);}
printf("%lld\n",dp[0]);}
