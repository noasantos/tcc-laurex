import {mkdirSync} from 'node:fs';
import {join,dirname,basename} from 'node:path';
import {Store,dataDirectory,defaultDataDirectory,atomic} from '../server/store';
import {readBackup,restoreBackup,verifyBackupByRestore} from '../server/recovery';
let store:Store|undefined;
try {
 const command=process.argv[2];
 if(command==='restore'){
  const file=process.argv[3];if(!file)throw new Error('Indique o caminho completo: npm run recover -- "caminho/backup.json"');
  readBackup(file);const original=dataDirectory();let recoveredDirectory:string|undefined;
  try{store=new Store(original);}catch{
   recoveredDirectory=join(dirname(original),basename(original)+'-recuperado-'+Date.now());
   store=new Store(recoveredDirectory);
  }
  const result=restoreBackup(store,file);
  if(recoveredDirectory&&!process.env.LAURA_DATA_DIR){mkdirSync(defaultDataDirectory(),{recursive:true});atomic(join(defaultDataDirectory(),'config.json'),JSON.stringify({dataDirectory:recoveredDirectory}));}
  console.log(JSON.stringify({...result,directory:store.root,originalPreserved:original,restartRequired:true},null,2));
 }else{
  store=new Store();
  if(command==='backup'){const file=store.backup();await verifyBackupByRestore(file);console.log('Backup restaurado em ambiente de verificação:',file);}
  else if(command==='verify'){readBackup(store.backup());for(const version of store.versions() as any[])store.version(version.id);console.log(JSON.stringify(store.verify(),null,2));}
  else throw new Error('Use backup, verify ou restore');
 }
}catch(e){console.error((e as Error).message);process.exitCode=1;}finally{store?.close();}
