// offline-db.js
const DB_NAME = 'manejoCafeDB';
const DB_VERSION = 1;
const STORES = {
  APLICACOES: 'aplicacoes',
  TAREFAS: 'tarefas',
  FINANCEIRO: 'financeiro',
  COLHEITA: 'colheita'
};

let db;

// Inicializar o banco de dados
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

// Salvar dados offline
function saveDataOffline(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    const request = store.put(data);
    
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject('Erro ao salvar dados offline: ' + event.target.error);
  });
}

// Carregar dados offline
function loadDataOffline(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject('Erro ao carregar dados offline: ' + event.target.error);
  });
}

// Sincronizar com Firebase quando online
async function syncWithFirebase() {
  if (navigator.onLine) {
    try {
      // Sincronizar aplicações
      const aplicacoes = await loadDataOffline(STORES.APLICACOES);
      if (aplicacoes.length > 0) {
        await db.ref('Aplicacoes').set(aplicacoes);
        await clearStore(STORES.APLICACOES);
      }
      
      // Repetir para outras stores...
    } catch (error) {
      console.error('Erro na sincronização:', error);
    }
  }
}

// Verificar conexão
window.addEventListener('online', syncWithFirebase);

// Exportar funções
export { initDB, saveDataOffline, loadDataOffline, syncWithFirebase };
