// Inicializar Firebase
document.addEventListener("DOMContentLoaded", () => {
  const db = firebase.database().ref("aplicacoes");
  carregarAplicacoes();

  document.getElementById("btnSalvarAplicacao").onclick = salvarAplicacao;
  document.getElementById("btnCancelarEdicaoApp").onclick = cancelarEdicaoAplicacao;
});

function salvarAplicacao() {
  const data = document.getElementById("dataApp").value;
  const produto = document.getElementById("produtoApp").value;
  const dosagem = document.getElementById("dosagemApp").value;
  const tipo = document.getElementById("tipoApp").value;
  const setor = document.getElementById("setorApp").value;

  if (!data || !produto || !dosagem) {
    alert("Preencha todos os campos.");
    return;
  }

  const db = firebase.database().ref("aplicacoes");
  db.push().set({ data, produto, dosagem, tipo, setor });

  carregarAplicacoes();
  cancelarEdicaoAplicacao();
}

function cancelarEdicaoAplicacao() {
  document.getElementById("formularioAplicacao").reset();
  document.getElementById("btnCancelarEdicaoApp").style.display = "none";
}

function carregarAplicacoes() {
  const db = firebase.database().ref("aplicacoes");
  db.on("value", (snapshot) => {
    const lista = document.getElementById("listaAplicacoes");
    lista.innerHTML = "";
    snapshot.forEach((child) => {
      lista.innerHTML += `<div class="item">${child.val().data} - ${child.val().produto}</div>`;
    });
  });
}
