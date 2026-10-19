
import {json,getUser,db,sameSite,stripe} from './_lib.mjs';
export default async function handler(request){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!sameSite(request))return json({error:'Invalid origin'},403);
  try{
    const user=await getUser(request);
    if(!user||!user.email)return json({error:'Sign in with an email first'},401);
    const body=await request.json();
    const base=process.env.FASTPROXY_SITE_URL||new URL(request.url).origin;
    if(body.action==='checkout'){
      if(!['plus','pro'].includes(body.plan))return json({error:'Invalid plan'},400);
      const price=body.plan==='plus'?process.env.STRIPE_PRICE_PLUS:process.env.STRIPE_PRICE_PRO;
      if(!price||!/^price_/.test(price))return json({error:'Test subscription prices have not been set up'},503);
      const session=await stripe('checkout/sessions',{
        mode:'subscription',
        'line_items[0][price]':price,'line_items[0][quantity]':'1',
        customer_email:user.email,client_reference_id:user.id,
        'subscription_data[metadata][user_id]':user.id,
        success_url:base+'/?billing=success',
        cancel_url:base+'/?billing=cancel',
        'allow_promotion_codes':'true'
      });
      return json({url:session.url});
    }
    if(body.action==='portal'){
      const existing=await db('fastproxy_subscriptions?user_id=eq.'+encodeURIComponent(user.id)+'&select=stripe_customer_id');
      if(!existing[0]?.stripe_customer_id)return json({error:'No subscription to manage'},404);
      const portal=await stripe('billing_portal/sessions',{customer:existing[0].stripe_customer_id,return_url:base+'/'});
      return json({url:portal.url});
    }
    return json({error:'Unknown action'},400);
  }catch(e){return json({error:e.message?.includes('not configured')?e.message:'Subscription service unavailable'},503);}
}
