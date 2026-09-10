(()=>{
'use strict';
const FIREBASE_API_KEY='AIzaSyD773S1h91tovlKTPbaeAZbN2o1yxROcOc';
const STORE_KEY='viveiroEkazaRealV1';
const $=id=>document.getElementById(id);

function saveSessionToken(token){
  let store={};
  try{store=JSON.parse(localStorage.getItem(STORE_KEY)||'null')||{}}catch{store={}}
  if(!store.settings)store.settings={};
  store.settings.apiUrl=location.origin;
  store.settings.token=String(token||'');
  localStorage.setItem(STORE_KEY,JSON.stringify(store));
}

function firebaseErrorMessage(code){
  const value=String(code||'');
  if(value.includes('INVALID_LOGIN_CREDENTIALS')||value.includes('INVALID_PASSWORD')||value.includes('EMAIL_NOT_FOUND'))return'E-mail ou senha incorretos.';
  if(value.includes('TOO_MANY_ATTEMPTS'))return'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if(value.includes('USER_DISABLED'))return'Este usuário está desativado.';
  if(value.includes('INVALID_EMAIL'))return'Informe um e-mail válido.';
  return'Não foi possível entrar. Confira seus dados e tente novamente.';
}

async function signIn(email,password){
  const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(FIREBASE_API_KEY),{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email,password,returnSecureToken:true})
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok||!body.idToken)throw new Error(firebaseErrorMessage(body?.error?.message));
  return body;
}

async function exchangeToken(idToken){
  const response=await fetch(location.origin+'/api/session',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({idToken})
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok||!body.token)throw new Error(body?.error||body?.detail||'Falha ao criar sessão do aplicativo.');
  return body;
}

function mountLogin(){
  const overlay=$('setupOverlay');
  const card=overlay?.querySelector('.setupCard');
  if(!overlay||!card)return;

  card.innerHTML=`
    <small>FAZENDA 2E</small>
    <h2>Entrar no Viveiro</h2>
    <p>Use o mesmo login cadastrado no Firebase.</p>
    <label><span>E-mail</span><input id="firebaseEmail" type="email" inputmode="email" autocomplete="username" placeholder="seu@email.com"></label>
    <label><span>Senha</span><input id="firebasePassword" type="password" autocomplete="current-password" placeholder="Sua senha"></label>
    <button id="firebaseLoginBtn" class="primaryBtn full" type="button">Entrar</button>
    <p id="firebaseLoginStatus" class="panelNote" style="margin-top:12px"></p>
  `;

  const email=$('firebaseEmail');
  const password=$('firebasePassword');
  const button=$('firebaseLoginBtn');
  const status=$('firebaseLoginStatus');

  async function submit(){
    const e=String(email.value||'').trim();
    const p=String(password.value||'');
    if(!e||!p){status.textContent='Informe e-mail e senha.';return}
    button.disabled=true;
    status.textContent='Entrando...';
    try{
      const firebase=await signIn(e,p);
      const session=await exchangeToken(firebase.idToken);
      saveSessionToken(session.token);
      status.textContent='Login confirmado. Abrindo o Viveiro...';
      location.reload();
    }catch(error){
      status.textContent=error?.message||'Falha no login.';
      button.disabled=false;
    }
  }

  button.addEventListener('click',submit);
  password.addEventListener('keydown',event=>{if(event.key==='Enter')submit()});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountLogin,{once:true});
else mountLogin();
})();
