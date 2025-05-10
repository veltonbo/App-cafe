// main.js
document.addEventListener('DOMContentLoaded', inicializarApp);

// Inicializar o Aplicativo
function inicializarApp() {
  console.log("Inicializando o aplicativo...");
  
  // Verifica se o Firebase está conectado
  if (typeof db === 'undefined') {
    console.error("Erro: Firebase não carregado corretamente.");
    alert("Erro ao conectar ao Firebase.");
    return;
  }

  // Carregar Aplicações
  if (typeof carregarAplicacoes === 'function') {
    carregarAplicacoes();
  } else {
    console.warn("Função carregarAplicacoes não encontrada.");
  }

  // Carregar outras funções se necessário
  console.log("Aplicativo inicializado com sucesso.");
}
