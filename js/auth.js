// auth.js
import { auth } from './firebase-config.js';

// Elementos do DOM
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const logoutButton = document.getElementById('logoutButton');
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');

// Verificar estado de autenticação
auth.onAuthStateChanged(user => {
  if (user) {
    // Usuário logado
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
    console.log('Usuário logado:', user.email);
  } else {
    // Usuário não logado
    authContainer.style.display = 'block';
    appContainer.style.display = 'none';
  }
});

// Login
function login(email, password) {
  return auth.signInWithEmailAndPassword(email, password)
    .catch(error => {
      console.error('Erro de login:', error);
      alert('Erro ao fazer login: ' + error.message);
    });
}

// Logout
function logout() {
  auth.signOut()
    .then(() => console.log('Usuário deslogado'))
    .catch(error => console.error('Erro ao deslogar:', error));
}

// Event listeners
if (loginForm) {
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    login(emailInput.value, passwordInput.value);
  });
}

if (logoutButton) {
  logoutButton.addEventListener('click', logout);
}

// Exportar funções
export { login, logout };

function recuperarSenha() {
  const email = prompt("Digite seu e-mail para recuperação:");
  if (email) {
    auth.sendPasswordResetEmail(email)
      .then(() => alert("E-mail de recuperação enviado!"))
      .catch(error => alert("Erro: " + error.message));
  }
}

// Código de recuperação temporário (insira no console do navegador)
function resetAccess() {
  const email = "admin@temp.com"; // substitua pelo email admin
  const newPassword = "senhatemporaria"; // defina uma nova senha
  
  firebase.auth().sendPasswordResetEmail(email)
    .then(() => console.log("E-mail de redefinição enviado!"))
    .catch(error => console.error("Erro:", error));
}
resetAccess();
