import { zipSync, strToU8 } from "fflate";
import { mkdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { Store, atomic } from "./store";
import { verifyBackupByRestore } from "./recovery";
export async function createProjectArchive(store: Store) {
  const backup = store.backup();
  await verifyBackupByRestore(backup);
  const filename = `project-${randomUUID()}.zip`;
  const directory = join(store.root, "exports");
  mkdirSync(directory, { recursive: true });
  atomic(
    join(directory, filename),
    Buffer.from(
      zipSync({
        "workspace-backup.json": new Uint8Array(readFileSync(backup)),
        "LEIA-ME.txt": strToU8(
          "Backup completo do Laura Workspace: conteúdo, planejamento, comentários, notas, fontes originais, versões e registro de operações.\nPara recuperar, use npm run recover -- caminho/workspace-backup.json com o aplicativo encerrado. O estado anterior é preservado.\nO ZIP contém material acadêmico privado; compartilhe somente por decisão de Laura.\n",
        ),
      }),
    ),
  );
  return {
    filename,
    localPath: join(directory, filename),
    downloadUrl: `http://localhost:${process.env.PORT || 3000}/api/project-archives/${basename(filename)}`,
    contents:
      "Backup integral recuperável; fontes originais incluídas. O ZIP foi criado localmente, sem envio automático ao ChatGPT.",
  };
}
