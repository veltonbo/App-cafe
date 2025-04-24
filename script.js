
window.addEventListener('DOMContentLoaded', () => {
    // Ativar visualização inicial
    showSection("aplicacao");

    // Navegação entre seções
    document.querySelectorAll("nav button").forEach(btn => {
        btn.addEventListener("click", () => showSection(btn.dataset.section));
    });

    function showSection(id) {
        document.querySelectorAll(".app-section").forEach(sec => sec.style.display = "none");
        const target = document.getElementById(id);
        if (target) target.style.display = "block";
    }

    // Renderizar placeholders visuais para confirmar funcionamento
    document.getElementById("aplicacao").innerHTML = "<div class='container'><h2>Aplicações</h2><p>Área de testes de aplicações carregada.</p></div>";
    document.getElementById("tarefas").innerHTML = "<div class='container'><h2>Tarefas</h2><p>Área de tarefas carregada.</p></div>";
    document.getElementById("financeiro").innerHTML = "<div class='container'><h2>Financeiro</h2><p>Área financeira carregada.</p></div>";

    // Botão de Backup
    const backup = document.createElement("button");
    backup.innerText = "Fazer Backup";
    backup.style.position = "fixed";
    backup.style.bottom = "90px";
    backup.style.left = "10px";
    backup.style.zIndex = "1000";
    backup.onclick = async () => {
        const dados = {
            aplicacoes: [],
            tarefas: [],
            financeiro: []
        };
        try {
            const r = await fetch("https://script.google.com/macros/s/AKfycbwU_nIK-l7aEDRA8yYRSDB70F1p1bAjCmJNmzRPOAKVrwx1_ceRT3oWbbD15niPxkCGtQ/exec", {
                method: "POST",
                body: JSON.stringify(dados),
                headers: { "Content-Type": "application/json" }
            });
            const txt = await r.text();
            alert("Backup: " + txt);
        } catch (e) {
            alert("Erro no backup: " + e.message);
        }
    };
    document.body.appendChild(backup);
});
