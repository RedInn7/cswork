#include <cstdio>
#include <cstdint>
#include <vector>
#include <algorithm>
using namespace std;
int64_t readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();bool neg=c=='-';if(c=='-'||c=='+')c=getchar_unlocked();int64_t x=0;while(c>32&&c!=EOF){x=x*10+c-'0';c=getchar_unlocked();}return neg?-x:x;}
int main(){int n=readNumber(),t=readNumber();vector<int32_t>a(size_t(n)*n);for(auto &x:a)x=readNumber();for(int k=0;k<t%4;k++){for(int r=0;r<n;r++)for(int c=r+1;c<n;c++)swap(a[size_t(r)*n+c],a[size_t(c)*n+r]);for(int r=0;r<n;r++)reverse(a.begin()+size_t(r)*n,a.begin()+size_t(r+1)*n);}for(int r=0;r<n;r++)for(int c=0;c<n;c++)printf("%d%c",int(a[size_t(r)*n+c]),c+1==n?'\n':' ');}
