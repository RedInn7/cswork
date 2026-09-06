// Trusted JSON transport only; user solutions are never part of this library.
#include "json-runtime.hpp"
#ifndef CSWORK_JSON_INLINE
#define CSWORK_JSON_INLINE
#endif
namespace cswork {
class ParserImpl {
    const string& s; size_t p=0;
    void ws(){while(p<s.size()&&isspace((unsigned char)s[p]))++p;}
    char take(){if(p>=s.size())throw runtime_error("Truncated JSON");return s[p++];}
    static void utf8(string& out,unsigned cp){if(cp<128)out+=(char)cp;else if(cp<2048){out+=(char)(192|(cp>>6));out+=(char)(128|(cp&63));}else if(cp<65536){out+=(char)(224|(cp>>12));out+=(char)(128|((cp>>6)&63));out+=(char)(128|(cp&63));}else{out+=(char)(240|(cp>>18));out+=(char)(128|((cp>>12)&63));out+=(char)(128|((cp>>6)&63));out+=(char)(128|(cp&63));}}
    unsigned hex(){unsigned v=0;for(int i=0;i<4;++i){char c=take();v*=16;if(c>='0'&&c<='9')v+=c-'0';else if(c>='a'&&c<='f')v+=c-'a'+10;else if(c>='A'&&c<='F')v+=c-'A'+10;else throw runtime_error("Invalid JSON unicode");}return v;}
    string text(){if(take()!='"')throw runtime_error("Expected JSON string");string out;for(;;){char c=take();if(c=='"')return out;if((unsigned char)c<32)throw runtime_error("Invalid JSON control character");if(c!='\\'){out+=c;continue;}c=take();switch(c){case '"':case '\\':case '/':out+=c;break;case 'b':out+='\b';break;case 'f':out+='\f';break;case 'n':out+='\n';break;case 'r':out+='\r';break;case 't':out+='\t';break;case 'u':{unsigned cp=hex();if(cp>=0xd800&&cp<=0xdbff){if(take()!='\\'||take()!='u')throw runtime_error("Missing low surrogate");unsigned low=hex();if(low<0xdc00||low>0xdfff)throw runtime_error("Invalid low surrogate");cp=0x10000+((cp-0xd800)<<10)+(low-0xdc00);}else if(cp>=0xdc00&&cp<=0xdfff)throw runtime_error("Unexpected low surrogate");utf8(out,cp);break;}default:throw runtime_error("Invalid JSON escape");}}}
    Json parseValue(int depth){if(depth>1024)throw runtime_error("JSON nesting limit");ws();if(p>=s.size())throw runtime_error("Missing JSON value");char c=s[p];if(c=='"')return Json(text());if(c=='['){++p;Json::Array a;ws();if(p<s.size()&&s[p]==']'){++p;return a;}for(;;){a.push_back(parseValue(depth+1));ws();char sep=take();if(sep==']')return a;if(sep!=',')throw runtime_error("Invalid JSON array");}}if(c=='{'){++p;Json::Object o;ws();if(p<s.size()&&s[p]=='}'){++p;return o;}for(;;){ws();string k=text();ws();if(take()!=':')throw runtime_error("Invalid JSON object");o[k]=parseValue(depth+1);ws();char sep=take();if(sep=='}')return o;if(sep!=',')throw runtime_error("Invalid JSON object");}}for(auto item:{pair<const char*,Json>{"true",Json(true)},{"false",Json(false)},{"null",Json()}}){size_t n=strlen(item.first);if(s.compare(p,n,item.first)==0){p+=n;return item.second;}}size_t begin=p;if(s[p]=='-')++p;while(p<s.size()&&isdigit((unsigned char)s[p]))++p;bool real=false;if(p<s.size()&&s[p]=='.'){real=true;++p;while(p<s.size()&&isdigit((unsigned char)s[p]))++p;}if(p<s.size()&&(s[p]=='e'||s[p]=='E')){real=true;++p;if(p<s.size()&&(s[p]=='+'||s[p]=='-'))++p;while(p<s.size()&&isdigit((unsigned char)s[p]))++p;}if(begin==p)throw runtime_error("Invalid JSON value");string token=s.substr(begin,p-begin);size_t used;Json result=real?Json(stod(token,&used)):Json(stoll(token,&used));if(used!=token.size())throw runtime_error("Invalid JSON number");return result;}
public: explicit ParserImpl(const string& input):s(input){} Json parse(){Json j=parseValue(0);ws();if(p!=s.size())throw runtime_error("Trailing JSON data");return j;}
};
CSWORK_JSON_INLINE Json::Json() noexcept=default;
CSWORK_JSON_INLINE Json::Json(nullptr_t):value(nullptr){} CSWORK_JSON_INLINE Json::Json(bool v):value(v){}
CSWORK_JSON_INLINE Json::Json(long long v):value(v){} CSWORK_JSON_INLINE Json::Json(int v):value((long long)v){} CSWORK_JSON_INLINE Json::Json(double v):value(v){}
CSWORK_JSON_INLINE Json::Json(string v):value(move(v)){} CSWORK_JSON_INLINE Json::Json(const char* v):value(string(v)){}
CSWORK_JSON_INLINE Json::Json(Array v):value(move(v)){} CSWORK_JSON_INLINE Json::Json(Object v):value(move(v)){}
CSWORK_JSON_INLINE Json::Json(const Json&)=default; CSWORK_JSON_INLINE Json::Json(Json&&) noexcept=default; CSWORK_JSON_INLINE Json::~Json()=default;
CSWORK_JSON_INLINE Json& Json::operator=(const Json&)=default; CSWORK_JSON_INLINE Json& Json::operator=(Json&&) noexcept=default;
CSWORK_JSON_INLINE bool Json::null()const{return holds_alternative<nullptr_t>(value);}
CSWORK_JSON_INLINE const Json::Array& Json::array()const{return get<Array>(value);} CSWORK_JSON_INLINE Json::Array& Json::array(){return get<Array>(value);}
CSWORK_JSON_INLINE const Json::Object& Json::object()const{return get<Object>(value);}
CSWORK_JSON_INLINE const Json& Json::at(const string& key)const{return object().at(key);}
CSWORK_JSON_INLINE bool Json::has(const string& key)const{return holds_alternative<Object>(value)&&object().count(key);}
CSWORK_JSON_INLINE string Json::str()const{return get<string>(value);}
CSWORK_JSON_INLINE long long Json::integer()const{if(holds_alternative<long long>(value))return get<long long>(value);if(holds_alternative<bool>(value))return get<bool>(value);throw runtime_error("Expected integer");}
CSWORK_JSON_INLINE double Json::number()const{return holds_alternative<double>(value)?get<double>(value):(double)integer();}
CSWORK_JSON_INLINE Json Parser::parse(){return ParserImpl(s).parse();}
CSWORK_JSON_INLINE void dump(ostream& out,const Json& j){
    if(j.null())out<<"null";else if(holds_alternative<bool>(j.value))out<<(get<bool>(j.value)?"true":"false");else if(holds_alternative<long long>(j.value))out<<get<long long>(j.value);else if(holds_alternative<double>(j.value)){double v=get<double>(j.value);if(!isfinite(v))throw runtime_error("Nonfinite JSON output");out<<setprecision(17)<<v;}else if(holds_alternative<string>(j.value)){out<<'"';for(unsigned char c:j.str()){switch(c){case '"':out<<"\\\"";break;case '\\':out<<"\\\\";break;case '\n':out<<"\\n";break;case '\r':out<<"\\r";break;case '\t':out<<"\\t";break;default:if(c<32){const char* h="0123456789abcdef";out<<"\\u00"<<h[c>>4]<<h[c&15];}else out<<(char)c;}}out<<'"';}else if(holds_alternative<Json::Array>(j.value)){out<<'[';bool first=true;for(const auto& v:j.array()){if(!first)out<<',';first=false;dump(out,v);}out<<']';}else{out<<'{';bool first=true;for(const auto& [k,v]:j.object()){if(!first)out<<',';first=false;dump(out,Json(k));out<<':';dump(out,v);}out<<'}';}
}
} // namespace cswork
