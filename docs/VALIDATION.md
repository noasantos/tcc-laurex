# Evidências de validação

Validação local no macOS em 17/10/2026:

- `npm run build`: TypeScript e Vite aprovados. O editor é carregado sob demanda; o bundle do editor ainda gera aviso de tamanho, sem impedir o build.
- `npm test`: 19 testes aprovados, incluindo persistência, conflito, encerramento abrupto, restauração de backup, âncoras, LaTeX protegido, importação Word/ZIP, segurança HTTP, preparação assistida, ZIP integral, reinício do servidor e pesquisa.
- `npm run mcp:poc`: cliente e servidor reais do SDK, stdio, 47 ferramentas. Leitura, escrita, fontes, BibTeX, propostas e arquivo integral exercitados. Escrita sem autorização e aplicação sem aprovação recusadas; comentário não resolvido automaticamente. A consulta de runtime foi exercitada pelo MCP. O teste de runtime inicia um servidor real isolado, reutiliza-o e recusa projeto diferente na porta.
- Compilação de PDF real por Tectonic no ambiente local. Esse teste pode ser ignorado em máquinas sem compilador instalado.
- Navegador real em localhost: criação/edição/salvamento e reabertura; seleção de texto e comentário; formulário de referência inline; seletores de componente; temas claro/escuro/sistema; upload por seletor e rejeição de formato; pesquisa expansível no header, instruções sem consulta, ausência de resultado, fonte e comentário abertos por teclado.

A pesquisa normaliza acentos e consulta capítulos/conteúdo/planejamento, comentários/respostas, notas ativas e metadados de referências, sem enviar a consulta para a internet. Só o corpo dos resultados rola. As animações respeitam redução de movimento.

A interface não contém os antigos controles de exportação ou troca de proposta JSON. O prompt inicial pertence ao repositório; a interface oferece somente o pedido de reparo do MCP recolhido em Configurações → ChatGPT.

## Limites e aceitação externa

A prova de protocolo não certifica a conta ChatGPT Pro de Laura. Instalação do plugin, acesso no projeto existente, credenciais/associação do túnel e início automático na máquina de destino continuam dependendo dessa preparação única. Não foi afirmada nem executada uma alteração no projeto dela no ChatGPT. Reinício/login/suspensão do computador e reconexão do túnel precisam de aceitação real no destino.

Os scripts Windows e a matriz de CI estão incluídos. Uma execução de CI Windows, quando disponível, não substitui abrir o app e testar os launchers no PC de Laura. O drag-and-drop usa react-dropzone; o seletor de arquivo foi exercitado no navegador, sem afirmar que foi realizado um arraste a partir do gerenciador de arquivos do sistema.

Word permanece uma importação de texto, com original preservado. LaTeX complexo fica protegido quando não pode ser convertido com segurança. A formatação ABNT/UFRJ do projeto original não foi certificada por estes testes. Snapshots completos têm custo crescente com o histórico; a implementação ainda não equivale a um editor de documentos arbitrariamente grandes com carregamento paginado.

## Revisão de espaçamento

Veja [a auditoria com capturas e medições](SPACING_AUDIT.md). Padding horizontal corrigido em capítulos, métricas e linhas de lista; cards análogos e estados hover/foco revisados em dados temporários.
