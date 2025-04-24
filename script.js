
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("financeiro-form");
    const lista = document.getElementById("lista-financeiro");
    const total = document.getElementById("total");

    let dados = JSON.parse(localStorage.getItem("financeiro") || "[]");

    function atualizarLista() {
        lista.innerHTML = "";
        let soma = 0;
        dados.forEach((item, index) => {
            soma += parseFloat(item.valor);
            const li = document.createElement("li");
            li.innerHTML = \`\${item.data} - \${item.produto} - R$ \${parseFloat(item.valor).toFixed(2)} - \${item.categoria}
                <span class="acoes">
                    <button onclick="pagar(\${index})">✔</button>
                    <button onclick="editar(\${index})">✏️</button>
                    <button onclick="excluir(\${index})">🗑</button>
                </span>\`;
            lista.appendChild(li);
        });
        total.textContent = "Total a pagar: R$ " + soma.toFixed(2);
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const data = document.getElementById("data").value;
        const produto = document.getElementById("produto").value;
        const valor = document.getElementById("valor").value;
        const categoria = document.getElementById("categoria").value;
        dados.push({ data, produto, valor, categoria });
        localStorage.setItem("financeiro", JSON.stringify(dados));
        form.reset();
        atualizarLista();
    });

    window.excluir = function (index) {
        dados.splice(index, 1);
        localStorage.setItem("financeiro", JSON.stringify(dados));
        atualizarLista();
    }

    window.editar = function (index) {
        const item = dados[index];
        document.getElementById("data").value = item.data;
        document.getElementById("produto").value = item.produto;
        document.getElementById("valor").value = item.valor;
        document.getElementById("categoria").value = item.categoria;
        dados.splice(index, 1);
        localStorage.setItem("financeiro", JSON.stringify(dados));
        atualizarLista();
    }

    window.pagar = function (index) {
        dados[index].pago = true;
        localStorage.setItem("financeiro", JSON.stringify(dados));
        atualizarLista();
    }

    atualizarLista();
});
