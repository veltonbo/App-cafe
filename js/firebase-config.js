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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

  // Verifica a conexão com o Firebase Realtime Database
  const db = firebase.database();
  db.ref(".info/connected").on("value", (snap) => {
    if (snap.val()) {
      console.log("✅ Conectado ao Firebase");
    } else {
      console.error("❌ Desconectado do Firebase");
    }
  });
});
