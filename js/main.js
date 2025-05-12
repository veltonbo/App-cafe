// js/main.js

document.addEventListener('DOMContentLoaded', () => {
    const menuButtons = document.querySelectorAll('.menu-superior button');
    const abas = document.querySelectorAll('.conteudo .aba');

    // Função para mostrar a aba selecionada e atualizar o botão ativo
    window.mostrarAba = function(idAba) {
        abas.forEach(aba => {
            if (aba.id === idAba) {
                aba.classList.add('active');
            } else {
                aba.classList.remove('active');
            }
        });

        menuButtons.forEach(button => {
            // Assume que o id do botão é 'btn-' + idAba (ex: btn-aplicacoes)
            if (button.id === `btn-${idAba}`) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        // Salva a aba ativa no localStorage para persistência
        localStorage.setItem('abaAtiva', idAba);
    }

    // Adiciona event listeners aos botões do menu
    document.getElementById('btn-aplicacoes').addEventListener('click', () => mostrarAba('aplicacoes'));
    document.getElementById('btn-tarefas').addEventListener('click', () => mostrarAba('tarefas'));
    document.getElementById('btn-financeiro').addEventListener('click', () => mostrarAba('financeiro'));
    document.getElementById('btn-colheita').addEventListener('click', () => mostrarAba('colheita'));
    document.getElementById('btn-relatorio').addEventListener('click', () => mostrarAba('relatorio'));
    document.getElementById('btn-configuracoes').addEventListener('click', () => mostrarAba('configuracoes'));

    // Carrega a aba ativa do localStorage ou define uma padrão
    const abaSalva = localStorage.getItem('abaAtiva');
    if (abaSalva && document.getElementById(abaSalva)) {
        mostrarAba(abaSalva);
    } else {
        mostrarAba('aplicacoes'); // Aba padrão ao carregar
    }

    // Carrega o tema salvo
    const temaSalvo = localStorage.getItem('tema');
    if (temaSalvo === 'claro') {
        document.body.classList.add('claro');
    }
});
