#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<pair<long long,int>>e;e.reserve(2*n);
for(int i=0;i<n;i++){long long x,r;scanf("%lld %lld",&x,&r);e.push_back({x-r,1});e.push_back({x+r+1,-1});}
sort(e.begin(),e.end());long long ans=0;int cov=0;
for(size_t i=0;i<e.size();){long long p=e[i].first;while(i<e.size()&&e[i].first==p)cov+=e[i++].second;
if(i<e.size()&&cov==1)ans+=1;}
printf("%lld\n",ans);}
