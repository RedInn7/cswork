#include <cstdio>
int main(){long long num;int q,s;if(scanf("%lld %d %d",&num,&q,&s)!=3)return 0;long long r[100005],c[100005];
for(int i=0;i<q;i++)scanf("%lld %lld",&r[i],&c[i]);long long k;scanf("%lld",&k);long long ans=k;
for(int i=0;i<q;i++)if(r[i]<k&&k<c[i])ans=r[i]+c[i]-k;
printf("%lld\n",ans);}
