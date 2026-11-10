import * as THREE from 'three';

const hash=(id,k=0)=>{let t=(id*2654435761+k*40503)>>>0;t=(t^(t>>>16))>>>0;return(t%10000)/10000;};
const CAR_COUNTS={1915:18,1955:40,1995:70,2015:90,2026:120};
const PEOPLE_COUNTS={1915:30,1955:50,1995:65,2015:100,2026:160};
const CAR_COLORS=[0xd7d4c8,0xb34f3f,0x527482,0xd2a84e,0x465653,0x88958e];
const PEOPLE_COLORS=[0xc36c4e,0x506f78,0xd0b279,0x67785c,0x8c5e68,0xd4d0c2];

function makePaths(roads,kinds){
  const paths=[];for(const r of roads){if(!kinds.includes(r.kind)||r.p.length<2)continue;const cumulative=[0];let total=0;for(let i=0;i<r.p.length-1;i++){total+=Math.hypot(r.p[i+1][0]-r.p[i][0],r.p[i+1][1]-r.p[i][1]);cumulative.push(total);}if(total<2)continue;const mid=r.p[Math.floor(r.p.length/2)];paths.push({p:r.p,cumulative,total,y:r.bridge?2.37:.035,sector:mid[0]<-60?-1:mid[0]>60?1:0});}return paths;
}
function sampleInto(path,distance,out){let d=distance%path.total;if(d<0)d+=path.total;let i=0;while(i<path.cumulative.length-2&&path.cumulative[i+1]<d)i++;const a=path.p[i],b=path.p[i+1],span=path.cumulative[i+1]-path.cumulative[i]||1,t=(d-path.cumulative[i])/span,dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;out.x=a[0]+(b[0]-a[0])*t;out.z=a[1]+(b[1]-a[1])*t;out.dx=dx/l;out.dz=dz/l;return out;}
function agentsFor(paths,count,year,type){const agents=[];if(!paths.length)return agents;for(let i=0;i<count;i++){const path=paths[Math.floor(hash(i+1,year+(type==='car'?11:29))*paths.length)%paths.length],dir=hash(i,51)>.5?1:-1;agents.push({path,dir,phase:hash(i,63)*path.total,speed:type==='car'?(.65+hash(i,71)*1.2)*(year<1955?.55:year<1995?.78:1):.09+hash(i,73)*.13,lane:type==='car'?(hash(i,81)>.5?.23:-.23):(hash(i,83)-.5)*.45,size:type==='car'?.82+hash(i,91)*.35:.85+hash(i,93)*.3,sample:{},index:0});}return agents;}
function buildSystems(group,agents,type){
  const systems=[],car=type==='car',bodyGeo=car?new THREE.BoxGeometry(.68,.2,.34):new THREE.CylinderGeometry(.04,.055,.13,5),topGeo=car?new THREE.BoxGeometry(.36,.14,.28):new THREE.SphereGeometry(.04,6,4);topGeo.translate(car?-.06:0,car?.16:.105,0);
  const bodyMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:car?.58:.88,metalness:car?.12:0}),topMat=new THREE.MeshStandardMaterial({color:car?0x2d4147:0xc49a79,roughness:car?.35:.9});
  for(const sector of [-1,0,1]){const list=agents.filter(a=>a.path.sector===sector);if(!list.length)continue;const body=new THREE.InstancedMesh(bodyGeo,bodyMat,list.length),top=new THREE.InstancedMesh(topGeo,topMat,list.length);body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);top.instanceMatrix.setUsage(THREE.DynamicDrawUsage);body.castShadow=false;top.castShadow=false;list.forEach((a,i)=>{a.index=i;body.setColorAt(i,new THREE.Color((car?CAR_COLORS:PEOPLE_COLORS)[Math.floor(hash(i,sector+104)*(car?CAR_COLORS.length:PEOPLE_COLORS.length))]));});body.instanceColor.needsUpdate=true;group.add(body,top);systems.push({list,body,top});}
  return systems;
}
function createMotion(type,year,data){
  const paths=makePaths(data.roads,type==='car'?['trunk','trunk_link','primary','primary_link','secondary','tertiary']:['footway','cycleway','pedestrian','path','residential','living_street','tertiary']),agents=agentsFor(paths,(type==='car'?CAR_COUNTS:PEOPLE_COUNTS)[year],year,type),group=new THREE.Group(),systems=buildSystems(group,agents,type),dummy=new THREE.Object3D();group.name=type==='car'?`${year} 车流`:`${year} 行人`;
  function update(time){for(const system of systems){for(const a of system.list){const s=sampleInto(a.path,a.phase+time*a.speed*a.dir,a.sample),dx=s.dx*a.dir,dz=s.dz*a.dir,nx=-dz,nz=dx;dummy.position.set(s.x+nx*a.lane,a.path.y+(type==='car'?.12:.075)+(type==='person'?Math.abs(Math.sin(time*4+a.phase))*.012:0),s.z+nz*a.lane);dummy.rotation.set(0,Math.atan2(-dz,dx),0);dummy.scale.setScalar(a.size);dummy.updateMatrix();system.body.setMatrixAt(a.index,dummy.matrix);system.top.setMatrixAt(a.index,dummy.matrix);}system.body.instanceMatrix.needsUpdate=true;system.top.instanceMatrix.needsUpdate=true;system.body.computeBoundingSphere();system.top.computeBoundingSphere();}}
  update(0);return{group,update,count:agents.length};
}

export function createMobility(year,data){const cars=createMotion('car',year,data),people=createMotion('person',year,data);return{cars,people,update(time){cars.update(time);people.update(time);}};}
