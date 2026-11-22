/** Keyless adapter tests: no live Host calls or session changes. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from '../node_modules-sibling/typescript/lib/typescript.js'

const source = await readFile(new URL('../src/client/composer-model.ts', import.meta.url), 'utf8')
const mockStore = `function createSnapshotStore(initial) {
 let state = initial; const listeners = new Set();
 return { getSnapshot: () => state, set: value => { state = value; for(const fn of listeners) fn() },
 subscribe: fn => {listeners.add(fn); return () => listeners.delete(fn)} };
}`
const js = ts.transpileModule(source.replace(/import \{ createSnapshotStore \} from '[^']+'/,mockStore), {
 compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { registerComposerModel } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
function fixture() {
 let state = {current:{provider:'test',model:'old'},groups:[],failures:[],status:'ready',pending:null,error:null,routable:true}
 const listeners = new Set(), disposers=[]
 const directory = {getSnapshot:()=>state, subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn)}}
 let registered, loads=0
 const native = {available:false,directory,load:()=>{throw Error('child native load forbidden')},select:()=>{throw Error('child native select forbidden')},resolveText:s=>s}
 const ctx = {
  inject:(_deps,fn)=>fn(ctx), effect:fn=>disposers.push(fn()),
  slots:{ inject:(_slot,fn)=>fn(), entries:()=>[{locale:'model',inject:()=>native,component:()=>null}],register:(options,component)=>{registered={...options,component};return ()=>{}}},
  sessions:{subagentAddress:id=>id==='child'?{parentSessionId:'root',mode:'continuable'}:undefined,scope:()=>ctx},
  remote:{session:{modelCatalog:async()=>{loads++;return {ok:true,value:{default:state.current,groups:[],failures:[]}}}}},
 }
 registerComposerModel(ctx)
 return {registered,directory, get loads(){return loads}, listeners, dispose:()=>disposers.forEach(fn=>fn?.()),
 update:next=>{state={...state,...next};for(const fn of listeners)fn()} }
}

test('only child uses adjacent composer entry; main native seat is untouched',t=>{
 const f=fixture();let catalogCalls=0
 t.mock.method(globalThis,'fetch',async url=>{assert.equal(url,'api/session/modelCatalog');catalogCalls++;return {ok:true,json:async()=>({result:{ok:true,value:{default:{provider:'test',model:'old'},groups:[],failures:[]}}})}})
 assert.equal(f.registered.name,'conversation.input.right')
 assert.equal(f.registered.inject('root').available,false)
 const child=f.registered.inject('child')
 assert.equal(child.available,true)
 child.load(); assert.equal(catalogCalls,1)
 assert.equal(f.registered.inject('child').directory,child.directory)
 assert.equal(child.renderSlot('conversation.input.model.label',{}, {fallback:'native label'}),'native label')
 f.dispose();assert.equal(f.listeners.size,0)
})

test('selection targets child only, tracks pending and follows durable projection',async t=>{
 const f=fixture(),child=f.registered.inject('child')
 let complete, sent
 t.mock.method(globalThis,'fetch',async(_url,options)=>{sent=JSON.parse(options.body);return await new Promise(resolve=>{complete=resolve})})
 const selection={provider:'test',model:'new',reasoningEffort:'high'}
 const pending=child.select(selection)
 assert.deepEqual(sent.payload.args.request,{sessionId:'child',parentSessionId:'root',...selection})
 assert.deepEqual(child.directory.getSnapshot().pending,selection)
 assert.equal(await child.select(selection),undefined)
 f.update({current:selection})
 complete({ok:true,json:async()=>({result:{ok:true,value:{applied:selection}}})})
 assert.equal((await pending).ok,true)
 assert.equal(child.directory.getSnapshot().pending,null)
 assert.deepEqual(child.directory.getSnapshot().current,selection)
 f.dispose()
})

test('host refusal and network errors remain visible without changing selection',async t=>{
 const f=fixture(),child=f.registered.inject('child'), before=child.directory.getSnapshot().current
 t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({result:{ok:false,error:{code:'not-live',message:'Child is not live'}}})}))
 assert.equal((await child.select({provider:'test',model:'new'})).ok,false)
 assert.equal(child.directory.getSnapshot().error,'Child is not live')
 assert.deepEqual(child.directory.getSnapshot().current,before)
 globalThis.fetch=async()=>{throw Error('offline')}
 assert.equal((await child.select({provider:'test',model:'new'})).ok,false)
 assert.match(child.directory.getSnapshot().error,/offline/)
 f.dispose()
})

test('disposed adapter ignores late selection completion',async t=>{
 const f=fixture(),child=f.registered.inject('child');let complete
 t.mock.method(globalThis,'fetch',async()=>await new Promise(resolve=>{complete=resolve}))
 const request=child.select({provider:'test',model:'new'})
 f.dispose();const snapshot=child.directory.getSnapshot()
 complete({ok:true,json:async()=>({result:{ok:true,value:{}}})})
 await request
 assert.equal(child.directory.getSnapshot(),snapshot)
 assert.equal(f.listeners.size,0)
})
