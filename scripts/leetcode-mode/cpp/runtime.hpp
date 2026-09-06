// cswork's authored, dependency-free JSON graph transport. User programs run only in go-judge.
namespace cswork {
struct Json {
    using Array=vector<Json>; using Object=map<string,Json>;
    variant<nullptr_t,bool,long long,double,string,Array,Object> value=nullptr;
    Json()=default; Json(nullptr_t):value(nullptr){} Json(bool v):value(v){}
    Json(long long v):value(v){} Json(int v):value((long long)v){} Json(double v):value(v){}
    Json(string v):value(move(v)){} Json(const char* v):value(string(v)){}
    Json(Array v):value(move(v)){} Json(Object v):value(move(v)){}
    bool null()const{return holds_alternative<nullptr_t>(value);}
    const Array& array()const{return get<Array>(value);} Array& array(){return get<Array>(value);}
    const Object& object()const{return get<Object>(value);}
    const Json& at(const string& key)const{return object().at(key);}
    bool has(const string& key)const{return holds_alternative<Object>(value)&&object().count(key);}
    string str()const{return get<string>(value);}
    long long integer()const{if(holds_alternative<long long>(value))return get<long long>(value);if(holds_alternative<bool>(value))return get<bool>(value);throw runtime_error("Expected integer");}
    double number()const{return holds_alternative<double>(value)?get<double>(value):(double)integer();}
};
class Parser {
    const string& s; size_t p=0;
    void ws(){while(p<s.size()&&isspace((unsigned char)s[p]))++p;}
    char take(){if(p>=s.size())throw runtime_error("Truncated JSON");return s[p++];}
    static void utf8(string& out,unsigned cp){if(cp<128)out+=(char)cp;else if(cp<2048){out+=(char)(192|(cp>>6));out+=(char)(128|(cp&63));}else if(cp<65536){out+=(char)(224|(cp>>12));out+=(char)(128|((cp>>6)&63));out+=(char)(128|(cp&63));}else{out+=(char)(240|(cp>>18));out+=(char)(128|((cp>>12)&63));out+=(char)(128|((cp>>6)&63));out+=(char)(128|(cp&63));}}
    unsigned hex(){unsigned v=0;for(int i=0;i<4;++i){char c=take();v*=16;if(c>='0'&&c<='9')v+=c-'0';else if(c>='a'&&c<='f')v+=c-'a'+10;else if(c>='A'&&c<='F')v+=c-'A'+10;else throw runtime_error("Invalid JSON unicode");}return v;}
    string text(){if(take()!='"')throw runtime_error("Expected JSON string");string out;for(;;){char c=take();if(c=='"')return out;if((unsigned char)c<32)throw runtime_error("Invalid JSON control character");if(c!='\\'){out+=c;continue;}c=take();switch(c){case '"':case '\\':case '/':out+=c;break;case 'b':out+='\b';break;case 'f':out+='\f';break;case 'n':out+='\n';break;case 'r':out+='\r';break;case 't':out+='\t';break;case 'u':{unsigned cp=hex();if(cp>=0xd800&&cp<=0xdbff){if(take()!='\\'||take()!='u')throw runtime_error("Missing low surrogate");unsigned low=hex();if(low<0xdc00||low>0xdfff)throw runtime_error("Invalid low surrogate");cp=0x10000+((cp-0xd800)<<10)+(low-0xdc00);}else if(cp>=0xdc00&&cp<=0xdfff)throw runtime_error("Unexpected low surrogate");utf8(out,cp);break;}default:throw runtime_error("Invalid JSON escape");}}}
    Json parseValue(int depth){if(depth>1024)throw runtime_error("JSON nesting limit");ws();if(p>=s.size())throw runtime_error("Missing JSON value");char c=s[p];if(c=='"')return Json(text());if(c=='['){++p;Json::Array a;ws();if(p<s.size()&&s[p]==']'){++p;return a;}for(;;){a.push_back(parseValue(depth+1));ws();char sep=take();if(sep==']')return a;if(sep!=',')throw runtime_error("Invalid JSON array");}}if(c=='{'){++p;Json::Object o;ws();if(p<s.size()&&s[p]=='}'){++p;return o;}for(;;){ws();string k=text();ws();if(take()!=':')throw runtime_error("Invalid JSON object");o[k]=parseValue(depth+1);ws();char sep=take();if(sep=='}')return o;if(sep!=',')throw runtime_error("Invalid JSON object");}}for(auto item:{pair<const char*,Json>{"true",Json(true)},{"false",Json(false)},{"null",Json()}}){size_t n=strlen(item.first);if(s.compare(p,n,item.first)==0){p+=n;return item.second;}}size_t begin=p;if(s[p]=='-')++p;while(p<s.size()&&isdigit((unsigned char)s[p]))++p;bool real=false;if(p<s.size()&&s[p]=='.'){real=true;++p;while(p<s.size()&&isdigit((unsigned char)s[p]))++p;}if(p<s.size()&&(s[p]=='e'||s[p]=='E')){real=true;++p;if(p<s.size()&&(s[p]=='+'||s[p]=='-'))++p;while(p<s.size()&&isdigit((unsigned char)s[p]))++p;}if(begin==p)throw runtime_error("Invalid JSON value");string token=s.substr(begin,p-begin);size_t used;Json result=real?Json(stod(token,&used)):Json(stoll(token,&used));if(used!=token.size())throw runtime_error("Invalid JSON number");return result;}
public: explicit Parser(const string& input):s(input){} Json parse(){Json j=parseValue(0);ws();if(p!=s.size())throw runtime_error("Trailing JSON data");return j;}
};
void dump(ostream& out,const Json& j){
    if(j.null())out<<"null";else if(holds_alternative<bool>(j.value))out<<(get<bool>(j.value)?"true":"false");else if(holds_alternative<long long>(j.value))out<<get<long long>(j.value);else if(holds_alternative<double>(j.value)){double v=get<double>(j.value);if(!isfinite(v))throw runtime_error("Nonfinite JSON output");out<<setprecision(17)<<v;}else if(holds_alternative<string>(j.value)){out<<'"';for(unsigned char c:j.str()){switch(c){case '"':out<<"\\\"";break;case '\\':out<<"\\\\";break;case '\n':out<<"\\n";break;case '\r':out<<"\\r";break;case '\t':out<<"\\t";break;default:if(c<32){const char* h="0123456789abcdef";out<<"\\u00"<<h[c>>4]<<h[c&15];}else out<<(char)c;}}out<<'"';}else if(holds_alternative<Json::Array>(j.value)){out<<'[';bool first=true;for(const auto& v:j.array()){if(!first)out<<',';first=false;dump(out,v);}out<<']';}else{out<<'{';bool first=true;for(const auto& [k,v]:j.object()){if(!first)out<<',';first=false;dump(out,Json(k));out<<':';dump(out,v);}out<<'}';}
}
struct Graph;
template<class T> struct Convert;
struct Graph {
    vector<void*> nodes; vector<string> types; unordered_map<const void*,size_t> ids;
    template<class T> T* pointer(const Json& j){if(j.null())return nullptr;size_t i=j.at("$ref").integer();if(i>=nodes.size())throw runtime_error("Invalid node reference");return static_cast<T*>(nodes[i]);}
    template<class T> Json ref(T* p){if(!p)return Json();auto it=ids.find(p);if(it==ids.end()){size_t i=nodes.size();ids[p]=i;nodes.push_back(p);types.push_back(typeName<T>());return Json::Object{{"$ref",Json((long long)i)}};}return Json::Object{{"$ref",Json((long long)it->second)}};}
    template<class T> static string typeName(){if constexpr(is_same_v<T,TreeNode>)return "TreeNode";else if constexpr(is_same_v<T,ListNode>)return "ListNode";else if constexpr(is_same_v<T,Node>)return "Node";else if constexpr(is_same_v<T,Interval>)return "Interval";else if constexpr(is_same_v<T,MountainArray>)return "MountainArray";else static_assert(!sizeof(T),"Unsupported graph type");}
    void load(const Json& input); Json serialize();
};
template<class T> struct Convert {
    static T from(Graph& g,const Json& j){if constexpr(is_same_v<T,string>)return j.str();else if constexpr(is_same_v<T,char>){string s=j.str();if(s.size()!=1)throw runtime_error("Expected character");return s[0];}else if constexpr(is_same_v<T,bool>)return j.integer()!=0;else if constexpr(is_integral_v<T>)return static_cast<T>(j.integer());else if constexpr(is_floating_point_v<T>)return static_cast<T>(j.number());else if constexpr(is_pointer_v<T>)return g.pointer<remove_pointer_t<T>>(j);else static_assert(!sizeof(T),"Unsupported argument type");}
    static Json to(Graph& g,const T& v){if constexpr(is_same_v<T,string>)return Json(v);else if constexpr(is_same_v<T,char>)return Json(string(1,v));else if constexpr(is_same_v<T,bool>)return Json(v);else if constexpr(is_integral_v<T>)return Json((long long)v);else if constexpr(is_floating_point_v<T>)return Json((double)v);else if constexpr(is_pointer_v<T>)return g.ref(v);else static_assert(!sizeof(T),"Unsupported result type");}
};
template<class T> struct Convert<vector<T>> {
    static vector<T> from(Graph& g,const Json& j){vector<T> out;out.reserve(j.array().size());for(const auto& v:j.array())out.push_back(Convert<T>::from(g,v));return out;}
    static Json to(Graph& g,const vector<T>& a){Json::Array out;out.reserve(a.size());for(const T& v:a)out.push_back(Convert<T>::to(g,v));return out;}
};
template<> struct Convert<Interval> {
    static Interval from(Graph& g,const Json& j){return *g.pointer<Interval>(j);}
    static Json to(Graph& g,const Interval& v){return g.ref(new Interval(v));}
};
template<> struct Convert<MountainArray> {
    static MountainArray from(Graph& g,const Json& j){return *g.pointer<MountainArray>(j);}
    static Json to(Graph& g,const MountainArray& v){for(size_t i=0;i<g.types.size();++i)if(g.types[i]=="MountainArray"){auto p=(MountainArray*)g.nodes[i];p->calls=v.calls;return g.ref(p);}throw runtime_error("Missing MountainArray input identity");}
};
void Graph::load(const Json& input){
    for(const auto& n:input.array()){size_t id=n.at("id").integer();if(id!=nodes.size())throw runtime_error("Nonsequential graph ids");string t=n.at("type").str();void* p;if(t=="TreeNode")p=new TreeNode();else if(t=="ListNode")p=new ListNode();else if(t=="Node")p=new Node();else if(t=="Interval")p=new Interval();else if(t=="MountainArray")p=new MountainArray();else throw runtime_error("Unsupported node type "+t);ids[p]=id;nodes.push_back(p);types.push_back(t);}
    for(const auto& n:input.array()){size_t id=n.at("id").integer();const auto& f=n.at("fields");auto integer=[&](const string& k){return f.has(k)?(int)f.at(k).integer():0;};auto field=[&](const string& k)->Json{return f.has(k)?f.at(k):Json();};const string& t=types[id];if(t=="TreeNode"){auto p=(TreeNode*)nodes[id];p->val=integer("val");p->left=pointer<TreeNode>(field("left"));p->right=pointer<TreeNode>(field("right"));}else if(t=="ListNode"){auto p=(ListNode*)nodes[id];p->val=integer("val");p->next=pointer<ListNode>(field("next"));}else if(t=="Node"){auto p=(Node*)nodes[id];p->val=integer("val");p->left=pointer<Node>(field("left"));p->right=pointer<Node>(field("right"));p->next=pointer<Node>(field("next"));p->random=pointer<Node>(field("random"));p->prev=pointer<Node>(field("prev"));p->child=pointer<Node>(field("child"));p->parent=pointer<Node>(field("parent"));}else if(t=="Interval"){auto p=(Interval*)nodes[id];p->start=integer("start");p->end=integer("end");}else if(t=="MountainArray"){auto p=(MountainArray*)nodes[id];p->values=Convert<vector<int>>::from(*this,f.at("values"));}}
}
Json Graph::serialize(){Json::Array out;for(size_t i=0;i<nodes.size();++i){string t=types[i];Json::Object f;if(t=="TreeNode"){auto p=(TreeNode*)nodes[i];f={{"val",p->val},{"left",ref(p->left)},{"right",ref(p->right)}};}else if(t=="ListNode"){auto p=(ListNode*)nodes[i];f={{"val",p->val},{"next",ref(p->next)}};}else if(t=="Node"){auto p=(Node*)nodes[i];f={{"val",p->val},{"left",ref(p->left)},{"right",ref(p->right)},{"next",ref(p->next)},{"random",ref(p->random)},{"prev",ref(p->prev)},{"child",ref(p->child)},{"parent",ref(p->parent)}};}else if(t=="Interval"){auto p=(Interval*)nodes[i];f={{"start",p->start},{"end",p->end}};}else if(t=="MountainArray"){auto p=(MountainArray*)nodes[i];f={{"values",Convert<vector<int>>::to(*this,p->values)},{"calls",p->calls}};}out.push_back(Json::Object{{"id",Json((long long)i)},{"type",t},{"fields",f}});}return out;}
template<class T> struct Method;
template<class R,class C,class... A> struct Method<R(C::*)(A...)>{using Result=R;using Args=tuple<decay_t<A>...>;};
template<class R,class C,class... A> struct Method<R(C::*)(A...)const>:Method<R(C::*)(A...)>{};
template<class Tuple,size_t... I> Tuple readArgs(Graph& g,const Json& a,index_sequence<I...>){if(a.array().size()!=sizeof...(I))throw runtime_error("Function argument count mismatch");return Tuple{Convert<tuple_element_t<I,Tuple>>::from(g,a.array()[I])...};}
template<class Tuple,size_t... I> Json writeArgs(Graph& g,Tuple& a,index_sequence<I...>){return Json::Array{Convert<tuple_element_t<I,Tuple>>::to(g,get<I>(a))...};}
struct Answer{Json result,args;};
template<class C,class M> Answer call(Graph& g,C& obj,M method,const Json& input){using Traits=Method<M>;using A=typename Traits::Args;auto indices=make_index_sequence<tuple_size_v<A>>{};auto args=readArgs<A>(g,input,indices);Json result;if constexpr(is_void_v<typename Traits::Result>)apply([&](auto&... v){(obj.*method)(v...);},args);else{auto value=apply([&](auto&...v){return (obj.*method)(v...);},args);result=Convert<decay_t<decltype(value)>>::to(g,value);}return {result,writeArgs(g,args,indices)};}
template<class C,class...A> unique_ptr<C> construct(Graph& g,const Json& input){using T=tuple<decay_t<A>...>;auto args=readArgs<T>(g,input,index_sequence_for<A...>{});return apply([](auto&...v){return make_unique<C>(v...);},args);}
} // namespace cswork
