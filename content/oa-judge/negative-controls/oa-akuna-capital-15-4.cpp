#include <cstdio>
#include <string>
#include <vector>
#include <map>
#include <unordered_map>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<string>c(n);vector<long long>x(n),y(n);char buf[32];
unordered_map<string,int>id;id.reserve(2*n+1);
for(int i=0;i<n;i++){scanf("%31s %lld %lld",buf,&x[i],&y[i]);c[i]=buf;id[c[i]]=i;}
vector<int>bx(n),by(n);for(int i=0;i<n;i++)bx[i]=by[i]=i;
sort(bx.begin(),bx.end(),[&](int a,int b){return x[a]!=x[b]?x[a]<x[b]:y[a]<y[b];});
sort(by.begin(),by.end(),[&](int a,int b){return y[a]!=y[b]?y[a]<y[b]:x[a]<x[b];});
vector<int>px(n),py(n);for(int i=0;i<n;i++){px[bx[i]]=i;py[by[i]]=i;}
int m;scanf("%d",&m);string out;
for(int k=0;k<m;k++){scanf("%31s",buf);int q=id[buf];int best=-1;long long bd=0;
auto consider=[&](int j){long long d=llabs(x[j]-x[q])+llabs(y[j]-y[q]);if(best<0||d<bd||(d==bd&&c[j]<c[best])){best=j;bd=d;}};
int p=px[q];if(p+1<n&&x[bx[p+1]]==x[q])consider(bx[p+1]);
p=py[q];if(p+1<n&&y[by[p+1]]==y[q])consider(by[p+1]);
out+=best<0?string("NONE"):c[best];out+='\n';}
fwrite(out.data(),1,out.size(),stdout);}
