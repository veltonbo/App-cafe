import crypto from 'node:crypto';

const ISSUER='https://token.actions.githubusercontent.com';
const JWKS_URL='https://token.actions.githubusercontent.com/.well-known/jwks';
const AUDIENCE='fazenda2e-irrigation';
const REPOSITORY='veltonbo/App-cafe';
const REPOSITORY_ID='971707002';
const WORKFLOW_REF='veltonbo/App-cafe/.github/workflows/viveiro-weather.yml@refs/heads/main';

function decodePart(part){
  const pad='='.repeat((4-part.length%4)%4);
  return Buffer.from(part.replace(/-/g,'+').replace(/_/g,'/')+pad,'base64');
}
function audienceMatches(aud){
  return Array.isArray(aud)?aud.includes(AUDIENCE):aud===AUDIENCE;
}

export async function verifyGitHubOidc(req){
  try{
    const auth=String(req.headers.authorization||'');
    if(!auth.toLowerCase().startsWith('bearer '))return false;
    const token=auth.slice(7).trim();
    const parts=token.split('.');
    if(parts.length!==3)return false;

    const header=JSON.parse(decodePart(parts[0]).toString('utf8'));
    const claims=JSON.parse(decodePart(parts[1]).toString('utf8'));
    if(header.alg!=='RS256'||!header.kid)return false;

    const now=Math.floor(Date.now()/1000);
    if(claims.iss!==ISSUER)return false;
    if(!audienceMatches(claims.aud))return false;
    if(Number(claims.exp||0)<=now)return false;
    if(Number(claims.nbf||0)>now+30)return false;
    if(Number(claims.iat||0)>now+30)return false;
    if(String(claims.repository||'')!==REPOSITORY)return false;
    if(String(claims.repository_id||'')!==REPOSITORY_ID)return false;
    if(String(claims.ref||'')!=='refs/heads/main')return false;
    if(!['schedule','workflow_dispatch'].includes(String(claims.event_name||'')))return false;
    if(String(claims.workflow_ref||'')!==WORKFLOW_REF)return false;

    const r=await fetch(JWKS_URL,{headers:{'User-Agent':'fazenda2e-irrigation'}});
    if(!r.ok)return false;
    const jwks=await r.json();
    const jwk=(jwks.keys||[]).find(k=>k.kid===header.kid);
    if(!jwk)return false;

    const key=crypto.createPublicKey({key:jwk,format:'jwk'});
    const data=Buffer.from(parts[0]+'.'+parts[1]);
    const sig=decodePart(parts[2]);
    return crypto.verify('RSA-SHA256',data,key,sig);
  }catch{
    return false;
  }
}
