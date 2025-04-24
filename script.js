
function mostrarPagina(id) {
    document.querySelectorAll('.pagina').forEach(secao => secao.style.display = 'none');
    document.getElementById(id).style.display = 'block';
}

function adicionarAplicacao() {
    const data = document.getElementById('dataAplicacao').value;
    const produto = document.getElementById('produtoAplicacao').value;
    const dosagem = document.getElementById('dosagemAplicacao').value;
    const tipo = document.getElementById('tipoAplicacao').value;
    if (data && produto && dosagem && tipo) {
        const lista = document.getElementById('listaAplicacoes');
        const li = document.createElement('li');
        li.textContent = `${data} - ${produto} - ${dosagem} - ${tipo}`;
        lista.appendChild(li);
    }
}

function adicionarTarefa() {
    const data = document.getElementById('dataTarefa').value;
    const descricao = document.getElementById('descricaoTarefa').value;
    if (data && descricao) {
        const lista = document.getElementById('listaTarefas');
        const li = document.createElement('li');
        li.textContent = `${data} - ${descricao}`;
        lista.appendChild(li);
    }
}

function adicionarFinanceiro() {
    const data = document.getElementById('dataFinanceiro').value;
    const produto = document.getElementById('produtoFinanceiro').value;
    const valor = document.getElementById('valorFinanceiro').value;
    const categoria = document.getElementById('categoriaFinanceiro').value;
    if (data && produto && valor && categoria) {
        const lista = document.getElementById('listaFinanceiro');
        const li = document.createElement('li');
        li.textContent = `${data} - ${produto} - R$${valor} - ${categoria}`;
        lista.appendChild(li);
    }
}
