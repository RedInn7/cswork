#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
typedef unsigned long long u64;
int main(){int n;u64 k;if(scanf("%d %llu",&n,&k)!=2)return 0;const u64 LIM=1000000000000000000ULL;vector<u64>pw;
for(u64 p=k;;){pw.push_back(p);if(p>LIM/k||pw.size()>=2)break;p*=k;}
long long c=0;for(int i=0;i<n;i++){u64 x;scanf("%llu",&x);if(find(pw.begin(),pw.end(),x)!=pw.end())c++;}
printf("%lld\n",c);}
