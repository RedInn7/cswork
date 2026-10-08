#include <cstdio>
#include <vector>
using namespace std;
int main(){int n;scanf("%d",&n);vector<long long>a(n);for(auto&x:a)scanf("%lld",&x);
for(int i=0;i+1<n;i++)if(a[i]>a[i+1]){long long t=a[i];a[i]=a[i+1];a[i+1]=t;i++;}
long long s=0;for(int i=0;i<n;i++)s+=a[i]*(i+1);printf("%lld\n",s);}
