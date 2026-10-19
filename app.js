"use strict";
(()=>{
 const data=window.FASTPROXYS_DATA;if(!data)return;
 const $=id=>document.getElementById(id);
 const safeUrl=raw=>{try{const u=new URL(raw);return ["https:","http:"].includes(u.protocol)?u.href:null}catch{return null}};
 function card(name,url,icon,detail){const href=safeUrl(url);if(!href)return null;const a=document.createElement("a");a.href=href;a.target="_blank";a.rel="noopener noreferrer";a.className="card";const badge=document.createElement("span");badge.className="symbol";badge.textContent=icon;const h=document.createElement("h3");h.textContent=name;const p=document.createElement("p");p.textContent=detail;const b=document.createElement("span");b.className="bottom";b.textContent="Open website ↗";a.append(badge,h,p,b);return a}
 data.providers.forEach(v=>{const el=card(...v);if(el)$("providers")?.appendChild(el)});
 data.shortcuts.forEach(([name,url])=>{const href=safeUrl(url);if(!href)return;const a=document.createElement("a");a.href=href;a.target="_blank";a.rel="noopener noreferrer";a.className="shortcut";a.textContent=name+" ↗";$("shortcuts")?.appendChild(a)});
 document.querySelectorAll("[data-plan]").forEach(btn=>btn.addEventListener("click",()=>{const tier=btn.dataset.plan;$("plan-status").textContent=tier==="Free"?"Free navigation is available now.":tier+" is a preview. Subscriptions and perks are not yet enabled."}));
 $("owner-login")?.addEventListener("click",()=>{$("owner-status").textContent="Owner sign-in requires a secure backend and verified account. It is not available yet."});
 if($("year"))$("year").textContent=String(new Date().getFullYear());
 $("search")?.addEventListener("submit",e=>{e.preventDefault();const q=$("query").value.trim();if(!q)return;const urlPattern=/^(https?:\/\/)?(?:localhost(?::\d+)?|(?:[\w-]+\.)+[a-z]{2,})(?:[\/:?#].*)?$/i;let destination="https://www.google.com/search?q="+encodeURIComponent(q);if(urlPattern.test(q)&&!(/\s/.test(q))){const candidate=safeUrl(/^https?:\/\//i.test(q)?q:"https://"+q);if(candidate)destination=candidate}const a=document.createElement("a");a.href=destination;a.target="_blank";a.rel="noopener noreferrer";document.body.appendChild(a);a.click();a.remove()});
})();
