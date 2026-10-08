#include <cstdio>
#include <string>
#include <unordered_map>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;unordered_map<string,long long>cnt;cnt.reserve(2*n+1);long long ans=0;
for(int i=0;i<n;i++){long long v;scanf("%lld",&v);string s=to_string(v),best=s;for(size_t k=1;k<s.size();k++){string t=s.substr(k)+s.substr(0,k);if(t<best)best=t;}
 ans+=cnt[best]++;}
printf("%lld\n",ans);}
