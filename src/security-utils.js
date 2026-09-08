(function(global){
  'use strict';

  function escapeHtml(value){
    return String(value ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function csvCell(value){
    let text=String(value ?? '').replace(/\r?\n/g,' ');
    // Evita fórmulas automáticas ao abrir CSV em Excel/Sheets.
    if(/^[=+\-@]/.test(text))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }

  global.escapeHtml=escapeHtml;
  global.csvCell=csvCell;
})(window);
