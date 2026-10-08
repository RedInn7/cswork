#include <iostream>
#include <string>
#include <vector>
#include <algorithm>
using namespace std;
int main(){string s;cin>>s;const string mapping="11222333444555666777888999";int n=s.size(),offset=8*n;vector<int>freq(16*n+1);long long answer=0;
for(int average=1;average<=9;average++){fill(freq.begin(),freq.end(),0);int prefix=0;freq[offset]=1;
for(char c:s){prefix+=mapping[c-'a']-'0'-average;++freq[prefix+offset];answer+=freq[prefix+offset];}}
cout<<answer<<'\n';}
