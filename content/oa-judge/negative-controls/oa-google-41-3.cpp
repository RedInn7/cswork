#include <cstdio>
#include <vector>
using namespace std;
int main(){int n;scanf("%d",&n);vector<long long>p(n);for(auto&x:p)scanf("%lld",&x);long long s=0;long long i=0;
while(i<n){long long b=i;for(long long j=i;j<n&&j<=i+2;j++)if(p[j]>p[b])b=j;s+=p[b];i=b+p[b]+1;}printf("%lld\n",s);}
