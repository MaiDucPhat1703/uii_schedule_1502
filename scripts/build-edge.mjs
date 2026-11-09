import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';

await mkdir('supabase/functions/uii-api',{recursive:true});
await build({
  entryPoints:['supabase/edge-entry.ts'],
  outfile:'supabase/functions/uii-api/index.ts',
  bundle:true,
  format:'esm',
  platform:'neutral',
  target:'es2022',
  external:['npm:postgres@3.4.7','node:async_hooks'],
  legalComments:'none'
});
console.log('Đã bundle mã nguồn API mới nhất vào supabase/functions/uii-api/index.ts.');
