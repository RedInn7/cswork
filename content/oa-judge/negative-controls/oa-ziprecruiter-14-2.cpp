#include <cstdio>
#include <cstring>
#include <set>
#include <string>
int main(){static char s[2048];scanf("%2047s",s);int n=strlen(s);std::set<std::string>t;
for(int i=0;i+2<n;i++)if(s[i]!=s[i+1]&&s[i]!=s[i+2]&&s[i+1]!=s[i+2])t.insert(std::string(s+i,3));printf("%d\n",(int)t.size());}
