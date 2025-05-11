// ===== CONFIGURAÇÃO DO FIREBASE (CERTIFIQUE-SE DE TER CONFIGURADO) =====
const db = firebase.database(); // Usando o Firebase já configurado

// ===== SALVAR APLICAÇÃO NO FIREBASE =====
function salvarAplicacao() {
  const data = document.getElementById("dataApp").value;
  const produto = document.getElementById("produtoApp").value.trim();
  const dosagem = document.getElementById("dosagemApp").value.trim();
  const tipo = document.getElementById("tipoApp").value;
  const setor = document.getElementById("setorApp").value;

  if (!data || !produto || !dosagem) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  const novaAplicacao = {
    data,
    produto,
    dosagem,
    tipo,
    setor
  };

  db.ref('Aplicacoes').push(novaAplicacao);
  document.getElementById("formularioAplicacoes").style.display = "none";
  document.getElementById("formularioAplicacoes").reset();
  atualizarAplicacoes();
}

// ===== CARREGAR APLICAÇÕES DO FIREBASE =====
function atualizarAplicacoes() {
  db.ref('Aplicacoes').on('value', (snapshot) => {
    const lista = document.getElementById("listaAplicacoes");
    lista.innerHTML = '';

    snapshot.forEach((snap) => {
      const app = snap.val();
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <span>${formatarDataBR(app.data)} - ${app.produto} - ${app.dosagem} - ${app.tipo} - ${app.setor}</span>
        <div class="botoes-aplicacao">
          <button class="botao-circular azul" onclick="editarAplicacao('${snap.key}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="botao-circular vermelho" onclick="excluirAplicacao('${snap.key}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      lista.appendChild(item);
    });
  });
}

// ===== EDITAR APLICAÇÃO =====
function editarAplicacao(id) {
  db.ref('Aplicacoes/' + id).once('value').then(snapshot => {
    const app = snapshot.val();
    document.getElementById("dataApp").value = app.data;
    document.getElementById("produtoApp").value = app.produto;
    document.getElementById("dosagemApp").value = app.dosagem;
    document.getElementById("tipoApp").value = app.tipo;
    document.getElementById("setorApp").value = app.setor;
    
    db.ref('Aplicacoes/' + id).remove();
    document.getElementById("formularioAplicacoes").style.display = "block";
  });
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(id) {
  if (confirm("Deseja excluir esta aplicação?")) {
    db.ref('Aplicacoes/' + id).remove();
    atualizarAplicacoes();
  }
}
