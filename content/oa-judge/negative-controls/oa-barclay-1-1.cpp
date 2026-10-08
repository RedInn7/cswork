#include <cstdio>
#include <vector>
#include <numeric>
#include <algorithm>
using namespace std;
int bestDiv(int g,int R){if(g<=R)return g;int b=1;for(int d=1;(long long)d*d<=g;d++)if(g%d==0){if(d<=R)b=max(b,d);if(g/d<=R)b=max(b,g/d);}return b;}
int main(){int n,R;if(scanf("%d %d",&n,&R)!=2)return 0;vector<int>a(n);for(auto&x:a)scanf("%d",&x);
vector<int>pre(n+1,0),suf(n+2,0);for(int i=0;i<n;i++)pre[i+1]=gcd(pre[i],a[i]);for(int i=n-1;i>=0;i--)suf[i]=gcd(suf[i+1],a[i]);
int ans=0;vector<int>seen;
for(int i=0;i<n;i++){int g=gcd(pre[i],suf[i+1]);ans=max(ans,bestDiv(g,R));}
printf("%d\n",ans);}
