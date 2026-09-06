// cswork's authored, dependency-free JSON graph transport. User programs run only in go-judge.
namespace cswork {
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
