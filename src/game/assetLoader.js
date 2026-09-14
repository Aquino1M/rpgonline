import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * Runtime asset loader used by Shadow Ascension.
 *
 * V0.8.3 supports GLB/GLTF plus FBX/DAE packs. A source file is only parsed once;
 * manifests can then point at a particular node of a large kit (for example a
 * single gate or tower inside Kenney's Castle Kit) without duplicating the file.
 */
export class AssetLibrary {
  constructor(){
    this.gltf=new GLTFLoader()
    this.fbx=new FBXLoader()
    this.collada=new ColladaLoader()
    this.cache=new Map()
    this.pending=new Map()
    this.failed=new Set()
  }

  clone(root){
    if(!root)return null
    const copy=skeletonClone(root)
    copy.animations=root.animations||[]
    return copy
  }

  prepareRoot(root,animations=[]){
    if(!root)return null
    root.animations=animations||root.animations||[]
    root.updateMatrixWorld?.(true)
    root.traverse?.(o=>{
      if(o.isMesh||o.isSkinnedMesh){
        o.castShadow=true
        o.receiveShadow=true
        if(Array.isArray(o.material))for(const m of o.material){if(m)m.needsUpdate=true}
        else if(o.material)o.material.needsUpdate=true
      }
    })
    return root
  }

  async loadSource(url){
    if(!url||this.failed.has(url))return null
    if(this.cache.has(url))return this.cache.get(url)
    if(this.pending.has(url))return this.pending.get(url)
    const task=(async()=>{
      try{
        const clean=url.split('?')[0].toLowerCase()
        let root=null,animations=[]
        if(clean.endsWith('.fbx')){
          root=await this.fbx.loadAsync(url)
          animations=root.animations||[]
        }else if(clean.endsWith('.dae')){
          const dae=await this.collada.loadAsync(url)
          root=dae.scene
          animations=dae.animations||root?.animations||[]
        }else{
          const gltf=await this.gltf.loadAsync(url)
          root=gltf.scene
          animations=gltf.animations||[]
        }
        this.prepareRoot(root,animations)
        this.cache.set(url,root)
        return root
      }catch(err){
        console.warn(`[Shadow Ascension] Falha ao carregar asset ${url}`,err)
        this.failed.add(url)
        return null
      }finally{this.pending.delete(url)}
    })()
    this.pending.set(url,task)
    return task
  }

  async load(url){
    const source=await this.loadSource(url)
    return source?this.clone(source):null
  }

  /** Load one manifest entry. nodeName lets one large GLB act as a kit. */
  async loadEntry(entry){
    if(!entry?.url)return null
    const source=await this.loadSource(entry.url)
    if(!source)return null
    if(!entry.nodeName&&!entry.nodePattern)return this.clone(source)

    source.updateMatrixWorld?.(true)
    let found=null
    if(entry.nodeName){
      found=source.getObjectByName?.(entry.nodeName)||null
      if(!found){
        const sanitized=entry.nodeName.replace(/\s+/g,'_')
        found=source.getObjectByName?.(sanitized)||null
      }
      if(!found){
        const cleanName=entry.nodeName.toLowerCase().replace(/[^a-z0-9]/g,'')
        source.traverse?.(o=>{
          if(!found&&o.name){
            const curClean=o.name.toLowerCase().replace(/[^a-z0-9]/g,'')
            if(curClean===cleanName||curClean.startsWith(cleanName)||(curClean.length>4&&cleanName.startsWith(curClean)))found=o
          }
        })
      }
    }
    if(!found&&entry.nodePattern){
      let re=null
      try{re=new RegExp(entry.nodePattern,'i')}catch{}
      if(re)source.traverse?.(o=>{if(!found&&re.test(o.name||''))found=o})
    }
    if(!found){
      console.warn(`[Shadow Ascension] Nó do kit não encontrado: ${entry.nodeName||entry.nodePattern} em ${entry.url}`)
      return null
    }
    found.updateMatrixWorld?.(true)
    const copy=skeletonClone(found)
    const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3()
    found.matrixWorld.decompose(p,q,s)
    copy.position.copy(p);copy.quaternion.copy(q);copy.scale.copy(s)
    copy.animations=[]
    copy.userData={...(copy.userData||{}),sourceNode:found.name,sourceUrl:entry.url}
    this.prepareRoot(copy,[])
    return copy
  }

  fit(root,targetHeight=2,{centerXZ=true}={}){
    if(!root)return root
    root.updateMatrixWorld?.(true)
    let box=new THREE.Box3().setFromObject(root),size=new THREE.Vector3();box.getSize(size)
    const scale=size.y>0?targetHeight/size.y:1
    root.scale.multiplyScalar(scale)
    root.updateMatrixWorld?.(true)
    box=new THREE.Box3().setFromObject(root)
    const center=new THREE.Vector3();box.getCenter(center)
    root.position.y-=box.min.y
    if(centerXZ){root.position.x-=center.x;root.position.z-=center.z}
    root.updateMatrixWorld?.(true)
    return root
  }

  bounds(root){
    if(!root)return {size:new THREE.Vector3(),center:new THREE.Vector3(),radius:0}
    const box=new THREE.Box3().setFromObject(root),size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center)
    return {box,size,center,radius:Math.max(size.x,size.z)*.5}
  }
}
