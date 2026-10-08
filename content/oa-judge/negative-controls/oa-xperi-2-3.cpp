#include <cstdio>
int main(){unsigned a,b;scanf("%u %u",&a,&b);unsigned long long cost=0;if(!a)a=1;if(!b)b=1;
while(a!=b){if(a<b){unsigned t=a;a=b;b=t;}unsigned q=a/b,r=a%b;if(r==0){cost+=q-1;a=b;}else{cost+=q;a=r;}}
printf("%llu\n",cost);}
