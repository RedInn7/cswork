#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int readInt(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();int x=0;while(c>32&&c!=EOF){x=x*10+c-'0';c=getchar_unlocked();}return x;}
int main(){
 int n=readInt(),m=readInt();
 vector<int>s(n),e(n),head(n,-1),degree(n,0),to(m),next(m),queue(n);
 for(int i=0;i<n;i++){s[i]=readInt();e[i]=readInt();}
 for(int i=0;i<m;i++){int u=readInt()-1,v=readInt()-1;to[i]=v;next[i]=head[u];head[u]=i;degree[v]++;}
 int first=0,last=0;for(int i=0;i<n;i++)if(!degree[i])queue[last++]=i;
 while(first<last){int u=queue[first++];for(int k=head[u];k!=-1;k=next[k]){int v=to[k];s[v]=max(s[v],s[u]);e[v]=min(e[v],e[u]);if(!--degree[v])queue[last++]=v;}}
 bool ok=last==n;for(int i=0;i<n;i++)if(s[i]>=e[i])ok=false;
 if(!ok){puts("IMPOSSIBLE");return 0;}
 for(int i=0;i<n;i++)printf("%d %d\n",s[i],e[i]);
}
