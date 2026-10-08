#include <cstdio>
#include <vector>
#include <string>
#include <cstdlib>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<long long>a(n);for(auto&x:a)scanf("%lld",&x);
string out;long long k=0;
for(int i=0;i<n;i++)for(int j=i+1;j<n;j++){long long p=llabs(a[i]),q=llabs(a[j]);if(max(p,q)<=2*min(p,q)){k++;out+=to_string(a[i]);out+=' ';out+=to_string(a[j]);out+='\n';}}
printf("%lld\n",k);fwrite(out.data(),1,out.size(),stdout);}
