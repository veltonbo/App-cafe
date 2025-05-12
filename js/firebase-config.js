// ===== Firebase Config =====
const firebaseConfig = {
  apiKey: "AIzaSyD773S1h91tovlKTPbaeAZbN2o1yxROcOc",
  authDomain: "manej-cafe.firebaseapp.com",
  databaseURL: "https://manej-cafe-default-rtdb.firebaseio.com",
  projectId: "manej-cafe",
  storageBucket: "manej-cafe.appspot.com",
  messagingSenderId: "808931200634",
  appId: "1:808931200634:web:71357af2ff0dc2e4f5f5c3"
};

// Inicializa o Firebase (apenas se ainda não estiver inicializado)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();

// Exportar para uso em outros arquivos
export { db, auth };

// Código temporário para criar primeiro usuário (executar apenas uma vez)
auth.createUserWithEmailAndPassword('eliveltonoliveiranbo@gmail.com', 'Se@100217')
  .then(() => {
    console.log('Usuário admin criado com sucesso');
    // Remova este código após usar!
  })
  .catch(error => {
    console.error('Erro ao criar usuário:', error);
  });
