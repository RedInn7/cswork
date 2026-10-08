#include <cstdio>
int main(){int n,k;scanf("%d %d",&n,&k);long long c=0;for(int i=0;i<n;i++){int x;scanf("%d",&x);int y=x;while(k>1&&y!=0&&y%k==0)y/=k;if(y==1&&x!=1)c++;}printf("%lld\n",c);}
