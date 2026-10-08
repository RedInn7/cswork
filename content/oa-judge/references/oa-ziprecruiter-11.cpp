#include <cstdio>
#include <vector>
#include <algorithm>
#include <string>
using namespace std;
int main(){int n,m;if(scanf("%d %d",&n,&m)!=2)return 0;vector<long long>L(n),R(n);for(int i=0;i<n;i++)scanf("%lld %lld",&L[i],&R[i]);
sort(L.begin(),L.end());sort(R.begin(),R.end());string out;
for(int j=0;j<m;j++){long long p;scanf("%lld",&p);long long a=upper_bound(L.begin(),L.end(),p)-L.begin();long long b=lower_bound(R.begin(),R.end(),p)-R.begin();out+=to_string(a-b);out+=j+1<m?' ':'\n';}
fwrite(out.data(),1,out.size(),stdout);}
