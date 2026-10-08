#include <cstdio>
#include <vector>
#include <unordered_map>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<long long>a(n),b(n);for(auto&x:a)scanf("%lld",&x);for(auto&x:b)scanf("%lld",&x);
unordered_map<long long,long long>cnt;cnt.reserve(2*n+1);int ans=0;
for(int i=0;i<n;i++){long long key=a[i]+b[i];ans+=++cnt[key];}
printf("%d\n",ans);}
