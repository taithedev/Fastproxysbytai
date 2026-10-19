
import {createHmac,timingSafeEqual} from 'node:crypto';
import {json,db} from './_lib.mjs';
export function validStripeSignature(payload,header,secret,now=Math.floor(Date.now()/1000)){
  if(!secret||!header)return false;
  const parts=Object.fromEntries(header.split(',').map(x=>x.trim().split('=')));
  const stamp=Number(parts.t);
  if(!Number.isSafeInteger(stamp)||Math.abs(now-stamp)>300)return false;
  const expected=createHmac('sha256',secret).update(stamp+'.'+payload).digest('hex');
  const a=Buffer.from(expected,'hex');
  return header.split(',').some(p=>{
    const value=p.trim().startsWith('v1=')?p.trim().slice(3):'';
    if(!/^[0-9a-f]{64}$/.test(value))return false;
    const b=Buffer.from(value,'hex');
    return a.length===b.length&&timingSafeEqual(a,b);
  });
}
export default async function handler(request){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret)return json({error:'Webhook is not configured'},503);
  const raw=await request.text();
  if(raw.length>1024*1024)return json({error:'Payload too large'},413);
  if(!validStripeSignature(raw,request.headers.get('stripe-signature'),secret))return json({error:'Invalid signature'},400);
  try{
    const event=JSON.parse(raw);
    if(!['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type))return json({received:true});
    const sub=event.data?.object||{};
    const user_id=sub.metadata?.user_id;
    if(!/^[a-f0-9-]{36}$/i.test(user_id||''))return json({received:true});
    const price=sub.items?.data?.[0]?.price?.id||'';
    const plan=price===process.env.STRIPE_PRICE_PRO?'pro':price===process.env.STRIPE_PRICE_PLUS?'plus':'free';
    const statuses=['active','trialing','past_due','canceled','unpaid'];
    const status=event.type==='customer.subscription.deleted'?'canceled':statuses.includes(sub.status)?sub.status:'inactive';
    await db('fastproxy_subscriptions?on_conflict=user_id',{
      method:'POST',headers:{Prefer:'resolution=merge-duplicates'},
      body:JSON.stringify({
        user_id,plan:status==='active'||status==='trialing'?plan:'free',
        status,stripe_customer_id:typeof sub.customer==='string'?sub.customer:null,
        stripe_subscription_id:sub.id,
        current_period_end:Number.isFinite(sub.current_period_end)?new Date(sub.current_period_end*1000).toISOString():null,
        updated_at:new Date().toISOString()
      })
    });
    return json({received:true});
  }catch(e){return json({error:'Webhook processing failed'},500);}
}
