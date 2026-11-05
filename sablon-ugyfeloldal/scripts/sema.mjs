// JSON Schema készítése a Zod-sémából, hogy a VS Code kiegészítse és
// aláhúzza az uzlet.json mezőit szerkesztés közben.
//   npm run sema
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { uzletSema } from '../src/config/schema.ts';

const sema = z.toJSONSchema(uzletSema, { io: 'input', unrepresentable: 'any' });
sema.title = 'Folyam ügyféloldal – uzlet.json';
writeFileSync(new URL('../uzlet.schema.json', import.meta.url), JSON.stringify(sema, null, 2) + '\n');
console.log('uzlet.schema.json elkészült.');
