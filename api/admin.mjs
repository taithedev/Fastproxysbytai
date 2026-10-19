
import {json,getUser,requireOwner,db,sameSite} from './_lib.mjs';
export default async function handler(request){
  try{
    const user=await getUser(request);
    if(!user)return json({error:'Sign in required'},401);
    if(!await requireOwner(user))return json({error:'Owner access required'},403);
    if(request.method==='GET'){
      const members=await db('fastproxy_profiles?select=user_id,display_name,created_at&order=created_at.desc&limit=100');
      const roles=await db('fastproxy_roles?select=user_id,role');
      const plans=await db('fastproxy_subscriptions?select=user_id,plan,status');
      return json({members:members.map(m=>({...m,role:roles.find(r=>r.user_id===m.user_id)?.role||'member',plan:plans.find(p=>p.user_id===m.user_id)?.plan||'free'}))});
    }
    if(request.method==='POST'){
      if(!sameSite(request))return json({error:'Invalid origin'},403);
      const data=await request.json();
      if(!['member','moderator'].includes(data.role)|| !/^[a-f0-9-]{36}$/i.test(data.user_id||''))return json({error:'Invalid role or user'},400);
      if(data.user_id===user.id)return json({error:'Cannot change your own role here'},400);
      await db('fastproxy_roles?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:data.user_id,role:data.role})});
      return json({ok:true});
    }
    return json({error:'Method not allowed'},405);
  }catch(e){return json({error:'Owner service unavailable'},503);}
}
