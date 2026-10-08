#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n,m;if(scanf("%d %d",&n,&m)!=2)return 0;vector<int>lim(n+2,n+1);
for(int i=0;i<m;i++){int a,b;scanf("%d %d",&a,&b);if(a>b)swap(a,b);lim[a]=min(lim[a],b);}
long long ans=0;int R=n+1;for(int l=n;l>=1;l--){R=min(R,lim[l]);ans+=min(R+1,n+1)-l;}
printf("%lld\n",ans);}
