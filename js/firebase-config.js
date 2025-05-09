<!-- Firebase (Compatível com versões sem módulos) -->
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>

<script>
  // Configurações do Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyD773S1h91tovlKTPbaeAZbN2o1yxROcOc",
    authDomain: "manej-cafe.firebaseapp.com",
    databaseURL: "https://manej-cafe-default-rtdb.firebaseio.com",
    projectId: "manej-cafe",
    storageBucket: "manej-cafe.appspot.com", // Corrigido o storageBucket
    messagingSenderId: "808931200634",
    appId: "1:808931200634:web:71357af2ff0dc2e4f5f5c3"
  };

  // Inicializa o Firebase
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const db = firebase.database();
  console.log("Firebase inicializado corretamente.");
</script>

