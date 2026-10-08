#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n,k;if(scanf("%d %d",&n,&k)!=2)return 0;vector<long long>r(n),s(n);for(auto&x:r)scanf("%lld",&x);for(auto&x:s)scanf("%lld",&x);
vector<long long>P(n+1,0),Q(n+1,0);for(int i=0;i<n;i++){P[i+1]=P[i]+s[i]*r[i];Q[i+1]=Q[i]+r[i];}
long long base=P[n],best=base;int h=k/2;
for(int l=0;l+k<=n;l++){long long v=base-(P[l+k]-P[l])+(Q[l+h]-Q[l]);best=max(best,v);}
printf("%lld\n",best);}
