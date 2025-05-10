// js/colheita.js

function initColheita() {
    console.log("Módulo Colheita Iniciado");
    document.getElementById("colheitaForm").addEventListener("submit", (e) => {
        e.preventDefault();
        adicionarColheita();
    });
    carregarColheitas();
}

function adicionarColheita() {
    const tipo = document.getElementById("tipoColheita").value;
    const peso = document.getElementById("pesoColheita").value;

    db.ref("colheitas").push({
        tipo: tipo,
        peso: peso,
        data: new Date().toISOString()
    });

    document.getElementById("tipoColheita").value = "";
    document.getElementById("pesoColheita").value = "";
}

function carregarColheitas() {
    db.ref("colheitas").on("value", (snapshot) => {
        const colheitaList = document.getElementById("colheitaList");
        colheitaList.innerHTML = "";
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const key = childSnapshot.key;
            const listItem = document.createElement("li");
            listItem.innerHTML = `
                <span class="item-text">${data.tipo} - ${data.peso}kg</span>
                <div class="item-actions">
                    <button onclick="editarColheita('${key}')">✏️</button>
                    <button onclick="excluirColheita('${key}')">🗑️</button>
                </div>
            `;
            colheitaList.appendChild(listItem);
        });
    });
}

function editarColheita(key) {
    const novoTipo = prompt("Digite o novo tipo:");
    const novoPeso = prompt("Digite o novo peso:");

    if (novoTipo && novoPeso) {
        db.ref("colheitas/" + key).update({
            tipo: novoTipo,
            peso: novoPeso
        });
    }
}

function excluirColheita(key) {
    if (confirm("Deseja realmente excluir esta colheita?")) {
        db.ref("colheitas/" + key).remove();
    }
}
