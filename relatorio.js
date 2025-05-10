// ====== GERAR RELATÓRIO ======
function gerarRelatorio() {
  const conteudoRelatorio = document.getElementById("conteudoRelatorio");
  conteudoRelatorio.innerHTML = "";

  db.ref('/').once('value').then(snapshot => {
    const dados = snapshot.val() || {};
    Object.keys(dados).forEach(menu => {
      const secao = document.createElement('h3');
      secao.textContent = menu;
      conteudoRelatorio.appendChild(secao);

      const lista = document.createElement('ul');
      (dados[menu] || []).forEach(item => {
        const li = document.createElement('li');
        li.textContent = JSON.stringify(item);
        lista.appendChild(li);
      });
      conteudoRelatorio.appendChild(lista);
    });
  });
}
