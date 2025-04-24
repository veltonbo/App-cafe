
function mostrarSecao(id) {
    document.querySelectorAll('.secao').forEach(sec => sec.style.display = 'none');
    document.getElementById(id).style.display = 'block';
}

function adicionarAplicacao() {
    const data = document.getElementById('dataAplicacao').value;
    const produto = document.getElementById('produtoAplicacao').value;
    const dosagem = document.getElementById('dosagemAplicacao').value;
    const tipo = document.getElementById('tipoAplicacao').value;
    const lista = document.getElementById('listaAplicacoes');

    const div = document.createElement('div');
    div.textContent = `${data} - ${produto} - ${dosagem} - ${tipo}`;
    lista.appendChild(div);
}

function adicionarTarefa() {
    const data = document.getElementById('dataTarefa').value;
    const desc = document.getElementById('descTarefa').value;
    const lista = document.getElementById('listaTarefas');

    const div = document.createElement('div');
    div.textContent = `${data} - ${desc}`;
    lista.appendChild(div);
}

function adicionarFinanceiro() {
    const data = document.getElementById('dataFinanceiro').value;
    const produto = document.getElementById('produtoFinanceiro').value;
    const valor = document.getElementById('valorFinanceiro').value;
    const categoria = document.getElementById('categoriaFinanceiro').value;
    const lista = document.getElementById('listaFinanceiro');

    const div = document.createElement('div');
    div.textContent = `${data} - ${produto} - R$${valor} - ${categoria}`;
    lista.appendChild(div);
}
