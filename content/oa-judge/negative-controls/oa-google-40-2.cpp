#include <cstdio>
#include <vector>
#include <set>
using namespace std;
int main(){int n;long long X;int Y;if(scanf("%d %lld %d",&n,&X,&Y)!=3)return 0;vector<long long>a(n);for(auto&v:a)scanf("%lld",&v);
multiset<long long>top,rest;long long restSum=0;int best=0,l=0;
auto add=[&](long long v){if(v==0)return;top.insert(v);if((int)top.size()>Y){auto it=top.begin();rest.insert(*it);restSum+=1;top.erase(it);}};
auto del=[&](long long v){if(v==0)return;auto it=rest.find(v);if(it!=rest.end()){rest.erase(it);restSum-=1;return;}
 top.erase(top.find(v));if(!rest.empty()){auto jt=prev(rest.end());restSum-=1;top.insert(*jt);rest.erase(jt);}};
for(int r=0;r<n;r++){add(a[r]);while(restSum>X){del(a[l]);l++;}if(r-l+1>best)best=r-l+1;}
printf("%d\n",best);}
