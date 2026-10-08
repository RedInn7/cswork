#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;scanf("%d",&n);vector<int>h(n),l(n),r(n);for(int &v:h)scanf("%d",&v);
for(int i=0;i<n;i++)l[i]=max(h[i],i?l[i-1]:0);for(int i=n-1;i>=0;i--)r[i]=max(h[i],i+1<n?r[i+1]:0);
long long answer=0;for(int i=0;i<n;i++)answer+=max(l[i],r[i])-h[i];printf("%lld\n",answer);}
