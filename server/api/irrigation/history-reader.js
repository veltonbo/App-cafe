import { readRecentHistory as readFirebaseHistory } from './_store.js';
import { localHistoryCanServe, readLocalHistory } from '../../local/history-store.js';

export async function readRecentHistory({sinceMs=0,limit=60000}={}){
  const options={sinceMs,limit};
  try{
    if(await localHistoryCanServe(options)){
      const rows=await readLocalHistory(options);
      if(rows.length)return rows;
    }
  }catch(error){
    console.warn('[LocalHistory] leitura local indisponível:',error?.message||error);
  }
  return readFirebaseHistory(options);
}
