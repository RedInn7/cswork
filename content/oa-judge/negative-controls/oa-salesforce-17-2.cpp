#include <cstdio>
#include <vector>
using namespace std;
int main(){int n;scanf("%d",&n);vector<long long>a(n);for(auto&x:a)scanf("%lld",&x);
long long s=0;for(int i=0;i<n;i++)s+=a[i]*(i+1);for(int i=0;i+1<n;i++)if(a[i]>a[i+1])s+=a[i]-a[i+1];printf("%lld\n",s);}
