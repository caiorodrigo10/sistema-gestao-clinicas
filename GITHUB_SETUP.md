# Guia: Conectando o Projeto ao GitHub

Este guia mostra como conectar seu projeto atual ao GitHub e fazer o primeiro upload.

## Pré-requisitos

1. **Conta no GitHub**: Você precisará de uma conta ativa no GitHub
2. **Token de Acesso**: Para autenticação segura via linha de comando

## Passo 1: Criar Repositório no GitHub

1. Acesse [GitHub.com](https://github.com) e faça login
2. Clique no botão **"New"** ou **"+"** no canto superior direito
3. Selecione **"New repository"**
4. Configure o repositório:
   - **Repository name**: `sistema-gestao-clinicas` (ou o nome que preferir)
   - **Description**: `Sistema completo de gestão para clínicas médicas com agendamento inteligente`
   - **Visibility**: Escolha **Private** (recomendado) ou **Public**
   - **NÃO marque** "Add a README file" (já temos um)
   - **NÃO marque** "Add .gitignore" (já temos um)
   - **NÃO marque** "Choose a license"
5. Clique em **"Create repository"**

## Passo 2: Configurar Git Localmente

No terminal do Replit, execute os comandos:

```bash
# Configurar seu nome e email (use os mesmos da conta GitHub)
git config --global user.name "Seu Nome"
git config --global user.email "seu.email@exemplo.com"

# Verificar o status atual
git status
```

## Passo 3: Preparar os Arquivos

```bash
# Adicionar todos os arquivos ao controle de versão
git add .

# Fazer o primeiro commit
git commit -m "feat: Sistema completo de gestão de clínicas

- Sistema de agendamento com calendário inteligente
- Integração com Google Calendar
- Gestão completa de pacientes e prontuários
- Interface responsiva com React e TypeScript
- Backend com Node.js, Express e Supabase
- Autenticação segura e multi-tenant"
```

## Passo 4: Conectar ao Repositório GitHub

Substitua `SEU_USUARIO` e `NOME_DO_REPOSITORIO` pelos valores corretos:

```bash
# Adicionar o repositório remoto
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git

# Verificar se foi adicionado corretamente
git remote -v
```

## Passo 5: Fazer o Upload

```bash
# Fazer o push inicial
git push -u origin main
```

Se solicitado, use seu **username do GitHub** e um **Personal Access Token** como senha.

## Criando um Personal Access Token

Se você não tem um token de acesso:

1. Vá para GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Clique em **"Generate new token"** → **"Generate new token (classic)"**
3. Configure:
   - **Note**: "Token para Sistema Clínicas"
   - **Expiration**: 90 days (ou conforme preferir)
   - **Scopes**: Marque **"repo"** (acesso completo a repositórios)
4. Clique **"Generate token"**
5. **COPIE e SALVE** o token (não será mostrado novamente)

## Comandos para Futuras Atualizações

Para enviar mudanças futuras:

```bash
# Verificar mudanças
git status

# Adicionar arquivos modificados
git add .

# Fazer commit com mensagem descritiva
git commit -m "descrição das mudanças"

# Enviar para GitHub
git push
```

## Estrutura de Branches (Opcional)

Para projetos maiores, considere usar branches:

```bash
# Criar branch para nova funcionalidade
git checkout -b feature/nova-funcionalidade

# Trabalhar na funcionalidade...

# Fazer commits normalmente
git add .
git commit -m "feat: nova funcionalidade"

# Enviar branch para GitHub
git push -u origin feature/nova-funcionalidade

# No GitHub, criar Pull Request para merger na main
```

## Exemplo de Mensagens de Commit

Use o padrão conventional commits:

```bash
# Novas funcionalidades
git commit -m "feat: adicionar sistema de relatórios"

# Correções de bugs
git commit -m "fix: corrigir erro na validação de datas"

# Melhorias
git commit -m "refactor: otimizar consultas do banco de dados"

# Documentação
git commit -m "docs: atualizar README com instruções de deploy"

# Estilização
git commit -m "style: ajustar espaçamentos do calendário"
```

## Arquivos que Serão Ignorados

O `.gitignore` está configurado para ignorar:
- Arquivos de ambiente (`.env`)
- `node_modules`
- Arquivos temporários e de migração
- Assets anexados
- Logs e arquivos do sistema

## Verificação Final

Após o upload, verifique:
1. Acesse seu repositório no GitHub
2. Confirme que todos os arquivos estão lá
3. Verifique se o README.md está sendo exibido
4. Confirme que arquivos sensíveis (como `.env`) NÃO estão visíveis

## Problemas Comuns

### Erro de Autenticação
- Use Personal Access Token em vez da senha
- Verifique se o token tem permissões corretas

### Erro "repository not found"
- Verifique se o nome do repositório está correto
- Confirme que você tem acesso ao repositório

### Arquivo muito grande
- Verifique se não há arquivos grandes no projeto
- Use `git lfs` para arquivos grandes se necessário

## Próximos Passos

Após conectar ao GitHub:
1. Configure GitHub Actions para CI/CD (opcional)
2. Adicione badges ao README
3. Configure branch protection rules
4. Convide colaboradores se necessário