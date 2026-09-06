class CsworkRuntime {
 static java.util.List<Object> nodes; static java.util.IdentityHashMap<Object,Integer> ids = new java.util.IdentityHashMap<>();
 static Object convert(Object v, java.lang.reflect.Type t) throws Exception {
  if(v==null)return null;
  if(v instanceof java.util.Map && ((java.util.Map)v).containsKey("$ref"))return nodes.get(((Number)((java.util.Map)v).get("$ref")).intValue());
  if(t instanceof java.lang.reflect.ParameterizedType){java.lang.reflect.Type et=((java.lang.reflect.ParameterizedType)t).getActualTypeArguments()[0]; java.util.List<Object> a=new java.util.ArrayList<>();for(Object x:(java.util.List)v)a.add(convert(x,et));return a;}
  Class<?> c=(Class<?>)t;
  if(c.isArray()){java.util.List a=(java.util.List)v;Object r=java.lang.reflect.Array.newInstance(c.getComponentType(),a.size());for(int i=0;i<a.size();i++)java.lang.reflect.Array.set(r,i,convert(a.get(i),c.getComponentType()));return r;}
  if(c==char.class||c==Character.class)return v.toString().charAt(0);
  if(c==int.class||c==Integer.class)return ((Number)v).intValue(); if(c==long.class||c==Long.class)return ((Number)v).longValue(); if(c==double.class||c==Double.class)return ((Number)v).doubleValue(); if(c==float.class||c==Float.class)return ((Number)v).floatValue();return v;
 }
 static Object encode(Object v) throws Exception {
  if(v==null||v instanceof Number||v instanceof Boolean||v instanceof String)return v;if(v instanceof Character)return v.toString();
  if(v.getClass().isArray()){java.util.List<Object>a=new java.util.ArrayList<>();for(int i=0;i<java.lang.reflect.Array.getLength(v);i++)a.add(encode(java.lang.reflect.Array.get(v,i)));return a;}
  if(v instanceof Iterable){java.util.List<Object>a=new java.util.ArrayList<>();for(Object x:(Iterable)v)a.add(encode(x));return a;}
  Integer id=ids.get(v);if(id==null){id=nodes.size();ids.put(v,id);nodes.add(v);}return java.util.Map.of("$ref",id);
 }
 static Object[] arguments(java.util.List a,java.lang.reflect.Type[] types)throws Exception{Object[]r=new Object[types.length];if(a.size()!=r.length)throw new IllegalArgumentException("Argument count mismatch");for(int i=0;i<r.length;i++)r[i]=convert(a.get(i),types[i]);return r;}
 static java.lang.reflect.Method method(Class<?>c,String name,int count)throws Exception{for(java.lang.reflect.Method m:c.getDeclaredMethods())if(m.getName().equals(name)&&m.getParameterCount()==count){m.setAccessible(true);return m;}throw new NoSuchMethodException(name);}
 static Object call(Object obj,String name,java.util.List a)throws Exception{java.lang.reflect.Method m=method(obj.getClass(),name,a.size());return m.invoke(obj,arguments(a,m.getGenericParameterTypes()));}
 static Object construct(Class<?>c,java.util.List a)throws Exception{for(java.lang.reflect.Constructor<?>k:c.getDeclaredConstructors())if(k.getParameterCount()==a.size()){k.setAccessible(true);return k.newInstance(arguments(a,k.getGenericParameterTypes()));}throw new IllegalArgumentException("Missing constructor");}
 public static void main(String[]argv)throws Exception{
  java.util.Map q=(java.util.Map)new Json(new String(System.in.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8)).read();
  nodes=new java.util.ArrayList<>();java.util.List<java.util.Map> ns=(java.util.List)q.get("nodes");
  for(java.util.Map n:ns){Class<?>c=Class.forName((String)n.get("type"));Object o=construct(c,java.util.List.of());ids.put(o,nodes.size());nodes.add(o);}
  for(int i=0;i<ns.size();i++){Object o=nodes.get(i);java.util.Map<String,Object>fs=(java.util.Map)ns.get(i).get("fields");for(var e:fs.entrySet()){try{java.lang.reflect.Field f=o.getClass().getDeclaredField(e.getKey());f.setAccessible(true);f.set(o,convert(e.getValue(),f.getGenericType()));}catch(NoSuchFieldException ignored){}}}
  Object result;Object[] a=new Object[0];String kind=(String)q.get("kind");
  if(kind.equals("design")){java.util.List<String>ops=(java.util.List)q.get("operations");java.util.List<java.util.List>ps=(java.util.List)q.get("parameters");Object o=construct(Class.forName(ops.get(0)),ps.get(0));java.util.List<Object>out=new java.util.ArrayList<>();out.add(null);for(int i=1;i<ops.size();i++)out.add(encode(call(o,ops.get(i),ps.get(i))));result=out;}
  else if(kind.equals("codec")){Object o=construct(Class.forName("Codec"),java.util.List.of());java.util.List<Object>out=new java.util.ArrayList<>();for(Object x:(java.util.List)q.get("args"))out.add(encode(call(o,(String)q.get("operation"),java.util.Collections.singletonList(x))));result=out;}
  else{Object o=construct(Class.forName("Solution"),java.util.List.of());java.util.List raw=(java.util.List)q.get("args");java.lang.reflect.Method m=method(o.getClass(),(String)q.get("method"),raw.size());a=arguments(raw,m.getGenericParameterTypes());result=encode(m.invoke(o,a));}
  if(((Number)q.get("problemId")).intValue()==190 && result instanceof Integer) result=Integer.toUnsignedLong((Integer)result);
  Object ea=encode(a);java.util.List<Object>en=new java.util.ArrayList<>();for(int i=0;i<nodes.size();i++){Object o=nodes.get(i);java.util.Map<String,Object>fs=new java.util.LinkedHashMap<>();for(java.lang.reflect.Field f:o.getClass().getDeclaredFields()){if(java.lang.reflect.Modifier.isStatic(f.getModifiers())||f.getName().equals("calls"))continue;f.setAccessible(true);fs.put(f.getName(),encode(f.get(o)));}en.add(java.util.Map.of("id",i,"type",o.getClass().getSimpleName(),"fields",fs));}
  java.util.Map<String,Object>out=new java.util.LinkedHashMap<>();out.put("result",result);out.put("args",ea);out.put("nodes",en);java.nio.file.Files.writeString(java.nio.file.Path.of("cswork-result.json"),Json.write(out));
 }
 static class Json {
  String s;int p;Json(String v){s=v;}void ws(){while(p<s.length()&&Character.isWhitespace(s.charAt(p)))p++;}
  Object read(){ws();char c=s.charAt(p++);if(c=='n'){p+=3;return null;}if(c=='t'){p+=3;return true;}if(c=='f'){p+=4;return false;}if(c=='"'){StringBuilder b=new StringBuilder();while(true){char x=s.charAt(p++);if(x=='"')return b.toString();if(x=='\\'){x=s.charAt(p++);switch(x){case 'n':x='\n';break;case 'r':x='\r';break;case 't':x='\t';break;case 'b':x='\b';break;case 'f':x='\f';break;case 'u':x=(char)Integer.parseInt(s.substring(p,p+4),16);p+=4;}}b.append(x);}}
  if(c=='['){java.util.List<Object>a=new java.util.ArrayList<>();ws();if(s.charAt(p)==']'){p++;return a;}do{a.add(read());ws();}while(s.charAt(p++)==',');return a;}
  if(c=='{'){java.util.Map<String,Object>m=new java.util.LinkedHashMap<>();ws();if(s.charAt(p)=='}'){p++;return m;}do{String k=(String)read();ws();p++;m.put(k,read());ws();}while(s.charAt(p++)==',');return m;}
  int start=p-1;while(p<s.length()&&"0123456789.eE+-".indexOf(s.charAt(p))>=0)p++;String n=s.substring(start,p);if(n.contains(".")||n.contains("e")||n.contains("E"))return Double.parseDouble(n);return Long.parseLong(n);}
  static String write(Object v){if(v==null)return "null";if(v instanceof String){StringBuilder b=new StringBuilder("\"");for(char c:((String)v).toCharArray()){if(c=='"'||c=='\\')b.append('\\').append(c);else if(c<32)b.append(String.format("\\u%04x",(int)c));else b.append(c);}return b.append('"').toString();}if(v instanceof java.util.Map){java.util.List<String>a=new java.util.ArrayList<>();for(var e:((java.util.Map<?,?>)v).entrySet())a.add(write(e.getKey().toString())+":"+write(e.getValue()));return "{"+String.join(",",a)+"}";}if(v instanceof Iterable){java.util.List<String>a=new java.util.ArrayList<>();for(Object x:(Iterable)v)a.add(write(x));return "["+String.join(",",a)+"]";}return v.toString();}
 }
}
