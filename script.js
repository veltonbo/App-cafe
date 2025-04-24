
window.addEventListener('DOMContentLoaded', () => {
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
            const r = await fetch("https://script.google.com/macros/s/AKfycbzUmf5PuheEE_CggogXoGScNuGBnISI-6SHHDyaho0Lq-5igVyd1B_dTb3lmYOOdBfQfg/exec", {
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
