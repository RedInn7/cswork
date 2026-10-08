#include <cstdio>
#include <string>
#include <vector>
#include <algorithm>
#include <cstdint>
using namespace std;
int main(){
 string s;int c;while((c=getchar_unlocked())!=EOF&&c!='\n')s.push_back(char(c));
 if(!s.empty()&&s.back()=='\r')s.pop_back();
 int n=int(s.size());vector<int> radius(n);long long answer=0;
 for(int i=0,l=0,r=-1;i<n;i++){
  int k=i>r?1:min(radius[l+r-i],r-i+1);
  while(i-k>=0&&i+k<n&&s[i-k]==s[i+k])k++;
  radius[i]=k;answer+=k;//odd
  if(i+k-1>r){l=i-k+1;r=i+k-1;}
 }
 fill(radius.begin(),radius.end(),0);
 for(int i=0,l=0,r=-1;i<n;i++){
  int k=i>r?0:min(radius[l+r-i+1],r-i+1);
  while(i-k-1>=0&&i+k<n&&s[i-k-1]==s[i+k])k++;
  radius[i]=k;answer+=k;//even
  if(i+k-1>r){l=i-k;r=i+k-1;}
 }
 printf("%lld\n",answer);
}
