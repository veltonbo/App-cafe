import fs from 'node:fs';
import path from 'node:path';
const FILE=path.resolve(process.env.F2E_RBAC_FILE||'data/access-control.json');
const ROLE_PERMISSIONS={viewer:['read','history'],operator:['read','history','command','emergency'],manager:['read','history','command','emergency','configure'],master:['read','history','command','emergency','configure','admin']};
const LEGACY_PERMISSION={operate:'command'};
const PRIMARY_MASTER_EMAIL=String(process.env.FAZENDA2E_MASTER_EMAIL||'eliveltonoliveiranbo@gmail.com').trim().toLowerCase();
function normEmail(v){return String(v||'').trim().toLowerCase()}
function load(){try{return JSON.parse(fs.readFileSync(FILE,'utf8'))||{users:{}}}catch{return{users:{}}}}
function masters(){return new Set(String(process.env.F2E_MASTER_EMAILS||'').split(',').map(normEmail).filter(Boolean))}
export function resolveAccess(principal={}){if(principal.system===true)return{role:'master',permissions:ROLE_PERMISSIONS.master,active:true,source:'system'};const email=normEmail(principal.email),uid=String(principal.uid||'');if(email&&(email===PRIMARY_MASTER_EMAIL||masters().has(email)))return{role:'master',permissions:ROLE_PERMISSIONS.master,active:true,source:'bootstrap'};const db=load(),row=db.users?.[uid]||db.users?.[email]||null;if(!row)return{role:'viewer',permissions:ROLE_PERMISSIONS.viewer,active:true,source:'default'};const role=ROLE_PERMISSIONS[row.role]?row.role:'viewer';return{role,permissions:ROLE_PERMISSIONS[role],active:row.active!==false,source:'managed'}}
export function hasPermission(principal,permission){const a=resolveAccess(principal);const p=LEGACY_PERMISSION[permission]||permission;return a.active&&a.permissions.includes(p)}
export function listAccess(){return load()}
export function saveAccess(next){fs.mkdirSync(path.dirname(FILE),{recursive:true});const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(next,null,2));fs.renameSync(tmp,FILE);return next}
export function rolePermissions(){return ROLE_PERMISSIONS}

export function requirePermission(req,res,permission){
  const principal=req?.authPrincipal||null;
  if(!principal){res.status(401).json({ok:false,error:'Não autorizado.'});return false}
  const access=resolveAccess(principal);
  if(!access.active){res.status(403).json({ok:false,error:'Usuário desativado.',code:'USER_DISABLED'});return false}
  const wanted=LEGACY_PERMISSION[permission]||permission;
  if(!access.permissions.includes(wanted)){res.status(403).json({ok:false,error:'Sem permissão para esta ação.',code:'FORBIDDEN',required:wanted,role:access.role});return false}
  req.access=access;return true
}
