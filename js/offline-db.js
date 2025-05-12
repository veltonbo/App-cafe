// ===== CONFIGURAÇÕES =====
const DB_NAME = 'manejoCafeDB';
const DB_VERSION = 1;
const STORES = {
  APLICACOES: 'aplicacoes',
  TAREFAS: 'tarefas',
  FINANCEIRO: 'financeiro',
  COLHEITA: 'colheita',
  VALOR_LATA: 'valorLata'
};

let db;

// ===== INICIALIZAR BANCO DE DADOS =====
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(STORES.APLICACOES)) {
        db.createObjectStore(STORES.APLICACOES, { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains(STORES.TAREFAS)) {
        db.createObjectStore(STORES.TAREFAS, { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains(STORES.FINANCEIRO)) {
        db.createObjectStore(STORES.FINANCEIRO, { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains(STORES.COLHEITA)) {
        db.createObjectStore(STORES.COLHEITA, { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains(STORES.VALOR_LATA)) {
        db.createObjectStore(STORES.VALOR_LATA, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject('Erro ao abrir o banco de dados: ' + event.target.error);
    };
  });
}

// ===== SALVAR DADOS OFFLINE =====
function saveDataOffline(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Limpar store antes de adicionar novos dados
    const clearRequest = store.clear();
    
    clearRequest.onsuccess = () => {
      if (Array.isArray(data)) {
        const requests = data.map(item => store.add(item));
        Promise.all(requests)
          .then(() => resolve())
          .catch(error => reject('Erro ao salvar múltiplos itens: ' + error));
      } else {
        const request = store.put({ id: 1, ...data });
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject('Erro ao salvar dados offline: ' + event.target.error);
      }
    };
    
    clearRequest.onerror = (event) => {
      reject('Erro ao limpar store: ' + event.target.error);
    };
  });
}

// ===== CARREGAR DADOS OFFLINE =====
function loadDataOffline(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = (event) => {
      if (storeName === STORES.VALOR_LATA) {
        resolve(event.target.result[0]?.value || 0);
      } else {
        resolve(event.target.result || []);
      }
    };
    request.onerror = (event) => reject('Erro ao carregar dados offline: ' + event.target.error);
  });
}

// ===== SINCRONIZAR COM FIREBASE =====
async function syncWithFirebase() {
  if (!navigator.onLine) return;

  try {
    // Sincronizar aplicações
    const aplicacoes = await loadDataOffline(STORES.APLICACOES);
    if (aplicacoes.length > 0) {
      await firebase.database().ref('Aplicacoes').set(aplicacoes);
      await saveDataOffline(STORES.APLICACOES, []);
    }
    
    // Sincronizar tarefas
    const tarefas = await loadDataOffline(STORES.TAREFAS);
    if (tarefas.length > 0) {
      await firebase.database().ref('Tarefas').set(tarefas);
      await saveDataOffline(STORES.TAREFAS, []);
    }
    
    // Sincronizar financeiro
    const financeiro = await loadDataOffline(STORES.FINANCEIRO);
    if (financeiro.length > 0) {
      await firebase.database().ref('Financeiro').set(financeiro);
      await saveDataOffline(STORES.FINANCEIRO, []);
    }
    
    // Sincronizar colheita
    const colheita = await loadDataOffline(STORES.COLHEITA);
    if (colheita.length > 0) {
      await firebase.database().ref('Colheita').set(colheita);
      await saveDataOffline(STORES.COLHEITA, []);
    }
    
    // Sincronizar valor da lata
    const valorLata = await loadDataOffline(STORES.VALOR_LATA);
    if (valorLata) {
      await firebase.database().ref('ValorLata').set(valorLata);
      await saveDataOffline(STORES.VALOR_LATA, null);
    }
    
    console.log('Dados sincronizados com sucesso!');
  } catch (error) {
    console.error('Erro na sincronização:', error);
  }
}

// ===== LISTENERS DE CONEXÃO =====
window.addEventListener('online', syncWithFirebase);

// Exportar funções
export { initDB, saveDataOffline, loadDataOffline, syncWithFirebase };
