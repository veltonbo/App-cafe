const SHEET = SpreadsheetApp.getActiveSpreadsheet();

function salvarDados(aba, dados) {
  const planilha = SHEET.getSheetByName(aba);
  planilha.clearContents();
  if (dados.length === 0) return;

  const chaves = Object.keys(dados[0]);
  planilha.appendRow(chaves);

  dados.forEach(obj => {
    const linha = chaves.map(k => obj[k]);
    planilha.appendRow(linha);
  });
}

function carregarDados(aba) {
  const planilha = SHEET.getSheetByName(aba);
  const valores = planilha.getDataRange().getValues();
  const chaves = valores.shift();
  return valores.map(linha => {
    const obj = {};
    linha.forEach((v, i) => obj[chaves[i]] = v);
    return obj;
  });
}
