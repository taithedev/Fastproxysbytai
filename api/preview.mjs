
import {json} from './_lib.mjs';
export const ALLOWED_HOSTS=new Set(['en.wikipedia.org','www.wikipedia.org','developer.mozilla.org','example.com','www.example.com','docs.python.org','www.w3.org']);
export function allowedUrl(raw){
  try {
    if(!raw||raw.length>2048)return null;
    const u=new URL(raw);
    if(u.protocol!=='https:'||!ALLOWED_HOSTS.has(u.hostname.toLowerCase())||u.port||u.username||u.password)return null;
    return u;
  }catch{return null;}
}
export function escapeHtml(text){
  return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
export function cleanText(input){
  const raw=String(input).replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<(script|style|noscript|svg|iframe|template|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'')
    .replace(/<\/(?:p|div|h[1-6]|li|tr|section|article|main)>/gi,'\n\n')
    .replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,' ');
  return raw.replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff)))
    .replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(Math.min(parseInt(n,16),0x10ffff)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[n.toLowerCase()]))
    .replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,180000);
}
export function findLinks(html,base){
  const links=[],seen=new Set();
  for(const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    let resolved;
    try{resolved=new URL(m[1].replace(/&amp;/g,'&'),base)}catch{continue;}
    if(!allowedUrl(resolved.href)||seen.has(resolved.href))continue;
    const label=cleanText(m[2]).slice(0,90);
    if(!label)continue;
    links.push({label,url:resolved.href});seen.add(resolved.href);
    if(links.length>=45)break;
  }
  return links;
}
export default async function handler(request){
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  let target=allowedUrl(new URL(request.url).searchParams.get('url'));
  if(!target)return json({error:'This read-only preview supports selected public documentation sites only.'},400);
  try{
    let response;
    for(let i=0;i<4;i++){
      response=await fetch(target.href,{redirect:'manual',signal:AbortSignal.timeout(7000),headers:{Accept:'text/html','User-Agent':'FastProxyReader/1.0 (+read-only preview)'}});
      if([301,302,303,307,308].includes(response.status)){
        const next=allowedUrl(new URL(response.headers.get('location')||'',target).href);
        if(!next)return json({error:'Preview redirects outside supported sites'},422);
        target=next;continue;
      }
      break;
    }
    if(!response||!response.ok)return json({error:'This site could not be previewed'},502);
    if(!(response.headers.get('content-type')||'').toLowerCase().includes('text/html'))return json({error:'Only HTML pages are supported'},415);
    if(Number(response.headers.get('content-length')||0)>1200000)return json({error:'Page too large'},413);
    const reader=response.body?.getReader();
    let bytes=0,chunks=[];
    if(!reader)return json({error:'Empty response'},502);
    while(true){
      const {done,value}=await reader.read();if(done)break;
      bytes+=value.length;if(bytes>1200000){await reader.cancel();return json({error:'Page too large'},413);}
      chunks.push(value);
    }
    const html=new TextDecoder().decode(Buffer.concat(chunks.map(x=>Buffer.from(x))));
    const title=cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||target.hostname).slice(0,130);
    const content=cleanText(html.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi,''));
    const links=findLinks(html,target);
    const styles='body{font:16px/1.7 system-ui;background:#fafafa;color:#171717;max-width:900px;padding:30px;margin:auto}header{border-bottom:1px solid #ccc;padding-bottom:15px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}a{color:#194aa8}li{margin:8px 0}.note{color:#666;font-size:13px}';
    const items=links.map(l=>'<li><a href="/api/preview?url='+encodeURIComponent(l.url)+'">'+escapeHtml(l.label)+'</a></li>').join('');
    const out='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+escapeHtml(title)+'</title><style>'+styles+'</style><header><strong>'+escapeHtml(title)+'</strong><div class="note">'+escapeHtml(target.href)+'</div><p class="note">Text-only preview: scripts, logins, forms and third-party media are disabled.</p></header><main><pre>'+escapeHtml(content)+'</pre><h2>Links on this site</h2><ul>'+items+'</ul></main>';
    return new Response(out,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox allow-same-origin"}});
  }catch(e){return json({error:'Preview unavailable; try the direct view or another supported page.'},502);}
}
