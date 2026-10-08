#include <cstdio>
#include <cstdint>
#include <vector>
using namespace std;
int64_t readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();bool negative=c=='-';if(c=='-'||c=='+')c=getchar_unlocked();int64_t value=0;while(c>32&&c!=EOF){value=value*10+c-'0';c=getchar_unlocked();}return negative?-value:value;}
int main(){int n=int(readNumber()),turns=int(readNumber());vector<int32_t>a(size_t(n)*n);for(auto &v:a)v=int32_t(readNumber());turns%=4;
for(int step=0;step<turns;step++)for(int r=0;r<n/2;r++)for(int c=r+1;c<n-1-r;c++){
size_t p=size_t(r)*n+c,q=size_t(c)*n+n-1-r,u=size_t(n-1-r)*n+n-1-c,v=size_t(n-1-c)*n+r;
int32_t saved=a[p];a[p]=a[v];a[v]=a[u];a[u]=a[q];a[q]=saved;}
for(int r=0;r<n;r++)for(int c=0;c<n;c++)printf("%d%c",int(a[size_t(r)*n+c]),c+1==n?'\n':' ');}
