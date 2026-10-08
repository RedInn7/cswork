#include <cstdio>
int main(){int n;scanf("%d",&n);int ones=0;for(int k=1;k<=n;k++){int p;scanf("%d",&p);int answer=1;if(p<=n-ones){ones++;if(p<n-ones+1)answer=2;}printf("%d%c",answer,k==n?'\n':' ');}if(n==0)putchar('\n');}
