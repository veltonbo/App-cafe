const SHEET_ID = '1-vsi1PI9aDZtgMbmBchG7eCCHS0T0UqOSRAt1RXrvcQ';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle("Manejo Café");
}

function salvarDados(tipo, dados) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const aba = ss.getSheetByName(tipo) || ss.insertSheet(tipo);
  aba.clearContents();

  if (!Array.isArray(dados) || dados.length === 0) return;

  const colunas = Object.keys(dados[0]);
  aba.appendRow(colunas);

  dados.forEach(linha => {
    const valores = colunas.map(c => linha[c]);
    aba.appendRow(valores);
  });
}

function carregarDados(tipo) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const aba = ss.getSheetByName(tipo);
  if (!aba) return [];

  const valores = aba.getDataRange().getValues();
  const cabecalho = valores[0];

  return valores.slice(1).map(linha => {
    const obj = {};
    cabecalho.forEach((coluna, i) => {
      obj[coluna] = linha[i];
    });
    return obj;
  });
}
