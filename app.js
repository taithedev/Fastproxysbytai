
"use strict";
(()=>{
 const $=id=>document.getElementById(id);
 const supa=window.supabase?.createClient("https://wfqudstuncdldsvxqveu.supabase.co","sb_publishable_LsAzcgmeAp3fBCtdU6eQzw_u5PPJjar")||null;
 let user=null,settings={homepage:"https://example.com",search_engine:"duckduckgo",preferred_view:"direct"};
 let bookmarks=[],history=[],subscription=null,role="member",tabs=[],activeId=null;
 const send=(id,text)=>{const n=$(id);if(n)n.textContent=text};
 const maxTabs=10;
 function safeUrl(raw){
   if(typeof raw!=="string"||!raw.trim()||raw.length>2048)return null;
   raw=raw.trim();
   if(/^[a-z][\w+.-]*:/i.test(raw)&&!/^https?:\/\//i.test(raw))return null;
   if(/^https?:\/\//i.test(raw)){
     try{const u=new URL(raw);if(!["http:","https:"].includes(u.protocol)||u.username||u.password||u.origin===location.origin)return null;return u.href}catch{return null}
   }
   if(/^([\w-]+\.)+[\w-]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(raw)){
     try{const u=new URL("https://"+raw);return u.href}catch{return null}
   }
   const base=settings.search_engine==="brave"?"https://search.brave.com/search?q=":"https://duckduckgo.com/?q=";
   return base+encodeURIComponent(raw);
 }
 function current(){return tabs.find(t=>t.id===activeId)}
 function newTab(url){
   if(tabs.length>=maxTabs){send("page-status","Maximum 10 internal tabs.");return}
   const t={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())),stack:[],index:-1,mode:settings.preferred_view};
   tabs.push(t);activeId=t.id;renderTabs();draw();
   if(url)navigate(url);
 }
 function renderTabs(){
   $("tabs").replaceChildren();
   for(const t of tabs){
     const b=document.createElement("button");b.className="tab"+(t.id===activeId?" active":"");b.type="button";
     const name=document.createElement("span");name.className="tab-name";
     const url=t.stack[t.index];
     name.textContent=url?(()=>{try{return new URL(url).hostname}catch{return "New tab"}})():"New tab";
     b.onclick=()=>{activeId=t.id;renderTabs();draw()};
     const close=document.createElement("button");close.type="button";close.className="tab-close";close.textContent="×";close.title="Close internal tab";
     close.onclick=e=>{e.stopPropagation();closeTab(t.id)};
     b.append(name,close);$("tabs").append(b);
   }
 }
 function closeTab(id){
   tabs=tabs.filter(t=>t.id!==id);
   if(!tabs.length){newTab();return}
   if(activeId===id)activeId=tabs[0].id;
   renderTabs();draw();
 }
 function draw(){
   const tab=current(),url=tab?.stack[tab.index];
   $("viewer-mode").value=tab?.mode||settings.preferred_view;
   $("back").disabled=!tab||tab.index<1;$("forward").disabled=!tab||tab.index>=tab.stack.length-1;
   if(!url){$("viewer").hidden=true;$("viewer-empty").hidden=false;$("viewer").removeAttribute("src");$("address").value="";send("page-status","Ready");return}
   $("address").value=url;
   $("viewer-empty").hidden=true;$("viewer").hidden=false;
   const view=tab.mode==="reader"?"/api/preview?url="+encodeURIComponent(url):url;
   if($("viewer").getAttribute("src")!==view){
     $("viewer").setAttribute("sandbox",tab.mode==="reader"?"allow-same-origin":"allow-scripts allow-forms allow-same-origin");
     $("viewer").setAttribute("src",view);
   }
   send("page-status",tab.mode==="reader"?"Loading limited text-only preview...":"Loading site (embedding depends on its policies)...");
   renderTabs();
 }
 async function recordVisit(url){
   if(!user||!supa)return;
   const {error}=await supa.from("fastproxy_history").insert({user_id:user.id,url,title:new URL(url).hostname});
   if(!error)loadHistory();
 }
 function navigate(raw,{record=true}={}){
   const url=safeUrl(raw);
   if(!url){send("page-status","Invalid or unsafe address.");return}
   const tab=current();if(!tab)return;
   if(tab.stack[tab.index]!==url){
     tab.stack=tab.stack.slice(0,tab.index+1);tab.stack.push(url);tab.index=tab.stack.length-1;
   }
   draw();if(record)recordVisit(url);
   showPanel("browser");
 }
 function traverse(delta){
   const tab=current();if(!tab)return;
   const next=tab.index+delta;if(next<0||next>=tab.stack.length)return;
   tab.index=next;draw();
 }
 $("viewer").addEventListener("load",()=>{
   const tab=current();if(!tab)return;
   send("page-status",tab.mode==="reader"?"Preview loaded — scripts and forms disabled":"Site loaded or embedding restricted; switch to Reader for supported sites.");
   if(tab.mode!=="reader")return;
   try{
     const url=new URL($("viewer").contentWindow.location.href);
     if(url.pathname!=="/api/preview")return;
     const target=url.searchParams.get("url");
     const u=safeUrl(target);
     if(u&&tab.stack[tab.index]!==u)navigate(u);
   }catch{}
 });
 function showPanel(panel){
   document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.panel===panel));
   document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id==="panel-"+panel));
   if(panel==="bookmarks")renderBookmarks();
   if(panel==="history")renderHistory();
   if(panel==="owner"&&user)loadOwner();
 }
 document.querySelectorAll("[data-panel]").forEach(b=>b.onclick=()=>showPanel(b.dataset.panel));
 document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>navigate(b.dataset.go));
 $("navigate").onsubmit=e=>{e.preventDefault();navigate($("address").value)};
 $("new-tab").onclick=()=>newTab();
 $("back").onclick=()=>traverse(-1);$("forward").onclick=()=>traverse(1);
 $("reload").onclick=()=>{const tab=current();if(tab?.index>=0){$("viewer").removeAttribute("src");draw()}};
 $("home").onclick=()=>navigate(settings.homepage);
 $("viewer-mode").onchange=e=>{const tab=current();if(tab){tab.mode=e.target.value;draw()}};
 $("save-bookmark").onclick=async()=>{
   const url=current()?.stack[current().index];
   if(!url){send("page-status","Open a page first.");return}
   if(!user||!supa){$("auth-dialog").showModal();send("auth-message","Sign in to save cloud bookmarks.");return}
   const {error}=await supa.from("fastproxy_bookmarks").insert({user_id:user.id,url,title:new URL(url).hostname});
   send("page-status",error?error.message:"Bookmark saved.");
   if(!error)loadBookmarks();
 };
 function entry(title,detail,onOpen,onDelete){
   const node=document.createElement("div");node.className="entry";
   const left=document.createElement("div");
   const h=document.createElement("div");h.className="entry-name";h.textContent=title;
   const u=document.createElement("div");u.className="entry-url";u.textContent=detail;left.append(h,u);
   const actions=document.createElement("div");actions.className="entry-actions";
   const open=document.createElement("button");open.textContent="Open";open.onclick=onOpen;actions.append(open);
   if(onDelete){const del=document.createElement("button");del.textContent="Remove";del.onclick=onDelete;actions.append(del)}
   node.append(left,actions);return node;
 }
 function renderBookmarks(){
   $("bookmark-list").replaceChildren();
   if(!user){sendEmpty("bookmark-list","Sign in to sync bookmarks.");return}
   if(!bookmarks.length){sendEmpty("bookmark-list","No bookmarks saved.");return}
   for(const b of bookmarks){
     $("bookmark-list").append(entry(b.title,b.url,()=>navigate(b.url),async()=>{
       const {error}=await supa.from("fastproxy_bookmarks").delete().eq("id",b.id);
       if(error)send("page-status",error.message);await loadBookmarks();
     }));
   }
 }
 function renderHistory(){
   $("history-list").replaceChildren();
   if(!user){sendEmpty("history-list","Sign in to sync history.");return}
   if(!history.length){sendEmpty("history-list","No browsing history yet.");return}
   for(const h of history)$("history-list").append(entry(h.title||h.url,new Date(h.visited_at).toLocaleString()+" · "+h.url,()=>navigate(h.url),async()=>{
     await supa.from("fastproxy_history").delete().eq("id",h.id);await loadHistory();
   }));
 }
 function sendEmpty(id,text){const p=document.createElement("p");p.textContent=text;$(id).append(p)}
 async function loadBookmarks(){
   if(!user||!supa)return;
   const {data,error}=await supa.from("fastproxy_bookmarks").select("id,title,url").order("created_at",{ascending:false}).limit(200);
   if(!error)bookmarks=data||[];
   renderBookmarks();
 }
 async function loadHistory(){
   if(!user||!supa)return;
   const {data,error}=await supa.from("fastproxy_history").select("id,title,url,visited_at").order("visited_at",{ascending:false}).limit(150);
   if(!error)history=data||[];
   renderHistory();
 }
 $("clear-history").onclick=async()=>{
   if(!user||!supa)return;
   if(!confirm("Clear your cloud history?"))return;
   const {error}=await supa.from("fastproxy_history").delete().eq("user_id",user.id);
   if(error)send("page-status",error.message);await loadHistory();
 };
 async function loadSettings(){
   if(!user||!supa)return;
   const {data}=await supa.from("fastproxy_settings").select("homepage,search_engine,preferred_view").eq("user_id",user.id).maybeSingle();
   if(data)settings={...settings,...data};
   fillSettings();
 }
 function fillSettings(){
   $("homepage").value=settings.homepage;$("search-engine").value=settings.search_engine;
   $("default-view").value=settings.preferred_view;
 }
 $("save-settings").onclick=async()=>{
   const homepage=safeUrl($("homepage").value);
   if(!homepage){send("settings-message","Enter a valid homepage URL.");return}
   const next={homepage,search_engine:$("search-engine").value,preferred_view:$("default-view").value};
   if(!user||!supa){settings=next;send("settings-message","Saved for this session. Sign in to sync.");return}
   const {error}=await supa.from("fastproxy_settings").upsert({user_id:user.id,...next},{onConflict:"user_id"});
   if(error){send("settings-message",error.message);return}
   settings=next;send("settings-message","Preferences synced.");
 };
 async function updatePlan(){
   subscription=null;role="member";
   if(user&&supa){
     const [s,r]=await Promise.all([
       supa.from("fastproxy_subscriptions").select("plan,status").eq("user_id",user.id).maybeSingle(),
       supa.from("fastproxy_roles").select("role").eq("user_id",user.id).maybeSingle()
     ]);
     subscription=s.data;role=r.data?.role||"member";
   }
   const paid=subscription&&["active","trialing"].includes(subscription.status)?subscription.plan:"free";
   $("tier-badge").textContent=role==="owner"?"OWNER":paid.toUpperCase();
 }
 async function refreshAccount(){
   if(!supa)return;
   const {data:{user:u}}=await supa.auth.getUser();
   const changed=user?.id!==u?.id;
   user=u;
   $("current-user").textContent=user?.email||"Guest";
   if(!user){bookmarks=[];history=[];subscription=null;role="member";renderBookmarks();renderHistory();await updatePlan();return}
   if(changed){
     await supa.from("fastproxy_profiles").upsert({user_id:user.id,display_name:user.email?.split("@")[0]||""},{onConflict:"user_id",ignoreDuplicates:true});
     await Promise.all([loadBookmarks(),loadHistory(),loadSettings(),updatePlan()]);
   }else await updatePlan();
 }
 const authAction=async action=>{
   if(!supa){send("auth-message","Account services are unavailable.");return}
   const email=$("email").value.trim(),password=$("password").value;
   if(!email){send("auth-message","Enter your email.");return}
   if(action!=="reset"&&password.length<6){send("auth-message","Password must contain at least six characters.");return}
   let result;
   if(action==="signup")result=await supa.auth.signUp({email,password,options:{emailRedirectTo:location.origin}});
   else if(action==="reset")result=await supa.auth.resetPasswordForEmail(email,{redirectTo:location.origin});
   else result=await supa.auth.signInWithPassword({email,password});
   send("auth-message",result.error?.message||(action==="signup"?"Account submitted. Check your email for confirmation if required.":action==="reset"?"Password reset email requested.":"Signed in."));
   if(!result.error)await refreshAccount();
 };
 $("account-toggle").onclick=()=>$("auth-dialog").showModal();
 $("signup").onclick=()=>authAction("signup");$("signin").onclick=()=>authAction("signin");
 $("reset-password").onclick=()=>authAction("reset");
 $("signout").onclick=async()=>{if(supa)await supa.auth.signOut();user=null;await refreshAccount();send("auth-message","Signed out.")};
 async function server(action,body){
   if(!user||!supa)throw new Error("Sign in first.");
   const {data:{session}}=await supa.auth.getSession();
   if(!session?.access_token)throw new Error("Session expired. Sign in again.");
   const res=await fetch("/api/"+action,{method:body?"POST":"GET",headers:{"Authorization":"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
   const data=await res.json().catch(()=>({error:"Invalid response"}));
   if(!res.ok)throw new Error(data.error||"Request failed");
   return data;
 }
 document.querySelectorAll("[data-subscribe]").forEach(b=>b.onclick=async()=>{
   send("billing-message","Opening Stripe test checkout...");
   try{const {url}=await server("billing",{action:"checkout",plan:b.dataset.subscribe});
     // Deliberate full-page redirect to Stripe-hosted test payment page.
     if(url&&new URL(url).hostname.endsWith(".stripe.com"))location.assign(url);
     else send("billing-message","Unexpected checkout address.");
   }catch(e){send("billing-message",e.message)}
 });
 $("manage-billing").onclick=async()=>{
   try{const {url}=await server("billing",{action:"portal"});if(url&&new URL(url).hostname.endsWith(".stripe.com"))location.assign(url);}
   catch(e){send("billing-message",e.message)}
 };
 async function loadOwner(){
   $("owner-members").replaceChildren();
   try{
     const data=await server("admin");
     send("owner-message","Authorized owner. Showing up to 100 account profiles.");
     for(const m of data.members){
       const node=document.createElement("div");node.className="entry";
       const label=document.createElement("div");const h=document.createElement("div");h.className="entry-name";h.textContent=m.display_name||"User";
       const sub=document.createElement("div");sub.className="entry-url";sub.textContent=m.user_id+" · "+m.role+" · "+m.plan;label.append(h,sub);
       const actions=document.createElement("div");actions.className="entry-actions";
       for(const r of ["member","moderator"]){
         const button=document.createElement("button");button.textContent="Make "+r;button.disabled=m.role==="owner";
         button.onclick=async()=>{try{await server("admin",{user_id:m.user_id,role:r});await loadOwner()}catch(e){send("owner-message",e.message)}};
         actions.append(button);
       }
       node.append(label,actions);$("owner-members").append(node);
     }
   }catch(e){send("owner-message",e.message)}
 }
 $("load-owner").onclick=loadOwner;
 if(supa){supa.auth.onAuthStateChange(()=>{setTimeout(refreshAccount,0)});refreshAccount()}
 else send("auth-message","Unable to load Supabase. Check network access to the authentication service.");
 fillSettings();newTab();
 if(new URLSearchParams(location.search).get("billing")==="success"){showPanel("plans");send("billing-message","Test checkout returned. Subscription access updates only after a verified Stripe webhook.");}
})();
