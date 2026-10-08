#include <cstdio>
int main(){unsigned long long a,b;if(scanf("%llu %llu",&a,&b)!=2)return 0;unsigned long long cost=0;
while(a!=b){if(a<b){unsigned long long t=a;a=b;b=t;}unsigned long long q=a/b,r=a%b;if(r==0){cost+=q;a=b;}else{cost+=q;a=r;}}
printf("%llu\n",cost);}
