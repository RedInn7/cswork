#include <cstdio>
#include <vector>
#include <string>
using namespace std;
int sz;vector<long long>t;
long long key(long long cnt,int idx){return cnt*(1LL<<20)+idx;}
int main(){int s,n;if(scanf("%d %d",&s,&n)!=2)return 0;sz=1;while(sz<s)sz<<=1;t.assign(2*sz,1LL<<62);
for(int i=0;i<s;i++)t[sz+i]=key(0,i);for(int i=sz-1;i>0;i--)t[i]=min(t[2*i],t[2*i+1]);
string out;out.reserve(n*7);
for(int k=0;k<n;k++){int r;scanf("%d",&r);long long best=1LL<<62;int lo=sz,hi=sz+r+1;
 while(lo<hi){if(lo&1)best=min(best,t[lo++]);if(hi&1)best=min(best,t[--hi]);lo>>=1;hi>>=1;}
 int idx=best&((1<<20)-1);int p=sz+idx;for(p>>=1;p;p>>=1)t[p]=min(t[2*p],t[2*p+1]);
 out+=to_string(idx);out+=k+1<n?' ':'\n';}
fwrite(out.data(),1,out.size(),stdout);}
