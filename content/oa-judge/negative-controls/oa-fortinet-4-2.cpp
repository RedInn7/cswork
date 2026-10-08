#include <cstdio>
#include <vector>
using namespace std;
int readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();int x=0;while(c>32&&c!=EOF){x=x*10+c-'0';c=getchar_unlocked();}return x;}
int main(){int n=readNumber(),last=n;vector<unsigned char>seen(n+1,0);
for(int k=1;k<=n;k++){int p=readNumber();seen[p]=1;while(last>0&&seen[last])last--;int answer=last>0?last+1:1;printf("%d%c",answer,k==n?'\n':' ');}if(n==0)putchar('\n');}
