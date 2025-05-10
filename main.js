// ====== APLICAR PADRÃO DE BOTÕES COLORIDOS ======
document.addEventListener("DOMContentLoaded", () => {
  padronizarBotoes();
});

// ====== FUNÇÃO PADRONIZAR BOTÕES ======
function padronizarBotoes() {
  const botoesMarcar = document.querySelectorAll(".botao-circular.verde");
  const botoesEditar = document.querySelectorAll(".botao-circular.azul");
  const botoesExcluir = document.querySelectorAll(".botao-circular.vermelho");
  const botoesDesfazer = document.querySelectorAll(".botao-circular.laranja");

  botoesMarcar.forEach(botao => {
    botao.innerHTML = '<i class="fas fa-check"></i>';
    botao.title = "Marcar como Feita";
  });

  botoesEditar.forEach(botao => {
    botao.innerHTML = '<i class="fas fa-edit"></i>';
    botao.title = "Editar";
  });

  botoesExcluir.forEach(botao => {
    botao.innerHTML = '<i class="fas fa-trash-alt"></i>';
    botao.title = "Excluir";
  });

  botoesDesfazer.forEach(botao => {
    botao.innerHTML = '<i class="fas fa-undo-alt"></i>';
    botao.title = "Desfazer";
  });
}

// ====== EXEMPLO DE COMO ADICIONAR OS BOTÕES EM QUALQUER MENU ======
function criarBotaoAcao(tipo, acao) {
  const botao = document.createElement("button");
  botao.classList.add("botao-circular", tipo);
  botao.onclick = acao;
  
  // O conteúdo e a cor são automaticamente aplicados com a classe
  padronizarBotoes(); // Garante que o ícone e a cor sejam aplicados
  return botao;
}

// ====== EXEMPLO DE USO NOS MENUS ======
function exemploAdicionarBotoes() {
  const exemploContainer = document.getElementById("exemploContainer");
  
  const botaoMarcar = criarBotaoAcao("verde", () => alert("Tarefa marcada como feita."));
  const botaoEditar = criarBotaoAcao("azul", () => alert("Editando..."));
  const botaoExcluir = criarBotaoAcao("vermelho", () => alert("Excluindo..."));
  const botaoDesfazer = criarBotaoAcao("laranja", () => alert("Desfazendo..."));

  exemploContainer.appendChild(botaoMarcar);
  exemploContainer.appendChild(botaoEditar);
  exemploContainer.appendChild(botaoExcluir);
  exemploContainer.appendChild(botaoDesfazer);
}
