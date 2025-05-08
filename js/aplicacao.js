// ===== CONEXÃO AO FIREBASE =====
const db = firebase.database();

// ===== ADICIONAR APLICAÇÃO =====
function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value,
    dosagem: document.getElementById("dosagemApp").value,
    tipo: document.getElementById("tipoApp").value,
    setor: document.getElementById("setorApp").value
  };

  if (!nova.data || !nova.produto || !nova.dosagem) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  db.ref('Aplicacoes').push(nova)
    .then(() => {
      console.log("Aplicação salva com sucesso.");
      carregarAplicacoes();
      limparCamposAplicacao();
    })
    .catch((error) => {
      console.error("Erro ao salvar aplicação:", error);
    });
}

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', (snapshot) => {
    const lista = document.getElementById("listaAplicacoes");
    lista.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
      const app = childSnapshot.val();
      const item = document.createElement("div");
      item.classList.add("item");
      item.innerHTML = `
        <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
        <button onclick="excluirAplicacao('${childSnapshot.key}')"><i class="fas fa-trash"></i></button>
      `;
      lista.appendChild(item);
    });
  });
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(id) {
  db.ref('Aplicacoes/' + id).remove();
}

// ===== LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("tipoApp").value = 'Adubo';
  document.getElementById("setorApp").value = 'Setor 01';
}
