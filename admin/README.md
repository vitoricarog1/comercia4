# Painel Administrativo - Dinâmica

## Descrição

Este é o painel administrativo separado do sistema Dinâmica, destinado exclusivamente ao proprietário do software.

## Como Acessar

1. **Via Servidor Web Local:**
   - Abra o arquivo `index.html` diretamente no navegador
   - Ou configure um servidor web para servir esta pasta

2. **Via Live Server (Recomendado):**
   - Use a extensão Live Server do VS Code
   - Clique com o botão direito no arquivo `index.html`
   - Selecione "Open with Live Server"

3. **Via Servidor HTTP Simples:**
   ```bash
   # Na pasta admin
   python -m http.server 8080
   # Ou
   npx serve .
   ```

## Credenciais de Acesso

Para acessar o painel administrativo, use as credenciais de um usuário com role 'admin' cadastrado no sistema.

**Exemplo de usuário admin (se não existir, crie via banco de dados):**
- Email: admin@aiagents.com
- Senha: admin123
- Role: admin

## Funcionalidades

- ✅ Dashboard com estatísticas do sistema
- ✅ Visualização de todos os usuários
- ✅ Exclusão de usuários (exceto admins)
- ✅ Autenticação segura
- ✅ Auto-refresh dos dados
- 🔄 Edição de usuários (em desenvolvimento)
- 🔄 Gerenciamento de agentes (em desenvolvimento)
- 🔄 Logs de auditoria (em desenvolvimento)

## Estrutura dos Arquivos

```
admin/
├── index.html      # Interface principal
├── admin.js        # Lógica JavaScript
└── README.md       # Este arquivo
```

## Segurança

- O painel verifica se o usuário tem role 'admin'
- Token de autenticação armazenado localmente
- Logout automático em caso de token inválido
- Acesso restrito apenas a administradores

## Notas Importantes

1. **Separação Completa:** Este painel é completamente independente do frontend principal
2. **Acesso Restrito:** Apenas usuários com role 'admin' podem acessar
3. **Não Aparece no Frontend:** Nenhuma referência a este painel existe no frontend principal
4. **Proprietário Exclusivo:** Destinado apenas ao dono do software

## Próximos Passos

- Implementar edição completa de usuários
- Adicionar gerenciamento de agentes
- Incluir logs de auditoria
- Adicionar relatórios avançados
- Implementar backup/restore de dados