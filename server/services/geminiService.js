import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeMainQuery } from '../config/database.js';
import Barbearia from '../models/Barbearia.js';

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  // Processar mensagem de agendamento
  async processAgendamento(mensagem, telefone, userId) {
    try {
      // Buscar configuração da barbearia
      const configQuery = `
        SELECT model_config FROM agents 
        WHERE user_id = ? AND name LIKE '%barbearia%'
        LIMIT 1
      `;
      
      const configResult = await executeMainQuery(configQuery, [userId]);
      let configuracao = {
        horarioFuncionamento: { inicio: '08:00', fim: '18:00' },
        diasFolga: [],
        servicos: {
          'cabelo': { nome: 'Corte de Cabelo', preco: 25.00 },
          'barba': { nome: 'Barba', preco: 15.00 },
          'cabelo_barba': { nome: 'Cabelo + Barba', preco: 35.00 }
        }
      };

      if (configResult.length > 0 && configResult[0].model_config) {
        try {
          const modelConfig = JSON.parse(configResult[0].model_config);
          configuracao = { ...configuracao, ...modelConfig };
        } catch (e) {
          console.error('Erro ao parsear configuração:', e);
        }
      }

      // Prompt para o Gemini
      const prompt = `
Você é um assistente de agendamento para uma barbearia. Analise a mensagem do cliente e responda APENAS em formato JSON.

CONFIGURAÇÃO DA BARBEARIA:
- Horário: ${configuracao.horarioFuncionamento.inicio} às ${configuracao.horarioFuncionamento.fim}
- Dias de folga: ${configuracao.diasFolga.join(', ') || 'Nenhum'}
- Serviços disponíveis:
  * Corte de Cabelo: R$ ${configuracao.servicos.cabelo.preco}
  * Barba: R$ ${configuracao.servicos.barba.preco}
  * Cabelo + Barba: R$ ${configuracao.servicos.cabelo_barba.preco}

MENSAGEM DO CLIENTE: "${mensagem}"
TELEFONE: ${telefone}

INSTRUÇÕES:
1. Se for uma solicitação de agendamento, extraia: nome, serviço, data, horário
2. Verifique se a data não está nos dias de folga
3. Verifique se o horário está dentro do funcionamento
4. Responda APENAS em JSON no formato:

Para AGENDAMENTO:
{
  "tipo": "agendamento",
  "dados": {
    "cliente": "nome extraído",
    "servico": "cabelo" | "barba" | "cabelo_barba",
    "data": "YYYY-MM-DD",
    "horario": "HH:MM:00",
    "valor": numero
  },
  "resposta": "mensagem de confirmação amigável"
}

Para CONSULTA ou OUTRAS MENSAGENS:
{
  "tipo": "consulta",
  "resposta": "resposta útil e amigável"
}

Para ERRO (data em folga, horário fora do funcionamento):
{
  "tipo": "erro",
  "motivo": "dia_folga" | "horario_invalido" | "dados_incompletos",
  "resposta": "explicação do problema e sugestões"
}
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      let geminiResponse;
      try {
        geminiResponse = JSON.parse(text);
      } catch (e) {
        console.error('Erro ao parsear resposta do Gemini:', e);
        return {
          tipo: 'erro',
          resposta: 'Desculpe, não consegui processar sua mensagem. Pode repetir?'
        };
      }

      // Se for um agendamento válido, verificar disponibilidade
      if (geminiResponse.tipo === 'agendamento') {
        const { data, horario } = geminiResponse.dados;
        
        const disponivel = await Barbearia.checkAvailability(userId, data, horario);
        
        if (!disponivel) {
          // Buscar próximos horários disponíveis
          const horariosDisponiveis = await Barbearia.getAvailableSlots(userId, data, configuracao);
          
          return {
            tipo: 'erro',
            motivo: 'horario_ocupado',
            resposta: `Este horário já está ocupado. Horários disponíveis: ${horariosDisponiveis.slice(0, 3).join(', ')}`
          };
        }

        // Criar agendamento
        try {
          const agendamento = await Barbearia.createAgendamento({
            user_id: userId,
            cliente: geminiResponse.dados.cliente,
            telefone: telefone,
            data: geminiResponse.dados.data,
            horario: geminiResponse.dados.horario,
            servico: geminiResponse.dados.servico,
            valor: geminiResponse.dados.valor,
            criado_por_ia: true,
            status: 'confirmado'
          });

          return {
            tipo: 'agendamento',
            agendamento: agendamento,
            resposta: `✅ Agendamento confirmado!\n\nCliente: ${geminiResponse.dados.cliente}\nServiço: ${configuracao.servicos[geminiResponse.dados.servico].nome}\nData: ${new Date(geminiResponse.dados.data).toLocaleDateString('pt-BR')}\nHorário: ${geminiResponse.dados.horario.substring(0, 5)}\nValor: R$ ${geminiResponse.dados.valor.toFixed(2)}\n\nObrigado pela preferência!`
          };
        } catch (error) {
          console.error('Erro ao criar agendamento:', error);
          return {
            tipo: 'erro',
            resposta: 'Agendamento processado, mas houve um erro ao salvar. Entre em contato conosco.'
          };
        }
      }

      return geminiResponse;
    } catch (error) {
      console.error('Erro no Gemini Service:', error);
      return {
        tipo: 'erro',
        resposta: 'Desculpe, estou com dificuldades técnicas. Tente novamente em alguns instantes.'
      };
    }
  }

  // Buscar informações na base de conhecimento
  async searchKnowledge(query, userId) {
    try {
      const knowledgeQuery = `
        SELECT title, content, category 
        FROM knowledge_base 
        WHERE is_active = true 
        AND (MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE)
             OR title LIKE ? OR content LIKE ?)
        ORDER BY 
          MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE) DESC
        LIMIT 5
      `;
      
      const searchTerm = `%${query}%`;
      const results = await executeMainQuery(knowledgeQuery, [query, searchTerm, searchTerm, query]);
      
      return results;
    } catch (error) {
      console.error('Erro ao buscar conhecimento:', error);
      return [];
    }
  }

  // Gerar resposta com RAG
  async generateWithRAG(mensagem, telefone, userId) {
    try {
      // Buscar conhecimento relevante
      const knowledge = await this.searchKnowledge(mensagem, userId);
      
      let contextPrompt = '';
      if (knowledge.length > 0) {
        const context = knowledge.map(k => `${k.title}: ${k.content}`).join('\n\n');
        contextPrompt = `\n\nCONTEXTO DA BASE DE CONHECIMENTO:\n${context}\n\nUse essas informações quando relevante.`;
      }

      // Processar com contexto adicional
      const prompt = `
Você é um assistente de agendamento para uma barbearia. ${contextPrompt}

Mensagem do cliente: "${mensagem}"
Telefone: ${telefone}

Responda de forma natural e útil, usando o contexto quando apropriado.
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return {
        tipo: 'resposta',
        resposta: response.text()
      };
    } catch (error) {
      console.error('Erro no RAG:', error);
      return {
        tipo: 'erro',
        resposta: 'Desculpe, não consegui processar sua mensagem no momento.'
      };
    }
  }
}

export default new GeminiService();