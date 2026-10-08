#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int T;scanf("%d",&T);while(T--){int n;long long M;scanf("%d %lld",&n,&M);vector<int>R(n+1);vector<long long>C(n+1),L(n+1);
vector<vector<long long>>ch(n+1);for(int i=1;i<=n;i++){scanf("%d %lld %lld",&R[i],&C[i],&L[i]);ch[i].push_back(C[i]);if(R[i])ch[R[i]].push_back(C[i]);}
long long best=0;for(int v=1;v<=n;v++){sort(ch[v].begin(),ch[v].end());long long s=0,c=0;for(long long x:ch[v]){if(s+x>M)break;s+=x;c++;}best=max(best,c*L[v]);}
printf("%lld\n",best);}}
