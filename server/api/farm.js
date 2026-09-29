import {applyCors,authorize} from './_tuya.js';
import {FARM_BLOCKS,FARM_CLONES,FARM_SECTORS,FARM_TOTAL_PLANTS} from './_farm-model.js';

const sectors=FARM_SECTORS,blocks=FARM_BLOCKS;

export default async function handler(req,res){
  applyCors(req,res);if(req.method==='OPTIONS')return res.status(204).end();if(!authorize(req,res))return;
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Módulo Café/Talhões é somente leitura nesta versão.'});
  return res.status(200).json({ok:true,version:'1.2',farm:'Fazenda 2E',location:'Nova Brasilândia d’Oeste - RO',crop:{type:'Café clonal Conilon',spacing_m:{rows:2.8,plants:1},clones:FARM_CLONES,clone_04_reference:'Eduardo p42'},blocks,sectors,total_plants:FARM_TOTAL_PLANTS,map:{version:'1.0',mode:'operational_schematic',georeferenced:false,kml_status:'aguardando_kml_atual_confirmado',sector_geometry:'pending'},sector_detail:{clone_assignment:'aguardando_mapa_confirmado',map_status:'aguardando_geometria_confirmada',management_history:'sem_lancamentos_confirmados'},source:'cadastro_validado',read_only:true,physical_control:false});
}
