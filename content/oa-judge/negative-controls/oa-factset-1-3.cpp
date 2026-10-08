#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();int x=0;while(c>32&&c!=EOF){x=x*10+c-'0';c=getchar_unlocked();}return x;}
int main(){
 int n=readNumber(),answer=0;
 vector<int> dp(n+1,0);
 for(int row=0;row<n;row++){
  int diagonal=0;
  for(int col=1;col<=n;col++){
   int above=dp[col],value=readNumber();
   dp[col]=value?1+min({above,dp[col-1],diagonal}):0;
   if(row==0)answer=max(answer,dp[col]);
   diagonal=above;
  }
 }
 printf("%d\n",answer);
}
