import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMobility } from './mobility.js';

const LAYER={ground:-.36,satellite:-.30,surface:-.22,marking:-.14,water:-.055,road:.025,foot:.04};
const SATELLITE_BOUNDS={west:121.505,south:31.241,east:121.566,north:31.286};

export const SITE_GEO = {
  maoma: { lon:121.515426, lat:31.251464, scale:.30, anchor:'邻近现状建筑 OSM 670670978' },
  shipyard: { lon:121.518299, lat:31.251287, scale:.42, anchor:'抖音城市文化会客厅 OSM 1370141321' },
  ewo: { lon:121.520847, lat:31.252588, scale:.43, anchor:'怡和纱厂现状建筑群' },
  water: { lon:121.52380, lat:31.25325, scale:.50, anchor:'杨树浦水厂现状建筑群' },
  xiangtai: { lon:121.533083, lat:31.255375, scale:.34, anchor:'规划展示馆 OSM 481557069' },
  green: { lon:121.53510, lat:31.25670, scale:.58, anchor:'绿之丘现状建筑范围' },
  yongan: { lon:121.537222, lat:31.257947, scale:.36, anchor:'世界技能博物馆 OSM 1208662450' },
  soap: { lon:121.54445, lat:31.264349, scale:.44, anchor:'制皂厂现状建筑群' },
  power: { lon:121.55302, lat:31.27262, scale:.58, anchor:'杨树浦电厂现状建筑群' },
  fashion: { lon:121.55391, lat:31.27395, scale:.44, anchor:'国棉十七厂现状建筑群' },
};
export function project(lon,lat,meta){const o=meta.origin;return new THREE.Vector3((lon-o.lon)*111320*Math.cos(o.lat*Math.PI/180)*o.scale,0,-(lat-o.lat)*110540*o.scale);}
export function unproject(x,z,meta){const o=meta.origin;return{lon:x/(111320*Math.cos(o.lat*Math.PI/180)*o.scale)+o.lon,lat:-z/(110540*o.scale)+o.lat};}
const LAND_BOUNDS={maoma:[-15,15,-8.5,8.5],shipyard:[-21,20,-15,12],ewo:[-27,19,-26,10],water:[-21,21,-26,8],xiangtai:[-20,20,-8,12],green:[-18,22,-12,12],yongan:[-19,19,-10,12],soap:[-22,23,-14,16],power:[-32,34,-25,22],fashion:[-28,23,-21,21]};
function pointInPolygon(x,z,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [xi,zi]=polygon[i],[xj,zj]=polygon[j];if(((zi>z)!==(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi))inside=!inside;}return inside;}
function inWater(x,z,data){for(const p of data.water)if(p.length>3&&pointInPolygon(x,z,p))return true;return false;}
const buildingBoxes=new WeakMap();
function onBuilding(x,z,data){
  if(!buildingBoxes.has(data))buildingBoxes.set(data,data.buildings.map(b=>({p:b.p,x0:Math.min(...b.p.map(q=>q[0])),x1:Math.max(...b.p.map(q=>q[0])),z0:Math.min(...b.p.map(q=>q[1])),z1:Math.max(...b.p.map(q=>q[1]))})));
  for(const b of buildingBoxes.get(data))if(x>=b.x0-.35&&x<=b.x1+.35&&z>=b.z0-.35&&z<=b.z1+.35&&pointInPolygon(x,z,b.p))return true;
  return false;
}
function nearLandmark(x,z,data,margin=1.8){
  for(const fp of Object.values(data.footprints||{})){const p=fp.p;for(let i=0;i<p.length-1;i++){const [ax,az]=p[i],[bx,bz]=p[i+1],dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz,t=l2?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2)):0;if(Math.hypot(x-ax-dx*t,z-az-dz*t)<margin)return true;}}
  return false;
}
function footprintCenter(points){let x=0,z=0,n=points.length-1;for(let i=0;i<n;i++){x+=points[i][0];z+=points[i][1];}return new THREE.Vector3(x/n,0,z/n);}
function nearestWaterDirection(c,data){let best=Infinity,dx=0,dz=-1;for(const p of data.water)for(let i=0;i<p.length-1;i++){const [ax,az]=p[i],[bx,bz]=p[i+1],vx=bx-ax,vz=bz-az,l2=vx*vx+vz*vz;if(l2<.001)continue;const t=Math.max(0,Math.min(1,((c.x-ax)*vx+(c.z-az)*vz)/l2)),qx=ax+vx*t,qz=az+vz*t,d=Math.hypot(c.x-qx,c.z-qz);if(d<best){best=d;dx=c.x-qx;dz=c.z-qz;}}const l=Math.hypot(dx,dz)||1;return[dx/l,dz/l];}
function rectHitsWater(c,scale,rotation,bounds,data){const [x0,x1,z0,z1]=bounds,cs=Math.cos(rotation),sn=Math.sin(rotation);for(const u of [x0,(x0+x1)/2,x1])for(const v of [z0,(z0+z1)/2,z1]){const x=u*scale,z=v*scale,wx=c.x+cs*x+sn*z,wz=c.z-sn*x+cs*z;if(inWater(wx,wz,data))return true;}return false;}
export function alignSiteGeography(sites,data){
  for(const site of sites){const geo=SITE_GEO[site.id],fp=data.footprints?.[site.id],center=fp?footprintCenter(fp.p):project(geo.lon,geo.lat,data.meta);let rotation=0;
    if(fp){let longest=0;for(let i=0;i<fp.p.length-1;i++){const a=fp.p[i],b=fp.p[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l>longest){longest=l;rotation=-Math.atan2(dz,dx);}}}
    const direction=nearestWaterDirection(center,data),bounds=LAND_BOUNDS[site.id];let initialScale=geo.scale;
    // 绿之丘是单体建筑，直接按 OSM 现状轮廓收缩占地；其他地标保留厂区群体尺度。
    if(fp&&site.id==='green'){
      const xs=fp.p.map(p=>p[0]),zs=fp.p.map(p=>p[1]),w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs),[x0,x1,z0,z1]=bounds,cs=Math.cos(rotation),sn=Math.sin(rotation);
      const corners=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>[cs*x+sn*z,-sn*x+cs*z]);
      const rw=Math.max(...corners.map(p=>p[0]))-Math.min(...corners.map(p=>p[0])),rd=Math.max(...corners.map(p=>p[1]))-Math.min(...corners.map(p=>p[1]));
      initialScale=Math.min(initialScale,w/rw,d/rd)*.92;
    }
    let chosenScale=initialScale,chosen=center.clone();
    outer:for(let k=0;k<40;k++){const scale=initialScale*Math.pow(.94,k);for(const shift of [0,.4,.8,1.2]){const c=center.clone();c.x+=direction[0]*shift;c.z+=direction[1]*shift;if(!rectHitsWater(c,scale,rotation,bounds,data)){chosenScale=scale;chosen=c;break outer;}}}
    geo.scale=chosenScale;geo.rotation=rotation;const lonlat=unproject(chosen.x,chosen.z,data.meta);geo.lon=lonlat.lon;geo.lat=lonlat.lat;site.x=chosen.x;site.z=chosen.z;site.lon=geo.lon;site.lat=geo.lat;site.modelScale=chosenScale;site.rotation=rotation;site.anchor=`${geo.anchor} · 岸线校正`;
  }
}
const landmarkIds=new Set([670670978,1370141321,481725205,481725204,481557069,1320233258,1208662450,481486434,1367363609,1367363604]);
const hash=(id,k=0)=>{let t=(id*2654435761+k*40503)>>>0;t=(t^(t>>>16))>>>0;return(t%10000)/10000;};
function shapeFrom(points){const s=new THREE.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));return s;}
function roadWidth(r){return({trunk:1.9,primary:1.65,secondary:1.35,tertiary:1.1,residential:.82,living_street:.72,service:.48,footway:.26,path:.24,steps:.22,cycleway:.26,pedestrian:.38}[r.kind]||.65);}
function ribbon(points,width,y=0){
  const pos=[];for(let i=0;i<points.length-1;i++){const [x1,z1]=points[i],[x2,z2]=points[i+1],dx=x2-x1,dz=z2-z1,l=Math.hypot(dx,dz);if(l<.001)continue;const nx=-dz/l*width/2,nz=dx/l*width/2;
    // Counter-clockwise from above: road normals must face +Y, not the ground.
    pos.push(x1+nx,y,z1+nz,x2+nx,y,z2+nz,x1-nx,y,z1-nz,x1-nx,y,z1-nz,x2+nx,y,z2+nz,x2-nx,y,z2-nz);
  }const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}
function mergeParts(parts,material,shadow=false){if(!parts.length)return null;const g=mergeGeometries(parts,false);for(const p of parts)p.dispose();if(!g)return null;const m=new THREE.Mesh(g,material);m.receiveShadow=true;m.castShadow=shadow;return m;}
function buildingGeometry(b,year){
  const shape=shapeFrom(b.p);
  // Heights already contain OSM tags or estimates. A uniform 2× display factor
  // keeps metre-scale blocks legible at district scale; footprints stay untouched.
  let h=b.h*.2;
  if(year<2026)h=Math.min(h,year===1915?1.2:year===1955?1.8:year===1995?3.8:7);
  h=Math.max(year===2026?1.05:.65,h);
  const g=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:1});g.rotateX(-Math.PI/2);return g;
}
function treeInstances(points){
  const g=new THREE.Group(),n=points.length;if(!n)return g;const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.07,.1,.9,5),new THREE.MeshStandardMaterial({color:0x62513d,roughness:1}),n);
  const crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.82,1),new THREE.MeshStandardMaterial({color:0x466f4f,roughness:1}),n);const o=new THREE.Object3D();
  points.forEach((p,i)=>{const s=.7+hash(i,9)*.7;o.position.set(p[0],.45*s,p[1]);o.scale.setScalar(s);o.updateMatrix();trunks.setMatrixAt(i,o.matrix);o.position.y=1.3*s;o.scale.set(s,s*1.15,s);o.updateMatrix();crowns.setMatrixAt(i,o.matrix);});crowns.castShadow=true;g.add(trunks,crowns);return g;
}
function smokeStack(x,z,height,color=0xb5b3a7){
  const g=new THREE.Group();for(let i=0;i<7;i++){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(.65+i*.16,1),new THREE.MeshStandardMaterial({color,transparent:true,opacity:.22-i*.018,depthWrite:false,roughness:1}));m.position.set(x+i*.42,height+i*.95,z-i*.16);m.scale.set(1.3,.8,1);g.add(m);}return g;
}
function addBridgeStructure(g,data){
  const road=data.roads.find(r=>r.id===8886548);if(!road)return;const mat=new THREE.MeshStandardMaterial({color:0xd5d2c5,roughness:.7});
  for(const [lon,lat] of [[121.54065,31.25745],[121.54375,31.25495]]){const p=project(lon,lat,data.meta);for(const dx of [-.75,.75]){const tower=new THREE.Mesh(new THREE.BoxGeometry(.35,8.5,.55),mat);tower.position.set(p.x+dx,4.25,p.z);tower.castShadow=true;g.add(tower);}const beam=new THREE.Mesh(new THREE.BoxGeometry(2.1,.35,.65),mat);beam.position.set(p.x,7.2,p.z);g.add(beam);}
}
function waterfrontTrees(data){
  const sites=Object.values(SITE_GEO).map(geo=>project(geo.lon,geo.lat,data.meta));
  const points=[];
  for(const polygon of data.water){
    for(const [x,z] of polygon){
      let nearest=null,dist=Infinity;
      for(const s of sites){const d=Math.hypot(s.x-x,s.z-z);if(d<dist){dist=d;nearest=s;}}
      if(dist>30||dist<2)continue;
      const dx=(nearest.x-x)/dist,dz=(nearest.z-z)/dist;
      for(const offset of [2.2,4.8]){
        const px=x+dx*offset,pz=z+dz*offset;
        if(!inWater(px,pz,data)&&!onBuilding(px,pz,data)&&!nearLandmark(px,pz,data)&&points.every(p=>Math.hypot(p[0]-px,p[1]-pz)>2.2))points.push([px,pz]);
      }
    }
  }
  return points;
}
function streetTrees(data){
  const pts=[];for(const r of data.roads){if(r.bridge||!['secondary','tertiary','residential','living_street'].includes(r.kind))continue;for(let i=0;i<r.p.length-1;i++){const [ax,az]=r.p[i],[bx,bz]=r.p[i+1],dx=bx-ax,dz=bz-az,l=Math.hypot(dx,dz);if(l<1)continue;const nx=-dz/l,nz=dx/l,steps=Math.floor(l/3.6);for(let k=0;k<steps;k++){const t=(k+.5)/Math.max(1,steps),side=(k+i)%2?1:-1,off=roadWidth(r)/2+.65,x=ax+dx*t+nx*off*side,z=az+dz*t+nz*off*side;if(!inWater(x,z,data)&&!onBuilding(x,z,data)&&!nearLandmark(x,z,data)&&pts.every(p=>Math.hypot(p[0]-x,p[1]-z)>1.6))pts.push([x,z]);}}}return pts;
}
function eraProps(year,data){
  const g=new THREE.Group(),yangpu=data.roads.filter(r=>r.name==='杨树浦路');
  if(year===2026||year===2015){
    const pts=[];for(const r of yangpu)for(let i=0;i<r.p.length;i+=2){const [x,z]=r.p[i];pts.push([x+(hash(i,3)-.5)*1.2,z-1.3-hash(i,5)*1.4]);}
    pts.push(...waterfrontTrees(data),...streetTrees(data));
    g.add(treeInstances(year===2026?pts:pts.filter((_,i)=>i%3===0)));
  }
  if(year<=1995){
    for(const sid of ['power','ewo','shipyard','fashion']){const geo=SITE_GEO[sid],p=project(geo.lon,geo.lat,data.meta);g.add(smokeStack(p.x,p.z,sid==='power'?22:10,year===1915?0xb8ad9b:0xa5aaa4));}
    const cargoMat=new THREE.MeshStandardMaterial({color:0x765a43,roughness:1});for(const sid of ['maoma','shipyard','xiangtai','fashion']){const p=project(SITE_GEO[sid].lon,SITE_GEO[sid].lat,data.meta);for(let i=0;i<9;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(1.2,.5+(i%3)*.25,.8),cargoMat);m.position.set(p.x-4+(i%5)*1.5,.3,p.z+3+Math.floor(i/5));m.castShadow=true;g.add(m);}}
  }
  if(year===2015){
    const mat=new THREE.LineBasicMaterial({color:0xd39a56,transparent:true,opacity:.9});for(const sid of ['shipyard','green','yongan','soap','power']){const geo=SITE_GEO[sid],p=project(geo.lon,geo.lat,data.meta),s=geo.scale*16;const pts=[new THREE.Vector3(p.x-s,.25,p.z-s*.5),new THREE.Vector3(p.x+s,.25,p.z-s*.5),new THREE.Vector3(p.x+s,.25,p.z+s*.5),new THREE.Vector3(p.x-s,.25,p.z+s*.5),new THREE.Vector3(p.x-s,.25,p.z-s*.5)];g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat));}
  }
  if(year>=1995)addBridgeStructure(g,data);
  return g;
}

function surfaceLayers(year,data,satelliteTexture=null){
  const group=new THREE.Group(),modern=year===2026;
  const colors=modern?{green:0xb4c3a5,sports:0xd5b7a5,hard:0xe0ded4,construction:0xd1bda8,industrial:0xc5bba9,residential:0xd4d4c9,commercial:0xccd5cf}:{green:0x7b8062,sports:0x96745f,hard:0xa9a18f,construction:0xa08367,industrial:0x917c65,residential:0xa39b88,commercial:0x9b9787};
  const b=SATELLITE_BOUNDS,a=project(b.west,b.north,data.meta),c=project(b.east,b.south,data.meta);
  const buckets=new Map();for(const s of data.surfaces||[]){
    if(!buckets.has(s.kind))buckets.set(s.kind,[]);
    const geo=new THREE.ShapeGeometry(shapeFrom(s.p));geo.rotateX(-Math.PI/2);
    if(modern&&satelliteTexture){
      const pos=geo.attributes.position,uv=geo.attributes.uv;
      for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)-a.x)/(c.x-a.x),(c.z-pos.getZ(i))/(c.z-a.z));
      uv.needsUpdate=true;
    }
    buckets.get(s.kind).push(geo);
  }
  let surfaceOrder=0;for(const [kind,parts]of buckets){const mesh=mergeParts(parts,new THREE.MeshStandardMaterial({color:colors[kind]||colors.hard,map:modern?satelliteTexture:null,roughness:1}),false);if(mesh){mesh.position.y=LAYER.surface+(surfaceOrder++)*.006;mesh.castShadow=false;group.add(mesh);}}
  return group;
}

function satelliteLayer(texture,data){
  if(!texture)return null;
  const b=SATELLITE_BOUNDS,a=project(b.west,b.north,data.meta),c=project(b.east,b.south,data.meta);
  const material=new THREE.MeshStandardMaterial({map:texture,color:0xe0e3d8,roughness:1,metalness:0,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(c.x-a.x,c.z-a.z),material);
  mesh.rotation.x=-Math.PI/2;mesh.position.set((a.x+c.x)/2,LAYER.satellite,(a.z+c.z)/2);mesh.receiveShadow=true;mesh.name='2026 卫星影像地表细节';return mesh;
}
function activityLayers(data){
  const group=new THREE.Group(),material=new THREE.LineBasicMaterial({color:0xf0ead7,transparent:true,opacity:.72,depthWrite:false});
  const addLine=points=>{const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(([x,z])=>new THREE.Vector3(x,LAYER.marking,z))),material);line.renderOrder=1;group.add(line);};
  for(const s of data.surfaces||[]){
    if(s.kind!=='sports'||s.p.length<4)continue;
    addLine(s.p);const xs=s.p.map(p=>p[0]),zs=s.p.map(p=>p[1]),w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs),cx=xs.reduce((a,b)=>a+b,0)/xs.length,cz=zs.reduce((a,b)=>a+b,0)/zs.length;
    let longest=0,dx=1,dz=0;for(let i=0;i<s.p.length-1;i++){const ax=s.p[i][0],az=s.p[i][1],bx=s.p[i+1][0],bz=s.p[i+1][1],l=Math.hypot(bx-ax,bz-az);if(l>longest){longest=l;dx=(bx-ax)/l;dz=(bz-az)/l;}}
    const half=Math.min(w,d)*.32;addLine([[cx+dz*half,cz-dx*half],[cx-dz*half,cz+dx*half]]);
    if(w*d>35){const r=Math.min(w,d)*.16,curve=new THREE.EllipseCurve(cx,cz,r,r,0,Math.PI*2,false,0);addLine(curve.getPoints(40).map(p=>[p.x,p.y]));}
  }
  group.name='OSM 活动场地简化标线';return group;
}

function currentInfillLayers(infill){
  const root=new THREE.Group(),buckets=new Map();root.name='2026 现状补充白色建筑体块';
  for(const b of infill?.buildings||[]){
    const h=Math.max(1,b.heightMeters*.2),geo=new THREE.BoxGeometry(b.widthMeters*.1,h,b.depthMeters*.1);
    geo.rotateY(b.rotation||0);geo.translate(b.x,h/2,b.z);
    if(!buckets.has(b.group))buckets.set(b.group,[]);buckets.get(b.group).push(geo);
  }
  for(const [name,parts]of buckets){
    const mesh=mergeParts(parts,new THREE.MeshStandardMaterial({color:0xe6e7e2,roughness:.82,metalness:.02}),true);
    if(mesh){mesh.name=name;root.add(mesh);}
  }
  return root;
}

function polygonArea(points){let a=0;for(let i=0;i<points.length-1;i++){const p=points[i],q=points[i+1];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a/2);}
function workLifeLayers(data,worklife){
  const root=new THREE.Group();root.name='2026 抖音工区工作生活空间';
  const places=worklife?.places||[],surfaceIds=new Set(places.flatMap(p=>p.surfaceIds||[]));
  const greenParts=[],sportParts=[],deckParts=[],benchParts=[],parkTrees=[];
  for(const s of data.surfaces||[]){
    const selected=surfaceIds.has(s.id);
    if(s.kind!=='green'&&s.kind!=='sports'&&!selected)continue;
    const geo=new THREE.ShapeGeometry(shapeFrom(s.p));geo.rotateX(-Math.PI/2);
    if(s.kind==='green')greenParts.push(geo);else if(s.kind==='sports')sportParts.push(geo);else deckParts.push(geo);
    if(s.kind==='green'){
      const xs=s.p.map(p=>p[0]),zs=s.p.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
      const count=Math.min(34,Math.max(4,Math.floor(polygonArea(s.p)/2.6)));
      for(let k=0;k<count*7&&parkTrees.length<620;k++){
        const x=x0+(x1-x0)*hash(s.id+k,31),z=z0+(z1-z0)*hash(s.id+k,47);
        if(pointInPolygon(x,z,s.p)&&!inWater(x,z,data)&&!onBuilding(x,z,data)&&!nearLandmark(x,z,data,1.1)&&parkTrees.every(p=>Math.hypot(p[0]-x,p[1]-z)>1.25))parkTrees.push([x,z]);
        if(parkTrees.filter(p=>pointInPolygon(p[0],p[1],s.p)).length>=count)break;
      }
    }
    if(selected&&s.kind==='hard'){
      const xs=s.p.map(p=>p[0]),zs=s.p.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2,w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs);
      for(const side of [-1,1])for(const along of [-.22,.22]){const b=new THREE.BoxGeometry(Math.min(2.2,w*.18),.22,.48);b.translate(cx+w*along,.22,cz+side*d*.28);benchParts.push(b);}
    }
  }
  for(const [parts,color,opacity] of [[greenParts,0x5f9361,.30],[sportParts,0xb87754,.38],[deckParts,0xc59b6a,.44]]){
    const mesh=mergeParts(parts,new THREE.MeshStandardMaterial({color,transparent:true,opacity,roughness:1,depthWrite:false}),false);
    if(mesh){mesh.position.y=LAYER.marking+.025;mesh.renderOrder=1;root.add(mesh);}
  }
  const benches=mergeParts(benchParts,new THREE.MeshStandardMaterial({color:0x70533b,roughness:.9}),true);if(benches)root.add(benches);
  root.add(treeInstances(parkTrees));
  const footParts=[],cycleParts=[];
  for(const r of data.roads){
    if(r.kind==='cycleway')cycleParts.push(ribbon(r.p,roadWidth(r)+.12,LAYER.foot+.035));
    else if(['footway','path','pedestrian'].includes(r.kind))footParts.push(ribbon(r.p,roadWidth(r)+.1,LAYER.foot+.03));
  }
  const foot=mergeParts(footParts,new THREE.MeshStandardMaterial({color:0xe3d7b8,roughness:1}),false),cycle=mergeParts(cycleParts,new THREE.MeshStandardMaterial({color:0x78a88f,roughness:1}),false);
  if(foot)root.add(foot);if(cycle)root.add(cycle);
  const outline=[],buildingMap=new Map(data.buildings.map(b=>[b.id,b]));
  for(const p of places)for(const id of p.buildingIds||[]){const b=buildingMap.get(id);if(!b)continue;for(let i=0;i<b.p.length-1;i++){const a=b.p[i],c=b.p[i+1];outline.push(a[0],.14,a[1],c[0],.14,c[1]);}}
  if(outline.length){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(outline,3));const lines=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xf0bd72,transparent:true,opacity:.95,depthWrite:false}));lines.renderOrder=3;lines.name='商业与文化设施真实建筑轮廓';root.add(lines);}
  root.userData.parkTrees=parkTrees.length;root.userData.places=places.length;return root;
}

export function createRealMap(data,satelliteTexture=null,infill=null,worklife=null){
  const root=new THREE.Group();root.name='OSM 真实城市底图';
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),new THREE.MeshStandardMaterial({color:0x9ca295,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=LAYER.ground;ground.receiveShadow=true;root.add(ground);
  const waterMat=new THREE.MeshPhysicalMaterial({color:0x527e82,roughness:.28,metalness:.08,clearcoat:.25,depthWrite:false});const shoreMat=new THREE.LineBasicMaterial({color:0xd0c9b6,transparent:true,opacity:.9,depthWrite:false});
  for(const points of data.water){if(points.length<4)continue;const geo=new THREE.ShapeGeometry(shapeFrom(points));geo.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geo,waterMat);mesh.position.y=LAYER.water;mesh.receiveShadow=true;mesh.renderOrder=2;root.add(mesh);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(([x,z])=>new THREE.Vector3(x,LAYER.road,z))),shoreMat);line.renderOrder=3;root.add(line);}
  const contexts={};const fractions={1915:.18,1955:.48,1995:.70,2015:.88,2026:1};
  for(const year of [1915,1955,1995,2015,2026]){
    const g=new THREE.Group();g.name=`OSM-${year}`;g.add(surfaceLayers(year,data,satelliteTexture));if(year===2026){const satellite=satelliteLayer(satelliteTexture,data);if(satellite)g.add(satellite);g.add(activityLayers(data));g.add(currentInfillLayers(infill));const life=workLifeLayers(data,worklife);g.add(life);g.userData.lifeLayer=life;}
    const roadParts=[],bridgeParts=[],footParts=[];
    for(const r of data.roads){if(r.bridge&&year<1995)continue;if(['footway','cycleway','pedestrian'].includes(r.kind)&&year<2015)continue;const width=roadWidth(r);const part=ribbon(r.p,width,r.bridge?2.35:(['footway','cycleway','pedestrian'].includes(r.kind)?LAYER.foot:LAYER.road));if(r.bridge)bridgeParts.push(part);else if(['footway','cycleway','pedestrian'].includes(r.kind))footParts.push(part);else roadParts.push(part);}
    const roadMat=new THREE.MeshStandardMaterial({color:year===2026?0x626964:year===2015?0x686861:0x6c685d,roughness:.96});const footMat=new THREE.MeshStandardMaterial({color:0xbcb7a7,roughness:1});
    for(const m of [mergeParts(roadParts,roadMat),mergeParts(bridgeParts,new THREE.MeshStandardMaterial({color:0x9d9f96,roughness:.85})),mergeParts(footParts,footMat)])if(m)g.add(m);
    const palettes=year===2026?[0xabadA4,0x879993,0xbcb6a8,0x7f908e]:year===2015?[0xa39a88,0x969183,0xaaa18e,0x88877d]:[0x9a8871,0x8c8272,0xa2957d,0x7c7a6e];
    const buckets=palettes.map(()=>[]);
    for(const b of data.buildings){if(landmarkIds.has(b.id))continue;if(hash(b.id,year)>fractions[year])continue;if(year<2015&&b.h>35)continue;const bucket=hash(b.id,77)<.5?0:hash(b.id,78)<.5?1:hash(b.id,79)<.5?2:3;buckets[bucket].push(buildingGeometry(b,year));}
    buckets.forEach((parts,i)=>{const m=mergeParts(parts,new THREE.MeshStandardMaterial({color:palettes[i],roughness:.9}),true);if(m)g.add(m);});
    g.add(eraProps(year,data));const mobility=createMobility(year,data);g.add(mobility.cars.group,mobility.people.group);g.userData.mobility=mobility;contexts[year]=g;root.add(g);
  }
  return {root,contexts,stats:data.meta,setMotion(cars,people){for(const g of Object.values(contexts)){g.userData.mobility.cars.group.visible=cars;g.userData.mobility.people.group.visible=people;}},setLifeVisible(visible){const layer=contexts[2026]?.userData.lifeLayer;if(layer)layer.visible=visible;},lifeStats(){const layer=contexts[2026]?.userData.lifeLayer;return{places:layer?.userData.places||0,parkTrees:layer?.userData.parkTrees||0};},update(time,year){const m=contexts[year]?.userData.mobility;if(!m)return;if(m.cars.group.visible)m.cars.update(time);if(m.people.group.visible)m.people.update(time);},motionStats(year){const m=contexts[year]?.userData.mobility;return{cars:m?.cars.count||0,people:m?.people.count||0};}};
}
