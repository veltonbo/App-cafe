// Navegação entre páginas
function loadPage(pageId) {
    fetch(`pages/${pageId}.html`)
        .then(response => response.text())
        .then(html => {
            document.getElementById(`${pageId}-page`).innerHTML = html;
            initPageScripts(pageId);
        });
}

function initPageScripts(pageId) {
    // Inicializa scripts específicos de cada página
    switch(pageId) {
        case 'aplicacoes':
            initAplicacoes();
            break;
        case 'colheita':
            initColheita();
            break;
        // ... outros casos
    }
}
