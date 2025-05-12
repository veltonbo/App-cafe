// js/aplicacao.js

document.addEventListener('DOMContentLoaded', () => {
    const btnSalvarAplicacao = document.getElementById('btnSalvarAplicacao');
    const btnCancelarEdicaoApp = document.getElementById('btnCancelarEdicaoApp');
    const formAplicacao = document.getElementById('formAplicacao'); // Assumindo que você envolveu em um form

    // Elementos do formulário
    const dataAppInput = document.getElementById('dataApp');
    const produtoAppInput = document.getElementById('produtoApp');
    const dosagemAppInput = document.getElementById('dosagemApp');
    const tipoAppSelect = document.getElementById('tipoApp');
    const setorAppSelect = document.getElementById('setorApp');
    const listaAplicacoesDiv = document.getElementById('listaAplicacoes');

    let editandoAplicacaoId = null; // Para controlar se está editando

    // Função para adicionar/salvar aplicação
    window.adicionarAplicacao = function() {
        const data = dataAppInput.value;
        const produto = produtoAppInput.value;
        const dosagem = dosagemAppInput.value;
        const tipo = tipoAppSelect.value;
        const setor = setorAppSelect.value;

        if (!data || !produto || !dosagem) {
            alert("Por favor, preencha todos os campos obrigatórios (Data, Produto, Dosagem).");
            return;
        }

        const aplicacaoData = {
            data,
            produto,
            dosagem,
            tipo,
            setor,
            timestamp: Date.now() // Para ordenação ou referência
        };

        if (editandoAplicacaoId) {
            // Lógica para ATUALIZAR no Firebase
            database.ref('aplicacoes/' + editandoAplicacaoId).update(aplicacaoData)
                .then(() => {
                    console.log("Aplicação atualizada com sucesso!");
                    cancelarEdicaoAplicacao(); // Reseta o formulário e o estado de edição
                    carregarAplicacoes(); // Recarrega a lista
                })
                .catch(error => console.error("Erro ao atualizar aplicação: ", error));
        } else {
            // Lógica para ADICIONAR NOVO no Firebase
            database.ref('aplicacoes').push(aplicacaoData)
                .then(() => {
                    console.log("Aplicação salva com sucesso!");
                    formAplicacao.reset(); // Limpa o formulário
                    carregarAplicacoes(); // Recarrega a lista
                })
                .catch(error => console.error("Erro ao salvar aplicação: ", error));
        }
    }

    // Função para cancelar edição
    window.cancelarEdicaoAplicacao = function() {
        editandoAplicacaoId = null;
        formAplicacao.reset();
        btnSalvarAplicacao.textContent = 'Salvar Aplicação';
        btnCancelarEdicaoApp.classList.add('hidden');
    }

    // Função para carregar aplicações do Firebase e exibir na lista
    function carregarAplicacoes() {
        const aplicacoesRef = database.ref('aplicacoes').orderByChild('timestamp'); // Ordenar por timestamp, por exemplo
        aplicacoesRef.on('value', (snapshot) => {
            listaAplicacoesDiv.innerHTML = ''; // Limpa a lista atual
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const aplicacao = childSnapshot.val();
                    const aplicacaoId = childSnapshot.key;
                    const itemHtml = `
                        <div class="item" id="app-${aplicacaoId}">
                            <span>${aplicacao.data} - ${aplicacao.produto} (${aplicacao.tipo}) - ${aplicacao.dosagem} - Setor: ${aplicacao.setor}</span>
                            <div class="botoes-aplicacao">
                                <button class="botao-circular azul" onclick="editarAplicacao('${aplicacaoId}')" title="Editar"><i class="fas fa-edit"></i></button>
                                <button class="botao-circular vermelho" onclick="removerAplicacao('${aplicacaoId}')" title="Remover"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `;
                    listaAplicacoesDiv.innerHTML += itemHtml;
                });
            } else {
                listaAplicacoesDiv.innerHTML = '<p>Nenhuma aplicação registrada.</p>';
            }
        });
    }

    // Função para preencher o formulário para edição
    window.editarAplicacao = function(aplicacaoId) {
        database.ref('aplicacoes/' + aplicacaoId).once('value').then((snapshot) => {
            if (snapshot.exists()) {
                const aplicacao = snapshot.val();
                dataAppInput.value = aplicacao.data;
                produtoAppInput.value = aplicacao.produto;
                dosagemAppInput.value = aplicacao.dosagem;
                tipoAppSelect.value = aplicacao.tipo;
                setorAppSelect.value = aplicacao.setor;

                editandoAplicacaoId = aplicacaoId;
                btnSalvarAplicacao.textContent = 'Atualizar Aplicação';
                btnCancelarEdicaoApp.classList.remove('hidden');
                window.scrollTo(0, 0); // Rola para o topo para ver o formulário
            }
        });
    }

    // Função para remover aplicação
    window.removerAplicacao = function(aplicacaoId) {
        if (confirm("Tem certeza que deseja remover esta aplicação?")) {
            database.ref('aplicacoes/' + aplicacaoId).remove()
                .then(() => {
                    console.log("Aplicação removida com sucesso!");
                    // A lista será atualizada automaticamente pelo listener 'on value'
                })
                .catch(error => console.error("Erro ao remover aplicação: ", error));
        }
    }

    // Event Listeners para os botões (se não usar onclick inline)
    if (btnSalvarAplicacao) {
        btnSalvarAplicacao.addEventListener('click', adicionarAplicacao);
    }
    if (btnCancelarEdicaoApp) {
        btnCancelarEdicaoApp.addEventListener('click', cancelarEdicaoAplicacao);
    }
    
    // Carregar aplicações ao iniciar
    carregarAplicacoes();
});
