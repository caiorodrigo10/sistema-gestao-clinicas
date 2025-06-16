# TaskMed

Sistema completo de gestão para clínicas médicas e psicológicas com agendamento inteligente, prontuários eletrônicos e integração com Google Calendar.

## 🚀 Funcionalidades

### Gestão de Consultas
- **Calendário Inteligente**: Visualização semanal/mensal com slots de 15 minutos
- **Agendamento Flexível**: Permite agendamentos fora do horário comercial com avisos
- **Integração Google Calendar**: Sincronização bidirecional automática
- **Avisos Contextuais**: Sistema unificado de notificações ("Horário livre, mas é domingo")

### Gestão de Pacientes
- **Cadastro Completo**: Dados pessoais, contatos e informações médicas
- **Prontuários Eletrônicos**: Histórico médico digital completo
- **Busca Avançada**: Localização rápida por nome, telefone ou email

### Funcionalidades Técnicas
- **Autenticação Segura**: Sistema baseado em Supabase Auth
- **Multi-tenant**: Suporte a múltiplas clínicas
- **Tempo Real**: Atualizações instantâneas via WebSocket
- **Responsivo**: Interface adaptada para desktop e mobile

## 🛠️ Stack Tecnológica

### Frontend
- **React 18** com TypeScript
- **Tailwind CSS** para estilização
- **Shadcn/ui** para componentes
- **TanStack Query** para gerenciamento de estado
- **React Hook Form** com validação Zod
- **Date-fns** para manipulação de datas

### Backend
- **Node.js** com Express
- **Supabase** como banco de dados e autenticação
- **Drizzle ORM** para queries type-safe
- **Google Calendar API** para sincronização
- **PostgreSQL** com Row Level Security (RLS)

### DevOps
- **Vite** para build e desenvolvimento
- **TypeScript** para type safety
- **ESLint** para qualidade de código

## 📦 Instalação

1. Clone o repositório:
```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd sistema-clinica
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Configure o Supabase:
- Crie um projeto no [Supabase](https://supabase.com)
- Adicione as credenciais no arquivo `.env`
- Execute as migrações do banco

5. Configure Google Calendar API:
- Crie um projeto no Google Cloud Console
- Ative a Calendar API
- Configure OAuth 2.0
- Adicione credenciais no `.env`

6. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

## ⚙️ Configuração

### Variáveis de Ambiente Necessárias

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Calendar
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Database
DATABASE_URL=your_database_url
```

## 🚀 Deploy

O sistema está configurado para deploy no Replit, mas pode ser facilmente adaptado para:
- Vercel
- Netlify
- Railway
- Heroku

## 📚 Documentação

### Estrutura do Projeto
```
├── client/          # Frontend React
│   ├── src/
│   │   ├── components/  # Componentes reutilizáveis
│   │   ├── pages/       # Páginas da aplicação
│   │   └── lib/         # Utilitários e configurações
├── server/          # Backend Express
├── shared/          # Tipos e schemas compartilhados
└── migrations/      # Migrações do banco de dados
```

### Principais Funcionalidades

1. **Sistema de Agendamento**
   - Slots de 15 minutos com duração configurável
   - Validação de horários comerciais
   - Suporte a agendamentos excepcionais

2. **Integração Google Calendar**
   - Sincronização automática de eventos
   - Criação de eventos no Google Calendar
   - Detecção de conflitos

3. **Gestão de Clínicas**
   - Configuração de horários de funcionamento
   - Gestão de usuários e permissões
   - Relatórios e estatísticas

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## ✨ Autor

Desenvolvido por Caio Rodrigo