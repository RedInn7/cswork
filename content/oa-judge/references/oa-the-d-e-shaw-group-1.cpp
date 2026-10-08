#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<long long>a(n);for(auto&x:a)scanf("%lld",&x);
int P=1;while(P<n&&a[P-1]<=a[P])P++;
if(P==n){printf("%lld\n",(long long)n*(n+1)/2-1);return 0;}
int S=n-1;while(S>0&&a[S-1]<=a[S])S--;
long long ans=n-max(1,S); // l=0: next kept index r+1 in [max(1,S), n-1]
for(int l=1;l<=P;l++){int lo=max(l+1,S);int j=lower_bound(a.begin()+lo,a.end(),a[l-1])-a.begin();ans+=n-j+1;}
printf("%lld\n",ans);}
