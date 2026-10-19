
export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wfqudstuncdldsvxqveu.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_LsAzcgmeAp3fBCtdU6eQzw_u5PPJjar';
export function json(data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
export async function getUser(request) {
  const match=/^Bearer ([A-Za-z0-9._~-]+)$/.exec(request.headers.get('authorization')||'');
  if(!match) return null;
  const response=await fetch(SUPABASE_URL+'/auth/v1/user',{
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+match[1]},
    signal:AbortSignal.timeout(8000)
  });
  if(!response.ok) return null;
  const user=await response.json();
  return /^[a-f0-9-]{36}$/i.test(user.id||'') ? user : null;
}
export async function db(path, options={}) {
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key) throw new Error('Supabase server key is not configured');
  const response=await fetch(SUPABASE_URL+'/rest/v1/'+path,{
    ...options,headers:{apikey:key,Authorization:'Bearer '+key,
      'Content-Type':'application/json',...(options.headers||{})},
    signal:AbortSignal.timeout(8000)
  });
  if(!response.ok) throw new Error('Database request failed ('+response.status+')');
  const text=await response.text();
  return text ? JSON.parse(text) : null;
}
export async function requireOwner(user) {
  if(!user) return false;
  if(process.env.FASTPROXY_OWNER_USER_ID && user.id===process.env.FASTPROXY_OWNER_USER_ID) return true;
  const rows=await db('fastproxy_roles?user_id=eq.'+encodeURIComponent(user.id)+'&select=role');
  return rows.some(x=>x.role==='owner');
}
export function sameSite(request) {
  const origin=request.headers.get('origin');
  return !origin || origin===new URL(request.url).origin;
}
export async function stripe(path, body) {
  const secret=process.env.STRIPE_SECRET_KEY||'';
  // Prevent inadvertently enabling real payments before a verified adult account is configured.
  if(!secret.startsWith('sk_test_')) throw new Error('Stripe test mode is not configured');
  const result=await fetch('https://api.stripe.com/v1/'+path,{
    method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(body),signal:AbortSignal.timeout(12000)
  });
  const data=await result.json();
  if(!result.ok) throw new Error(data.error?.message||'Stripe request failed');
  return data;
}
