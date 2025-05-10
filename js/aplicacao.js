// Firebase Configuração (js/firebase-config.js)
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  databaseURL: "SUA_DATABASE_URL",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database().ref("aplicacoes");

// Funções
function alternarFormularioAplicacao() {
  const formulario = document.getElementById("formularioAplicacao");
  formulario.style.display = formulario.style.display === "none" ? "block" : "none";
}

function carregarAplicacoes() {
  db.on("value", (snapshot) => {
    const lista = document.getElementById("listaAplicacoes");
    lista.innerHTML = "";
    snapshot.forEach((child) => {
      const item = child.val();
      lista.innerHTML += `<div class="item">
        ${item.data} - ${item.produto} (${item.dosagem}) - ${item.tipo} - ${item.setor}
      </div>`;
    });
  });
}

function salvarAplicacao() {
  const data = document.getElementById("dataApp").value;
  const produto = document.getElementById("produtoApp").value;
  const dosagem = document.getElementById("dosagemApp").value;
  const tipo = document.getElementById("tipoApp").value;
  const setor = document.getElementById("setorApp").value;

  db.push().set({ data, produto, dosagem, tipo, setor });
  carregarAplicacoes();
}
