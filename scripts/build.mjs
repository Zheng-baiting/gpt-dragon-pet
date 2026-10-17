import fs from 'node:fs';
import path from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
const root=path.resolve(import.meta.dirname,'..');
fs.mkdirSync(path.join(root,'.generated'),{recursive:true});
for(const name of ['physics','displays','constants']){
  const source=fs.readFileSync(path.join(root,'vendor/dsh-pet',name+'.ts'),'utf8');
  const js=stripTypeScriptTypes(source).replace(/from '(.\/[^']+)'/g,(_,specifier)=>`from '${specifier}.js'`);
  fs.writeFileSync(path.join(root,'.generated',name+'.js'),js);
}
console.log('Prepared the MIT-licensed dsh-pet physics modules.');
