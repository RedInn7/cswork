#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;int main(){int n;scanf("%d",&n);vector<int>h(n);for(int &v:h)scanf("%d",&v);long long answer=0;for(int i=1;i+1<n;i++)answer+=max(0,min(h[i-1],h[i+1])-h[i]);printf("%lld\n",answer);}
