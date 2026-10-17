# Recuperar seu trabalho

## Se a interface abre

1. Abra Histórico. Compare a versão antiga com a atual.
2. Use Rever restauração. O app explica o que será restaurado.
3. Confirme. O estado atual é guardado antes, e a restauração gera uma nova versão.
4. Para recuperar um arquivo de backup completo, abra Configurações → Restaurar backup, selecione o arquivo e revise o resumo antes de confirmar.

Uma falha de salvamento mantém o rascunho no navegador. Use Rever rascunho ou volte a abrir o capítulo. Recuperar cria uma proposta; o texto mais recente não é sobrescrito automaticamente. Não limpe os dados do navegador enquanto houver um rascunho a recuperar.

## Se a interface não abre

Peça ajuda a um agente com acesso ao computador. Ele pode usar os comandos abaixo a partir da pasta da aplicação. Feche a aplicação e o túnel antes de uma restauração por terminal.

```sh
npm run verify
npm run backup
npm run recover -- "CAMINHO COMPLETO DO BACKUP.json"
```

O comando de backup faz verificação de checksum e estrutura. A restauração preserva o estado atual antes de substituir o estado ativo; incorpora o histórico de versões do backup e desliga acesso MCP. Nunca apague o banco para tentar resolver uma falha.

## Onde estão os dados

O caminho real aparece em Configurações e na mensagem de inicialização. Pastas iniciais: Windows `%LOCALAPPDATA%\LauraWorkspace`; macOS `~/Library/Application Support/LauraWorkspace`; Linux `~/.local/share/LauraWorkspace`.

- `workspace.sqlite`, `workspace.sqlite-wal`, `workspace.sqlite-shm`: banco ativo e arquivos de recuperação SQLite. Não copie apenas um deles enquanto o app estiver aberto.
- `academic/`: originais arquivados e cópias JSON de leitura dos capítulos. O original também fica no banco e nos backups.
- `backups/`: backups completos com checksum SHA-256. São separados do estado ativo e do repositório de código.
- `logs/mcp.jsonl`: metadados de operações, sem corpo dos textos nem credenciais.
- `config.json` na pasta inicial: seleção da pasta ativa, se foi alterada.

Para obter um backup consistente, use o comando ou a interface. Backups incluem documentos, notas, comentários, referências, fontes originais, metadados e versões. A verificação completa restaura o backup em outro banco temporário e compara o conteúdo.

## Prompt para pedir ajuda

> Meu Laura Workspace não está abrindo. Preserve meus dados atuais e quaisquer arquivos SQLite WAL/SHM. Leia docs/RECOVERY.md. Localize a pasta ativa e os backups, verifique os checksums e a integridade sem apagar nada. Se o banco estiver corrompido, restaure para uma pasta nova, mantendo a original intacta. Exporte os capítulos, notas e comentários recuperados e compare com o backup. Não declare recuperação concluída sem abrir e verificar os dados restaurados. Não publique meu conteúdo nem peça que eu cole credenciais no chat.

Backups locais não substituem uma cópia em outro dispositivo. A aplicação mantém todos por padrão; um prazo de retenção só passa a valer se você o configurar explicitamente.
