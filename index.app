<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Manejo Café</title>

  <!-- Firebase Compat -->
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>

  <!-- FontAwesome -->
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" rel="stylesheet">

  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

  <style>
    body {
      margin: 0;
      font-family: 'Segoe UI', sans-serif;
      background-color: #121212;
      color: #e0e0e0;
      overflow-x: hidden;
    }
    .conteudo {
      padding: 20px;
      padding-bottom: 80px;
      max-width: 800px;
      margin: auto;
      animation: fadeIn 0.5s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .aba { display: none; }
    .aba.active { display: block; }

    input, select, button {
      width: 100%;
      padding: 10px;
      margin: 8px 0;
      border-radius: 8px;
      border: 1px solid #555;
      background-color: #2c2c2c;
      color: #fff;
      font-size: 16px;
      box-sizing: border-box;
    }
    button {
      background-color: #4caf50;
      border: none;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.3s;
    }
    button:hover {
      background-color: #45a049;
    }
    .botao-pagar {
      background-color: #4caf50;
      border: none;
      padding: 6px 10px;
      margin-left: 10px;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      cursor: pointer;
    }
    .campo-pesquisa {
      padding: 10px;
      background: #2c2c2c;
      border: 1px solid #555;
      border-radius: 8px;
      margin: 10px 0;
      color: white;
      font-size: 16px;
    }
    .item {
      background: #1e1e1e;
      padding: 12px;
      margin: 10px 0;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-left: 4px solid #66bb6a;
    }
    .item input[type="checkbox"] {
      width: 18px;
      height: 18px;
      margin-right: 10px;
      accent-color: #4caf50;
      cursor: pointer;
    }
    .item span {
      flex-grow: 1;
    }
    .menu-superior {
      display: flex;
      justify-content: center;
      background-color: #1f1f1f;
      padding: 10px 0;
      position: sticky;
      top: 0;
      z-index: 999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.6);
    }
    .menu-superior button {
      background: none;
      border: none;
      color: #aaa;
      font-size: 22px;
      margin: 0 15px;
      cursor: pointer;
      transition: 0.3s;
    }
    .menu-superior button.active, .menu-superior button:hover {
      color: #4caf50;
    }
    canvas {
      background: #1e1e1e;
      border-radius: 10px;
      padding: 10px;
      margin-top: 20px;
    }
    .grupo-data {
      margin-top: 20px;
    }
    .grupo-data h4 {
      margin-bottom: 10px;
      color: #4caf50;
    }
  </style>
</head>

<body onload="inicializarApp()">

  <div class="menu-superior">
    <button id="btn-aplicacoes" onclick="mostrarAba('aplicacoes')"><i class="fas fa-flask"></i></button>
    <button id="btn-tarefas" onclick="mostrarAba('tarefas')"><i class="fas fa-tasks"></i></button>
    <button id="btn-financeiro" onclick="mostrarAba('financeiro')"><i class="fas fa-dollar-sign"></i></button>
    <button id="btn-relatorio" onclick="mostrarAba('relatorio')"><i class="fas fa-chart-line"></i></button>
    <button id="btn-configuracoes" onclick="mostrarAba('configuracoes')"><i class="fas fa-cog"></i></button>
  </div>

  <div class="conteudo">
    <div id="financeiro" class="aba">
      <h2>Financeiro</h2>
      <input id="dataFin" type="date">
      <input id="produtoFin" placeholder="Produto">
      <input id="valorFin" placeholder="Valor" type="number">
      <select id="tipoFin">
        <option>Adubo</option>
        <option>Fungicida</option>
        <option>Inseticida</option>
        <option>Herbicida</option>
      </select>
      <button onclick="adicionarFinanceiro()">Salvar Gasto</button>
      <input id="pesquisaFinanceiro" class="campo-pesquisa" placeholder="Pesquisar..." oninput="atualizarFinanceiro()">
      <h3>A Vencer</h3>
      <div id="financeiroVencer"></div>
      <h3>Pagos</h3>
      <div id="financeiroPago"></div>
      <canvas id="graficoGastos"></canvas>
    </div>
  </div>

  <script>
    // Firebase
    const firebaseConfig = {
      apiKey: "AIzaSyD773S1h91tovlKTPbaeAZbN2o1yxROcOc",
      authDomain: "manej-cafe.firebaseapp.com",
      databaseURL: "https://manej-cafe-default-rtdb.firebaseio.com",
      projectId: "manej-cafe",
      storageBucket: "manej-cafe.appspot.com",
      messagingSenderId: "808931200634",
      appId: "1:808931200634:web:71357af2ff0dc2e4f5f5c3"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    const financeiro = [];

    function inicializarApp() {
      mostrarAba('financeiro');
      carregarFinanceiro();
    }

    function mostrarAba(id) {
      document.querySelectorAll('.aba').forEach(a => a.classList.remove('active'));
      document.querySelectorAll('.menu-superior button').forEach(b => b.classList.remove('active'));
      document.getElementById(id).classList.add('active');
      document.getElementById('btn-' + id).classList.add('active');
    }

    function adicionarFinanceiro() {
      const novo = {
        data: dataFin.value,
        produto: produtoFin.value,
        valor: parseFloat(valorFin.value),
        tipo: tipoFin.value,
        pago: false
      };
      if (!novo.data || !novo.produto || isNaN(novo.valor)) return alert("Preencha tudo!");
      financeiro.push(novo);
      db.ref('Financeiro').set(financeiro);
      atualizarFinanceiro();
    }

    function atualizarFinanceiro() {
      const filtro = pesquisaFinanceiro.value.toLowerCase();
      financeiroVencer.innerHTML = '';
      financeiroPago.innerHTML = '';

      const vencerAgrupado = {};
      const pagosAgrupado = {};

      financeiro.forEach(f => {
        const grupo = f.data || "Sem data";
        if (!f.pago) {
          vencerAgrupado[grupo] = vencerAgrupado[grupo] || [];
          vencerAgrupado[grupo].push(f);
        } else {
          pagosAgrupado[grupo] = pagosAgrupado[grupo] || [];
          pagosAgrupado[grupo].push(f);
        }
      });

      for (const data in vencerAgrupado) {
        const grupoDiv = document.createElement('div');
        grupoDiv.className = 'grupo-data';
        grupoDiv.innerHTML = `<h4>${data}</h4>`;
        vencerAgrupado[data].forEach((f, i) => {
          if (`${f.data} ${f.produto}`.toLowerCase().includes(filtro)) {
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
              <span>${f.produto} - R$ ${f.valor.toFixed(2)} - ${f.tipo}</span>
              <button class="botao-pagar" onclick="pagarConta(${financeiro.indexOf(f)})">Pagar</button>`;
            grupoDiv.appendChild(div);
          }
        });
        financeiroVencer.appendChild(grupoDiv);
      }

      for (const data in pagosAgrupado) {
        const grupoDiv = document.createElement('div');
        grupoDiv.className = 'grupo-data';
        grupoDiv.innerHTML = `<h4>${data}</h4>`;
        pagosAgrupado[data].forEach(f => {
          if (`${f.data} ${f.produto}`.toLowerCase().includes(filtro)) {
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `<span>${f.produto} - R$ ${f.valor.toFixed(2)} - ${f.tipo}</span>`;
            grupoDiv.appendChild(div);
          }
        });
        financeiroPago.appendChild(grupoDiv);
      }
      gerarGrafico();
    }

    function pagarConta(index) {
      financeiro[index].pago = true;
      db.ref('Financeiro').set(financeiro);
      atualizarFinanceiro();
    }

    function carregarFinanceiro() {
      db.ref('Financeiro').once('value').then(snap => {
        if (snap.exists()) {
          financeiro.length = 0;
          financeiro.push(...snap.val());
          atualizarFinanceiro();
        }
      });
    }

    function gerarGrafico() {
      const ctx = document.getElementById('graficoGastos').getContext('2d');
      if (window.grafico) window.grafico.destroy();
      const totais = {};
      financeiro.forEach(f => {
        if (f.pago) totais[f.tipo] = (totais[f.tipo] || 0) + f.valor;
      });
      window.grafico = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Object.keys(totais),
          datasets: [{ label: 'Gastos Pagos', data: Object.values(totais), backgroundColor: '#66bb6a' }]
        }
      });
    }
  </script>

</body>
</html>
