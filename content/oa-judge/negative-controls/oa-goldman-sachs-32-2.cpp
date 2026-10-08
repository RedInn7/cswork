#include <cstdio>
#include <vector>
int main(){int k;long long th;int n;if(scanf("%d %lld %d",&k,&th,&n)!=3)return 0;std::vector<long long>a(n);for(auto&x:a)scanf("%lld",&x);
long long s=0;int c=0;for(int i=0;i<n;i++){s+=a[i];if(i>=k)s-=a[i-k];if(i>=k-1&&s>=th*k)c++;}
printf("%d\n",c);}
