import {AsyncLocalStorage} from 'node:async_hooks';
export const context=new AsyncLocalStorage<any>();
export const env=new Proxy({} as any,{get:(_,key)=>context.getStore()?.[key],set:(_,key,value)=>{const state=context.getStore();if(!state)throw Error('Missing request context');state[key]=value;return true}});
