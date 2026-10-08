#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
long long readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();bool negative=c=='-';if(negative)c=getchar_unlocked();long long x=0;while(c>32&&c!=EOF){x=x*10+c-'0';c=getchar_unlocked();}return negative?-x:x;}
struct Query{int type,x,value;};
int main(){int n=readNumber();vector<int>a(n);for(int &x:a)x=readNumber();int q=readNumber();vector<Query>queries(q);for(auto &x:queries){x.type=readNumber();x.x=readNumber();x.value=readNumber();}
vector<unsigned char>done(n,0);int floor=0;
for(int i=q-1;i>=0;i--){auto x=queries[i];if(x.type==2)floor=max(floor,x.x);else if(true){a[x.x-1]=max(x.value,floor);done[x.x-1]=1;}}
for(int i=0;i<n;i++){if(!done[i])a[i]=max(a[i],floor);printf("%d%c",a[i],i==n-1?'\n':' ');}}
