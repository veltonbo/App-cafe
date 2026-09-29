export const FARM_CLONES=Object.freeze(['156','88','R22','08','AS2','04','LB15']);
export const FARM_SECTORS=Object.freeze([{id:1,plants:1068,block_id:1},{id:2,plants:1107,block_id:1},{id:3,plants:1080,block_id:1},{id:4,plants:1246,block_id:2},{id:5,plants:1246,block_id:2},{id:6,plants:1157,block_id:2},{id:7,plants:1159,block_id:3},{id:8,plants:1157,block_id:3},{id:9,plants:1150,block_id:3}]);
export const FARM_BLOCKS=Object.freeze([{id:1,name:'Talhão 01',sectors:[1,2,3]},{id:2,name:'Talhão 02',sectors:[4,5,6]},{id:3,name:'Talhão 03',sectors:[7,8,9]}].map(b=>Object.freeze({...b,plants:FARM_SECTORS.filter(s=>b.sectors.includes(s.id)).reduce((a,s)=>a+s.plants,0)})));
export const FARM_CAPACITY=Object.freeze(Object.fromEntries(FARM_SECTORS.map(s=>[s.id,s.plants])));
export const FARM_BLOCK_SECTORS=Object.freeze(Object.fromEntries(FARM_BLOCKS.map(b=>[b.id,Object.freeze([...b.sectors])])));
export const FARM_TOTAL_PLANTS=FARM_SECTORS.reduce((a,s)=>a+s.plants,0);
