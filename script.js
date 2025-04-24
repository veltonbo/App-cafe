
window.addEventListener('DOMContentLoaded', () => {
    // Botão de backup
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
            const r = await fetch("https://script.google.com/macros/s/AKfycbxiKocLUoellQQF2ocnPWRVgHnB9bP1WPoaeF5vaNxDF4RIEJmBs4ndieDe05l1pTAr_w/exec", {
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

    // Exibir seções de exemplo
    document.getElementById("aplicacao").innerHTML = "<h2>Aplicações</h2><p>Área carregada.</p>";
    document.getElementById("tarefas").innerHTML = "<h2>Tarefas</h2><p>Área carregada.</p>";
    document.getElementById("financeiro").innerHTML = "<h2>Financeiro</h2><p>Área carregada.</p>";
});
