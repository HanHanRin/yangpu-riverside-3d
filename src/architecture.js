import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SITES, YEARS } from './data.js';

const M = {};
const boxCache = new Map();
function material(name, color, roughness = .82, metalness = .02) {
  if (!M[name]) M[name] = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return M[name];
}
const MAT = {
  brick: material('brick', 0x985744), brickDark: material('brickDark', 0x673e34), brickLight: material('brickLight', 0xb57458),
  concrete: material('concrete', 0xb5b0a4), concreteDark: material('concreteDark', 0x777a75), plaster: material('plaster', 0xd0c9b8),
  roof: material('roof', 0x4b5556, .72, .08), roofRust: material('roofRust', 0x6e4b3d), steel: material('steel', 0x404a4a, .55, .45),
  rust: material('rust', 0x9a4f2d, .72, .28), orange: material('orange', 0xd87528, .55, .3), crane: material('crane', 0xd88b32, .55, .35),
  glass: material('glass', 0x718d91, .32, .25), glassLight: material('glassLight', 0x8da5a5, .28, .28), aluminum: material('aluminum', 0xaab4ae, .42, .5), window: material('window', 0x263f43, .3, .25),
  windowOld: material('windowOld', 0x536667, .65, .05), dark: material('dark', 0x252e2e), wood: material('wood', 0x826045), woodLight: material('woodLight', 0xb08a5c),
  grass: material('grass', 0x587054), leaf: material('leaf', 0x476849), leafLight: material('leafLight', 0x71805a), trunk: material('trunk', 0x62503c),
  path: material('path', 0xb6b3a6), dock: material('dock', 0x34494a), white: material('white', 0xddd9cc), red: material('red', 0xa83b2e),
};

function geoBox() {
  if (!boxCache.has('unit')) boxCache.set('unit', new THREE.BoxGeometry(1, 1, 1));
  return boxCache.get('unit');
}
function box(g, w, h, d, x, y, z, mat = MAT.concrete, rotY = 0) {
  const m = new THREE.Mesh(geoBox(), mat); m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); m.rotation.y = rotY;
  m.castShadow = h > .5; m.receiveShadow = true; g.add(m); return m;
}
function cyl(g, r, h, x, y, z, mat = MAT.concrete, sides = 16, rTop = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, sides), mat); m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
function beam(g, a, b, radius, mat = MAT.steel, sides = 6) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), mid = av.clone().add(bv).multiplyScalar(.5);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, av.distanceTo(bv), sides), mat);
  m.position.copy(mid); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bv.sub(av).normalize()); m.castShadow = true; g.add(m); return m;
}
function roofGeometry(w, d, h) {
  const x = w / 2, z = d / 2;
  const p = new Float32Array([
    -x,0,-z, x,0,-z, 0,h,-z,  -x,0,z, 0,h,z, x,0,z,
    -x,0,-z, 0,h,-z, -x,0,z,  -x,0,z, 0,h,-z, 0,h,z,
    x,0,-z, x,0,z, 0,h,-z,  x,0,z, 0,h,z, 0,h,-z,
    -x,0,-z, -x,0,z, x,0,-z,  x,0,-z, -x,0,z, x,0,z,
    0,h,-z, x,0,z, 0,h,z, 0,h,-z, 0,h,z, x,0,-z,
  ]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.computeVertexNormals(); return geo;
}
function roof(g, w, d, h, x, y, z, mat = MAT.roof) {
  const m = new THREE.Mesh(roofGeometry(w, d, h), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
function sawRoof(g, w, d, rise, x, y, z, bays = 6, mat = MAT.roof) {
  const bw = w / bays;
  for (let i = 0; i < bays; i++) {
    roof(g, bw, d, rise, x - w / 2 + bw * (i + .5), y, z, mat);
    const sky = box(g, bw * .72, .10, d * .88, x - w / 2 + bw * (i + .58), y + rise * .52, z, MAT.glassLight);
    sky.rotation.z = -Math.atan2(rise, bw / 2); sky.castShadow = false;
  }
}
function windows(g, w, d, floors, cols, x, y, z, mat = MAT.window, side = true) {
  const count = floors * cols * (side ? 3 : 2);
  const inst = new THREE.InstancedMesh(geoBox(), mat, count); const o = new THREE.Object3D(); let k = 0;
  const ww = Math.min(1.15, w / (cols * 1.65)), wh = Math.min(1.25, 2.8 / floors + .65);
  for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
    const px = x - w * .43 + (c + .5) * (w * .86 / cols), py = y + 1.15 + f * 2.65;
    for (const s of [-1, 1]) { o.position.set(px, py, z + s * (d / 2 + .035)); o.scale.set(ww, wh, .07); o.rotation.set(0,0,0); o.updateMatrix(); inst.setMatrixAt(k++, o.matrix); }
    if (side && c < Math.max(2, Math.floor(cols * d / w))) {
      const pz = z - d * .38 + (c + .5) * (d * .76 / Math.max(2, Math.floor(cols * d / w)));
      o.position.set(x + w / 2 + .035, py, pz); o.scale.set(.07, wh, ww); o.updateMatrix(); inst.setMatrixAt(k++, o.matrix);
    }
  }
  inst.count = k; inst.castShadow = false; inst.receiveShadow = true; g.add(inst); return inst;
}
function mullions(g, w, h, d, x, y, z, cols = 14, rows = 5) {
  for (let i = 0; i <= cols; i++) box(g, .16, h, .18, x - w/2 + i*w/cols, y, z + d/2 + .08, MAT.aluminum);
  for (let j = 0; j <= rows; j++) box(g, w, .14, .18, x, y + j*h/rows - .07, z + d/2 + .08, MAT.aluminum);
  for (let i = 0; i <= Math.round(cols*d/w); i++) {
    const n = Math.round(cols*d/w); box(g, .18, h, .16, x+w/2+.08, y, z-d/2+i*d/n, MAT.aluminum);
  }
}
function sign(g, text, w, h, x, y, z, color = '#e7e5dc', bg = 'rgba(25,35,35,.85)') {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0,0,c.width,c.height); ctx.fillStyle = color; ctx.font = '600 60px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 82);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  m.position.set(x,y,z); g.add(m); return m;
}
function tree(g, x, z, s = 1) {
  cyl(g, .13*s, 1.4*s, x, 0, z, MAT.trunk, 7);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05*s, 1), MAT.leaf); crown.position.set(x,2.1*s,z); crown.scale.y = 1.2; crown.castShadow = true; g.add(crown);
}
function shrub(g,x,y,z,s=.55){ const m=new THREE.Mesh(new THREE.IcosahedronGeometry(s,1),MAT.leafLight);m.position.set(x,y+s*.7,z);m.scale.set(1.3,.75,1);m.castShadow=true;g.add(m); }
function factory(g, {x=0,z=0,w=30,d=16,h=7,floors=2,cols=10,mat=MAT.brick,saw=true,bays=6}) {
  box(g,w,h,d,x,0,z,mat); windows(g,w,d,floors,cols,x,0,z,MAT.windowOld);
  if(saw) sawRoof(g,w,d,2.2,x,h,z,bays); else roof(g,w+1,d+1,3,x,h,z);
  box(g,w+.5,.35,d+.5,x,.05,z,MAT.concreteDark);
}
function warehouse(g, modern=false) {
  box(g,30,12,17,0,0,0,modern?MAT.concrete:MAT.brickDark);
  for(let i=0;i<=6;i++) box(g,.45,12.4,.55,-15+i*5,0,8.55,MAT.concrete);
  for(let j=0;j<=4;j++) box(g,30,.38,.55,0,j*3,8.55,MAT.concrete);
  windows(g,30,17,4,12,0,0,0,MAT.windowOld);
  box(g,31,.45,18,0,12,0,MAT.concreteDark);
  if(modern){ sign(g,'毛 麻 仓 库',12,1.8,0,10.3,8.9); for(let i=0;i<8;i++) shrub(g,-13+i*3.7,12.5,-5,.6); }
}
function castleBlock(g,x,z,w,d,h) {
  box(g,w,h,d,x,0,z,MAT.brick); windows(g,w,d,2,Math.round(w/3),x,0,z,MAT.windowOld);
  roof(g,w+1,d+1,3.2,x,h,z,MAT.roof);
  for(const sx of [-1,1]) for(const sz of [-1,1]) {
    const tx=x+sx*(w/2-1), tz=z+sz*(d/2-1); box(g,2.2,h+2,2.2,tx,0,tz,MAT.brickLight);
    for(let a=-1;a<=1;a+=2){box(g,.45,.7,2.4,tx+a*.85,h+2,tz,MAT.brickLight);box(g,2.4,.7,.45,tx,h+2,tz+a*.85,MAT.brickLight);}
  }
}
function crane(g,x,z,s=1) {
  const h=13*s; for(const dx of [-1.6,1.6]) for(const dz of [-1.6,1.6]) beam(g,[x+dx*s,0,z+dz*s],[x+dx*.5*s,h*.55,z+dz*.5*s],.18*s,MAT.orange);
  cyl(g,1.2*s,1.2*s,x,h*.52,z,MAT.orange,12); box(g,3*s,1.3*s,3*s,x,h*.58,z,MAT.orange);
  beam(g,[x,h*.65,z],[x+8*s,h*.94,z+1*s],.25*s,MAT.orange);
  beam(g,[x,h*.65,z],[x-4*s,h*.77,z-1*s],.28*s,MAT.orange);
  beam(g,[x+8*s,h*.94,z+1*s],[x+8*s,3*s,z+1*s],.07*s,MAT.steel);
  box(g,1.2*s,.6*s,1.2*s,x+8*s,2.6*s,z+1*s,MAT.dark);
}
function docks(g, modern=false) {
  for(const x of [-27,-18]) {
    box(g,5,.18,25,x,-.05,23,MAT.dock); box(g,.55,1,26,x-2.75,-.1,23,MAT.concreteDark); box(g,.55,1,26,x+2.75,-.1,23,MAT.concreteDark);
    for(let k=0;k<9;k++) box(g,5.4,.12,.25,x,.2,12+k*2.8,MAT.rust);
  }
  for(const z of [4,8]) { box(g,48,.12,.14,-13,.25,z,MAT.steel); }
  crane(g,-32,10,1); crane(g,-10,14,.85);
  if(!modern){ const hull=box(g,3.3,2.2,12,-27,.3,23,MAT.rust); hull.rotation.x=.03; }
}
function shipyard(g,year) {
  docks(g,year>=2015);
  factory(g,{x:3,z:-5,w:34,d:20,h:7,cols:11,bays:5,mat:year===2026?MAT.brickLight:MAT.brick});
  box(g,7,9,8,-17,0,-9,MAT.brickLight); roof(g,8,9,2.8,-17,9,-9); windows(g,7,8,3,3,-17,0,-9);
  cyl(g,2.4,5,-6,0,9,MAT.rust,20); cyl(g,.65,13,17,0,-12,MAT.brickDark,16);
  if(year===2026){
    // Four retained spans remain legible below the new work campus.
    for(const x of [-12,-4,4,12]) { box(g,7,6,22,x,0,0,MAT.brickLight); sawRoof(g,7,22,1.5,x,6,0,1); windows(g,7,22,2,3,x,0,0,MAT.glass); }
    box(g,54,19,19,0,10,-3,MAT.glass); mullions(g,54,19,19,0,10,-3,16,6);
    box(g,56,.6,21,0,29,-3,MAT.steel); box(g,56,.5,21,0,9.8,-3,MAT.steel);
    for(let i=0;i<8;i++){ beam(g,[-27+i*7.7,10,7],[-23+i*7.7,6,11],.18,MAT.steel); }
    for(let i=0;i<8;i++){ beam(g,[-27+i*7.7,29.5,7],[-23+i*7.7,32,7],.16,MAT.aluminum); }
    for(let i=0;i<9;i++){
      const x=-27+i*6.75;beam(g,[x,29.7,7],[x+3.35,32.1,7],.13,MAT.aluminum);beam(g,[x+3.35,32.1,7],[x+6.7,29.7,7],.13,MAT.aluminum);
    }
    for(let i=0;i<4;i++){
      const z=-12+i*5;beam(g,[27.2,10,z],[27.2,29,z+5],.15,MAT.aluminum);beam(g,[27.2,29,z],[27.2,10,z+5],.15,MAT.aluminum);
    }
    for(const x of [-15,0,15])box(g,8,.65,5,x,29.6,-4,MAT.concreteDark);
    sign(g,'抖音集团上海滨江中心',25,2.4,0,25.5,6.65);
    box(g,12,7,9,-20,0,17,MAT.glassLight); mullions(g,12,7,9,-20,0,17,4,2);
    for(let i=0;i<9;i++){tree(g,-30+i*7,-18,.8);shrub(g,-27+i*6.5,.1,14,.7);}
    sign(g,'老船厂  MEET178',14,1.8,-18,4.2,21.55,'#f0e6d4','rgba(110,55,35,.92)');
  }
}
function ewo(g,year){
  factory(g,{w:36,d:19,h:7,cols:12,bays:6}); factory(g,{x:-8,z:-19,w:23,d:12,h:6,cols:8,bays:4});
  cyl(g,.8,19,15,0,-11,MAT.brickDark,16,.55); box(g,8,6,8,-22,0,3,MAT.brickLight); roof(g,9,9,3,-22,6,3); windows(g,8,8,2,3,-22,0,3);
  if(year===2026){for(let i=0;i<10;i++)tree(g,-22+i*4.5,14,.75);sign(g,'怡和纱厂 · 1896',13,1.8,0,5.2,9.65);}
}
function waterworks(g,year){
  castleBlock(g,-10,0,20,14,8);castleBlock(g,11,-2,18,16,9);castleBlock(g,0,-20,27,12,7);
  for(const x of [-15,-5,5,15]){box(g,7,.25,12,x,.05,15,MAT.glassLight);box(g,7.5,.35,.3,x,.1,9,MAT.concrete);box(g,7.5,.35,.3,x,.1,21,MAT.concrete);}
  if(year>=2026){
    for(let i=0;i<30;i++){box(g,1.6,.22,2.5,-27+i*1.85,1.1,27,MAT.woodLight);box(g,.12,1.2,.12,-27+i*1.85,1.2,28.3,MAT.steel);}
    box(g,56,.12,.12,0,2.4,28.3,MAT.steel);sign(g,'杨树浦水厂 · 1883',15,1.8,0,6,7.2);
  }
}
function xiangtai(g,year){
  box(g,30,5,13,0,0,0,MAT.woodLight); for(let i=0;i<=10;i++){box(g,.28,6,.35,-15+i*3,0,6.7,MAT.wood);beam(g,[-15+i*3,5,6.7],[-13.5+i*3,7,6.7],.12,MAT.wood);}
  roof(g,32,15,3,0,5,0,MAT.roofRust);windows(g,30,13,1,10,0,0,0,MAT.windowOld);
  for(let i=0;i<7;i++)box(g,5,.45,.7,-18+i*5,.1,11,MAT.wood);
  if(year>=2015){sign(g,year===2026?'人民城市建设规划展示馆':'祥泰木行旧址',19,1.8,0,3.5,6.95);for(let i=0;i<6;i++)tree(g,-17+i*6,-12,.75);}
}
function greenHill(g,year){
  if(year<2026){box(g,35,18,24,0,0,0,MAT.concreteDark);windows(g,35,24,5,10,0,0,0,MAT.windowOld);box(g,36,.6,25,0,18,0,MAT.concrete);return;}
  for(let i=0;i<6;i++){
    const w=35-i*3.5,d=24-i*2.2,y=i*3.1,x=i*.8;box(g,w,3,d,x,y,0,MAT.concrete);
    box(g,w+.3,.22,d+.3,x,y+3,0,MAT.grass);
    for(let k=0;k<Math.max(2,7-i);k++)shrub(g,x-w*.38+k*w*.76/Math.max(1,6-i),y+3.2,d*.32,.55);
    windows(g,w,d,1,Math.max(3,9-i),x,y,0,MAT.glass,false);
  }
  for(const off of [0,Math.PI]){
    const pts=[];for(let i=0;i<=70;i++){const a=off+i/70*Math.PI*3.2,r=5.8;pts.push(new THREE.Vector3(-15+Math.cos(a)*r,1+i/70*16,Math.sin(a)*r));}
    const curve=new THREE.CatmullRomCurve3(pts);const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,100,.18,6,false),MAT.white);mesh.castShadow=true;g.add(mesh);
  }
  sign(g,'绿 之 丘',9,1.6,3,11,9.2);
}
function yongan(g,year){
  for(const x of [-10,10]){box(g,17,14,18,x,0,0,MAT.concrete);windows(g,17,18,4,6,x,0,0,MAT.windowOld);for(let i=0;i<=4;i++)box(g,.42,14.3,.55,x-8.5+i*4.25,0,9.1,MAT.concreteDark);box(g,18,.45,19,x,14,0,MAT.concreteDark);}
  if(year===2026){
    cyl(g,.65,23,0,0,-4,MAT.red,12);for(let i=0;i<4;i++){box(g,8,.3,3,0,2+i*3.3,10.8,MAT.white);beam(g,[-4,2+i*3.3,11],[4,5.3+i*3.3,11],.13,MAT.white);}
    sign(g,'世界技能博物馆',17,2,10,11.5,9.5);for(let i=0;i<8;i++)tree(g,-22+i*6,16,.75);
  }
}
function soap(g,year){
  factory(g,{x:-7,w:28,d:18,h:7,cols:9,bays:5,mat:MAT.brickLight});box(g,10,16,11,15,0,-4,MAT.concrete);windows(g,10,11,5,4,15,0,-4,MAT.windowOld);
  for(const x of [10,16,22]){cyl(g,2,5,x,0,10,MAT.white,20);cyl(g,2,1,x,5,10,MAT.roof,20,0);}
  if(year===2026){sign(g,'皂 梦 空 间',13,1.8,-7,5,9.6);for(let i=0;i<8;i++){tree(g,-20+i*6,17,.8);shrub(g,-18+i*5,.1,11,.5);}}
}
function power(g,year){
  factory(g,{x:-6,z:-5,w:43,d:25,h:15,floors:3,cols:12,saw:false,mat:MAT.brickDark});
  box(g,25,8,14,15,0,-18,MAT.concreteDark);windows(g,25,14,2,8,15,0,-18);
  for(const x of [-18,-7]){cyl(g,1.5,39,x,0,-21,year>=2015?MAT.rust:MAT.brickDark,20,1.05);cyl(g,1.65,.8,x,38.8,-21,MAT.dark,20);}
  for(const x of [13,21,29]){cyl(g,3.2,12,x,0,9,year>=2015?MAT.concrete:MAT.concreteDark,24);cyl(g,3.2,3,x,12,9,MAT.roof,24,0);}
  beam(g,[-28,10,-8],[24,17,-8],.65,MAT.steel);for(let i=0;i<9;i++)beam(g,[-26+i*6,0,-8],[-26+i*6,13,-8],.18,MAT.steel);
  if(year>=2015){for(let i=0;i<15;i++)tree(g,-30+i*4.5,22,.8);sign(g,'电厂遗迹公园 · 灰仓艺术空间',25,2,-2,8,7.7);}
}
function fashion(g,year){
  for(const z of [-15,0,15])factory(g,{z,w:44,d:11,h:6,cols:14,bays:8,mat:MAT.brickLight});
  cyl(g,2.4,8,-26,0,-12,MAT.brickDark,16);cyl(g,3,5,-26,8,-12,MAT.concreteDark,16);roof(g,6,6,2,-26,13,-12,MAT.roof);
  if(year>=2015){sign(g,'上海国际时尚中心',21,2,0,4.5,20.7);for(let i=0;i<10;i++)tree(g,-25+i*5.5,26,.8);}
}
function vacant(g,site){box(g,30,.12,20,0,.02,0,MAT.concreteDark);sign(g,`${site.built} 年后建成`,12,1.6,0,1.8,10.1,'#e2ded0','rgba(70,76,70,.8)');}

// Labels follow the main roof, not the bounds of docks, chimneys or other
// auxiliary structures. Coordinates stay in each historical variant's local
// space and are transformed by the site's real-world placement in scene.js.
function mainRoofAnchor(site,year){
  if(year<site.built)return[0,2.5,0];
  const anchors={
    maoma:[0,12.8,0],
    shipyard:year===2026?[0,30.2,-3]:[3,9.6,-5],
    ewo:[0,9.6,0],
    water:[-10,11.6,0],
    xiangtai:[0,8.4,0],
    green:year===2026?[4,19.1,0]:[0,19,0],
    yongan:[10,14.9,0],
    soap:[-7,9.6,0],
    power:[-6,18.4,-5],
    fashion:[0,8.6,0]
  };
  return anchors[site.id]||[0,8,0];
}

// Static parts are baked by material and shadow state. This retains every facade
// detail while reducing each historical variant to a few dozen draw calls.
function optimizeVariant(g){
  const buckets=new Map(),remove=[];
  for(const o of [...g.children]){
    if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||o.material.map)continue;
    o.updateMatrix();let geo=o.geometry.clone();if(geo.index)geo=geo.toNonIndexed();
    for(const name of Object.keys(geo.attributes))if(name!=='position'&&name!=='normal')geo.deleteAttribute(name);
    geo.applyMatrix4(o.matrix);const key=`${o.material.uuid}:${o.castShadow}:${o.receiveShadow}`;
    if(!buckets.has(key))buckets.set(key,{geos:[],mat:o.material,cast:o.castShadow,receive:o.receiveShadow});
    buckets.get(key).geos.push(geo);remove.push(o);
  }
  for(const o of remove)g.remove(o);
  for(const bucket of buckets.values()){
    const geo=mergeGeometries(bucket.geos,false);if(!geo)continue;
    const m=new THREE.Mesh(geo,bucket.mat);m.castShadow=bucket.cast;m.receiveShadow=bucket.receive;g.add(m);
    for(const part of bucket.geos)part.dispose();
  }
}

export function createLandmarks() {
  const root = new THREE.Group(); root.name = ' landmarks';
  for(const site of SITES){
    const siteGroup=new THREE.Group();siteGroup.name=site.name;siteGroup.position.set(site.x,0,site.z);siteGroup.userData.siteId=site.id;
    for(const year of YEARS){
      const g=new THREE.Group();g.name=`${site.id}-${year}`;g.userData.year=year;g.userData.siteId=site.id;
      if(year<site.built)vacant(g,site);
      else if(site.id==='maoma')warehouse(g,year===2026);
      else if(site.id==='shipyard')shipyard(g,year);
      else if(site.id==='ewo')ewo(g,year);
      else if(site.id==='water')waterworks(g,year);
      else if(site.id==='xiangtai')xiangtai(g,year);
      else if(site.id==='green')greenHill(g,year);
      else if(site.id==='yongan')yongan(g,year);
      else if(site.id==='soap')soap(g,year);
      else if(site.id==='power')power(g,year);
      else if(site.id==='fashion')fashion(g,year);
      optimizeVariant(g);
      g.userData.roofAnchor=mainRoofAnchor(site,year);
      g.visible=year===2026;g.traverse(o=>{o.userData.siteId=site.id;});siteGroup.add(g);
    }
    root.add(siteGroup);
  }
  return root;
}

export function applyLandmarkYear(root,year){
  for(const site of root.children)for(const variant of site.children)variant.visible=Number(variant.userData.year)===year;
}

export function disposeLandmarks(root){
  root.traverse(o=>{if(o.geometry&&!boxCache.has(o.geometry))o.geometry.dispose?.();});
}
