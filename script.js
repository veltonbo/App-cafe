
// Simples placeholder para recriação após reset
console.log("Reinicializado após reset. Código real será gerado novamente conforme solicitado.");


const backup = document.createElement("button");
backup.innerText = "Fazer Backup";
backup.style.position = "fixed";
backup.style.bottom = "90px";
backup.style.left = "10px";
backup.style.zIndex = "1000";
backup.onclick = async () => {
    const dados = { aplicacoes, tarefas, financeiro };
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

function desenharGrafico(dados) {
    const ctx = document.getElementById("grafico-gastos").getContext("2d");
    if (window.grafico) window.grafico.destroy();
    window.grafico = new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(dados),
            datasets: [{ label: "Gastos (R$)", data: Object.values(dados) }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}
