import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {PGlite} from '@electric-sql/pglite';
const bundle=await build({entryPoints:['app/postgres-adapter.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {postgresSQL}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const db=new PGlite();
// postgres.js JSON-encodes string values inferred as jsonb, producing a scalar.
// The SQL parameter must be text, then explicitly parsed as a JSON array.
await db.exec('PREPARE layout_ids AS '+postgresSQL('SELECT value FROM json_each(?) allowed'));
const types=await db.query("SELECT parameter_types::text types FROM pg_prepared_statements WHERE name='layout_ids'");
assert.equal(types.rows[0].types,'{text}');
const out=await db.query(postgresSQL('SELECT value FROM json_each(?) allowed'),[JSON.stringify(['chair-1','chair-2'])]);
assert.deepEqual(out.rows.map(x=>x.value),['chair-1','chair-2']);
await db.close();console.log('PASS layout publication binds JSON lists as text before parsing, preventing driver double encoding');
