// ===== VARIÁVEIS GLOBAIS =====
let tarefas = [];
let indiceEdicaoTarefa = null;

// ===== CARREGAR TAREFAS =====
function carregarTarefas() {
  db.ref("Tarefas").on("value", (snap) => {
    tarefas = snap.exists() ? snap.val() : [];
    atualizarTarefas();
  });
}

// ===== ADICIONAR OU EDITAR TAREFA =====
function adicionarTarefa() {
  const data = document.getElementById("dataTarefa").value;
  const descricao = document.getElementById("descricaoTarefa").value.trim();
  const prioridade = document.getElementById("prioridadeTarefa").value;
  const setor = document.getElementById("setorTarefa").value;
  const eAplicacao = document.getElementById("eAplicacaoCheckbox").checked;
  const dosagem = document.getElementById("dosagemAplicacao").value.trim();
  const tipo = document.getElementById("tipoAplicacao").value;

  if (!data || !descricao) {
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  const novaTarefa = {
    data,
    descricao,
    prioridade,
    setor,
    eAplicacao,
    dosagem: eAplicacao ? dosagem : null,
    tipo: eAplicacao ? tipo : null,
    concluida: false
  };

  if (indiceEdicaoTarefa !== null) {
    tarefas[indiceEdicaoTarefa] = novaTarefa;
    indiceEdicaoTarefa = null;
  } else {
    tarefas.push(novaTarefa);
  }

  db.ref("Tarefas").set(tarefas);
  atualizarTarefas();
  limparCamposTarefa();
}

// ===== LIMPAR CAMPOS =====
function limparCamposTarefa() {
  document.getElementById("dataTarefa").value = "";
  document.getElementById("descricaoTarefa").value = "";
  document.getElementById("prioridadeTarefa").value = "Alta";
  document.getElementById("setorTarefa").value = "Setor 01";
  document.getElementById("eAplicacaoCheckbox").checked = false;
  document.getElementById("camposAplicacao").style.display = "none";
}

// ===== ATUALIZAR LISTAGEM DE TAREFAS =====
function atualizarTarefas() {
  const tarefasAFazer = document.getElementById("tarefasAFazer");
  const tarefasExecutadas = document.getElementById("tarefasExecutadas");
  tarefasAFazer.innerHTML = "";
  tarefasExecutadas.innerHTML = "";

  tarefas.forEach((tarefa, index) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="tarefa-conteudo">
        ${tarefa.data} - ${tarefa.descricao} (${tarefa.prioridade}) - ${tarefa.setor}
        ${tarefa.eAplicacao ? `- ${tarefa.tipo} (${tarefa.dosagem} L/ha)` : ""}
      </div>
      <div class="botoes-tarefa">
        ${tarefa.concluida ? `
          <button class="botao-circular laranja" onclick="desfazerTarefa(${index})">
            <i class="fas fa-undo"></i>
          </button>
        ` : `
          <button class="botao-circular verde" onclick="concluirTarefa(${index})">
            <i class="fas fa-check"></i>
          </button>
          <button class="botao-circular azul" onclick="editarTarefa(${index})">
            <i class="fas fa-edit"></i>
          </button>
        `}
        <button class="botao-circular vermelho" onclick="excluirTarefa(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    if (tarefa.concluida) {
      tarefasExecutadas.appendChild(item);
    } else {
      tarefasAFazer.appendChild(item);
    }
  });
}

// ===== CONCLUIR TAREFA =====
function concluirTarefa(index) {
  tarefas[index].concluida = true;
  db.ref("Tarefas").set(tarefas);
  atualizarTarefas();
}

// ===== DESFAZER TAREFA =====
function desfazerTarefa(index) {
  tarefas[index].concluida = false;
  db.ref("Tarefas").set(tarefas);
  atualizarTarefas();
}

// ===== EDITAR TAREFA =====
function editarTarefa(index) {
  const tarefa = tarefas[index];
  if (!tarefa) return;

  document.getElementById("dataTarefa").value = tarefa.data;
  document.getElementById("descricaoTarefa").value = tarefa.descricao;
  document.getElementById("prioridadeTarefa").value = tarefa.prioridade;
  document.getElementById("setorTarefa").value = tarefa.setor;
  document.getElementById("eAplicacaoCheckbox").checked = tarefa.eAplicacao;
  document.getElementById("camposAplicacao").style.display = tarefa.eAplicacao ? "block" : "none";
  document.getElementById("dosagemAplicacao").value = tarefa.dosagem || "";
  document.getElementById("tipoAplicacao").value = tarefa.tipo || "";

  indiceEdicaoTarefa = index;
}

// ===== EXCLUIR TAREFA =====
function excluirTarefa(index) {
  if (confirm("Deseja excluir esta tarefa?")) {
    tarefas.splice(index, 1);
    db.ref("Tarefas").set(tarefas);
    atualizarTarefas();
  }
}

// ===== MOSTRAR CAMPOS DE APLICAÇÃO =====
function mostrarCamposAplicacao() {
  const camposAplicacao = document.getElementById("camposAplicacao");
  camposAplicacao.style.display = document.getElementById("eAplicacaoCheckbox").checked ? "block" : "none";
}

// ===== MOSTRAR FORMULÁRIO TAREFA (FLUTUANTE) =====
function mostrarFormularioTarefa() {
  document.querySelector(".formulario").scrollIntoView({ behavior: "smooth" });
}
