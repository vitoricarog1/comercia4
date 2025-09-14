import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { executeMainQuery } from '../config/database.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

// Middleware para verificar se é usuário da barbearia
const verificarUsuarioBarbearia = (req, res, next) => {
  const emailsPermitidos = ['barbearia@email.com', 'barbearia@barbearia.com', 'login@barbearia.com'];
  if (!emailsPermitidos.includes(req.user.email)) {
    return res.status(403).json({ 
      success: false, 
      error: 'Acesso negado. Apenas usuários da barbearia podem acessar esta funcionalidade.' 
    });
  }
  next();
};

// Aplicar middleware de autenticação e verificação em todas as rotas
router.use(authMiddleware);
router.use(verificarUsuarioBarbearia);

// GET /api/barbearia/agendamentos - Listar agendamentos
router.get('/agendamentos', async (req, res) => {
  try {
    const { data } = req.query;
    const dataFiltro = data || new Date().toISOString().split('T')[0];
    
    // Buscar agendamentos da data especificada ou do dia atual
    const query = `
      SELECT 
        id,
        cliente,
        telefone,
        email,
        data,
        horario,
        servico,
        valor,
        pago,
        metodo_pagamento,
        observacoes,
        status,
        created_at,
        updated_at
      FROM agendamentos 
      WHERE user_id = ? AND DATE(data) = ?
      ORDER BY horario ASC
    `;
    
    const agendamentos = await executeMainQuery(query, [req.user.id, dataFiltro]);
    
    // Formatar dados para o frontend
    const agendamentosFormatados = agendamentos.map(agendamento => ({
      id: agendamento.id,
      cliente: agendamento.cliente,
      telefone: agendamento.telefone,
      email: agendamento.email,
      servico: agendamento.servico,
      data: agendamento.data,
      horario: agendamento.horario,
      valor: parseFloat(agendamento.valor || 0),
      pago: Boolean(agendamento.pago),
      metodo_pagamento: agendamento.metodo_pagamento,
      observacoes: agendamento.observacoes,
      status: agendamento.status,
      created_at: agendamento.created_at,
      updated_at: agendamento.updated_at
    }));
    
    res.json({
      success: true,
      data: agendamentosFormatados
    });
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Listar conversas do agente da barbearia
router.get('/conversations', async (req, res) => {
  try {
    const agentId = req.query.agent_id || 7; // ID do agente da barbearia
    
    const query = `
      SELECT * FROM conversations 
      WHERE agent_id = ? 
      ORDER BY created_at DESC
    `;
    
    const rows = await executeMainQuery(query, [agentId]);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Erro ao buscar conversas:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// GET /api/barbearia/configuracao - Obter configurações
router.get('/configuracao', async (req, res) => {
  try {
    // Buscar configurações do agente da barbearia
    const query = `
      SELECT 
        name,
        description,
        system_prompt,
        model_config,
        whatsapp_config
      FROM agents 
      WHERE user_id = ?
      LIMIT 1
    `;
    
    const agente = await executeMainQuery(query, [req.user.id]);
    
    let configuracao = {
      whatsappApiKey: process.env.WHATSAPP_API_KEY || '',
      geminiApiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
      numeroWhatsapp: '',
      horarioFuncionamento: {
        inicio: '08:00',
        fim: '18:00'
      },
      diasFolga: []
    };
    
    if (agente.length > 0) {
      try {
        const whatsappConfig = JSON.parse(agente[0].whatsapp_config || '{}');
        const modelConfig = JSON.parse(agente[0].model_config || '{}');
        
        configuracao.numeroWhatsapp = whatsappConfig.phoneNumber || '';
        configuracao.horarioFuncionamento = modelConfig.horarioFuncionamento || configuracao.horarioFuncionamento;
        configuracao.diasFolga = modelConfig.diasFolga || [];
      } catch (e) {
        console.error('Erro ao parsear configurações:', e);
      }
    }
    
    res.json({
      success: true,
      data: configuracao
    });
  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Buscar agente específico
router.get('/agent/:id', async (req, res) => {
  try {
    const agentId = req.params.id;
    
    const query = `
      SELECT * FROM agents 
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `;
    
    const rows = await executeMainQuery(query, [agentId, req.user.id]);
    
    if (rows.length > 0) {
      res.json({ success: true, data: rows[0] });
    } else {
      res.status(404).json({ success: false, message: 'Agente não encontrado' });
    }
  } catch (error) {
    console.error('Erro ao buscar agente:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// POST /api/barbearia/configuracao - Salvar configurações
router.post('/configuracao', async (req, res) => {
  try {
    const { whatsappApiKey, geminiApiKey, numeroWhatsapp, horarioFuncionamento, diasFolga } = req.body;
    
    // Verificar se já existe um agente da barbearia
    let query = `
      SELECT id FROM agents 
      WHERE user_id = ?
      LIMIT 1
    `;
    
    let agente = await executeMainQuery(query, [req.user.id]);
    
    const whatsappConfig = {
      phoneNumber: numeroWhatsapp,
      apiKey: whatsappApiKey
    };
    
    const modelConfig = {
      model: 'gemini-pro',
      temperature: 0.7,
      maxTokens: 1000,
      horarioFuncionamento,
      diasFolga
    };
    
    const systemPrompt = `Você é um assistente virtual da barbearia especializado em agendamentos.

Horário de funcionamento: ${horarioFuncionamento.inicio} às ${horarioFuncionamento.fim}
Agendamentos disponíveis a cada 30 minutos.

Dias de folga: ${diasFolga.join(', ')}

Quando alguém solicitar agendamento:
1. Verifique se a data não está nos dias de folga
2. Verifique se o horário está dentro do funcionamento
3. Confirme horários disponíveis a cada 30 minutos
4. Se a data estiver em folga, responda: "Não estaremos trabalhando neste dia. Por favor, escolha outra data."
5. Para horários ocupados: "Este horário já está ocupado. Temos disponível: [listar próximos horários]"

Sempre seja cordial e profissional.`;
    
    if (agente.length > 0) {
      // Atualizar agente existente
      query = `
        UPDATE agents 
        SET 
          system_prompt = ?,
          model_config = ?,
          whatsapp_config = ?,
          updated_at = NOW()
        WHERE id = ?
      `;
      
      await executeMainQuery(query, [
        systemPrompt,
        JSON.stringify(modelConfig),
        JSON.stringify(whatsappConfig),
        agente[0].id
      ]);
    } else {
      // Criar novo agente
      query = `
        INSERT INTO agents (
          user_id, 
          name, 
          description, 
          system_prompt, 
          model_config, 
          whatsapp_config,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      await executeMainQuery(query, [
        req.user.id,
        'Agente Barbearia',
        'Agente especializado em agendamentos para barbearia',
        systemPrompt,
        JSON.stringify(modelConfig),
        JSON.stringify(whatsappConfig)
      ]);
    }
    
    res.json({
      success: true,
      message: 'Configurações salvas com sucesso'
    });
  } catch (error) {
    console.error('Erro ao salvar configuração:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Atualizar agente
router.put('/agent/:id', async (req, res) => {
  try {
    const agentId = req.params.id;
    const { whatsapp_config, model_config, phone_number } = req.body;
    
    const updateFields = [];
    const updateValues = [];
    
    if (whatsapp_config) {
      updateFields.push('whatsapp_config = ?');
      updateValues.push(whatsapp_config);
    }
    
    if (model_config) {
      updateFields.push('model_config = ?');
      updateValues.push(model_config);
    }
    
    if (phone_number) {
      updateFields.push('phone_number = ?');
      updateValues.push(phone_number);
    }
    
    if (updateFields.length > 0) {
      updateValues.push(agentId);
      updateValues.push(req.user.id);
      
      const query = `UPDATE agents SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;
      await executeMainQuery(query, updateValues);
    }
    
    res.json({ success: true, message: 'Agente atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar agente:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// POST /api/barbearia/agendamento - Processar novo agendamento via WhatsApp
router.post('/agendamento', async (req, res) => {
  try {
    const { phoneNumber, message, timestamp } = req.body;
    
    // Buscar configuração do agente
    const agenteQuery = `
      SELECT * FROM agents 
      WHERE user_id = ? AND name LIKE '%barbearia%'
      LIMIT 1
    `;
    
    const agente = await executeMainQuery(agenteQuery, [req.user.id]);
    
    if (agente.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agente da barbearia não configurado'
      });
    }
    
    const modelConfig = JSON.parse(agente[0].model_config || '{}');
    const { horarioFuncionamento, diasFolga } = modelConfig;
    
    // Verificar se é uma solicitação de agendamento
    const isAgendamento = /agend|horário|marcar|reservar/i.test(message);
    
    if (!isAgendamento) {
      return res.json({
        success: true,
        response: 'Olá! Para agendar um horário, me informe o dia e horário desejado.'
      });
    }
    
    // Extrair data e horário da mensagem
    const dataMatch = message.match(/(\d{1,2})\/(\d{1,2})|(hoje|amanhã)/);
    const horarioMatch = message.match(/(\d{1,2}:\d{2})|(\d{1,2})h/);
    
    if (!dataMatch || !horarioMatch) {
      return res.json({
        success: true,
        response: 'Por favor, informe a data e horário desejado. Exemplo: "Gostaria de agendar para 15/01 às 14:00"'
      });
    }
    
    // Processar data
    let dataAgendamento;
    if (dataMatch[0] === 'hoje') {
      dataAgendamento = new Date().toISOString().split('T')[0];
    } else if (dataMatch[0] === 'amanhã') {
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      dataAgendamento = amanha.toISOString().split('T')[0];
    } else {
      const dia = dataMatch[1];
      const mes = dataMatch[2];
      const ano = new Date().getFullYear();
      dataAgendamento = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    
    // Verificar se é dia de folga
    if (diasFolga.includes(dataAgendamento)) {
      return res.json({
        success: true,
        response: 'Não estaremos trabalhando neste dia. Por favor, escolha outra data.'
      });
    }
    
    // Processar horário
    let horarioAgendamento = horarioMatch[1] || `${horarioMatch[2]}:00`;
    
    // Verificar se está dentro do horário de funcionamento
    const [horaInicio] = horarioFuncionamento.inicio.split(':');
    const [horaFim] = horarioFuncionamento.fim.split(':');
    const [horaAgendamento] = horarioAgendamento.split(':');
    
    if (parseInt(horaAgendamento) < parseInt(horaInicio) || parseInt(horaAgendamento) >= parseInt(horaFim)) {
      return res.json({
        success: true,
        response: `Nosso horário de funcionamento é das ${horarioFuncionamento.inicio} às ${horarioFuncionamento.fim}. Por favor, escolha um horário dentro deste período.`
      });
    }
    
    // Verificar disponibilidade
    const disponibilidadeQuery = `
      SELECT COUNT(*) as total FROM messages 
      WHERE DATE(created_at) = ? 
        AND JSON_EXTRACT(metadata, '$.horario') = ?
        AND JSON_EXTRACT(metadata, '$.status') = 'confirmado'
    `;
    
    const ocupado = await executeMainQuery(disponibilidadeQuery, [dataAgendamento, horarioAgendamento]);
    
    if (ocupado[0].total > 0) {
      // Sugerir próximos horários disponíveis
      const proximosHorarios = [];
      let horaAtual = parseInt(horaAgendamento);
      
      for (let i = 0; i < 4; i++) {
        horaAtual += 0.5;
        if (horaAtual >= parseInt(horaFim)) break;
        
        const horarioSugestao = `${Math.floor(horaAtual).toString().padStart(2, '0')}:${horaAtual % 1 === 0.5 ? '30' : '00'}`;
        proximosHorarios.push(horarioSugestao);
      }
      
      return res.json({
        success: true,
        response: `Este horário já está ocupado. Temos disponível: ${proximosHorarios.join(', ')}`
      });
    }
    
    // Criar agendamento
    const conversationQuery = `
      INSERT INTO conversations (user_id, title, created_at, updated_at)
      VALUES (?, ?, NOW(), NOW())
    `;
    
    const conversationResult = await executeMainQuery(conversationQuery, [
      req.user.id,
      `Agendamento ${phoneNumber} - ${dataAgendamento}`
    ]);
    
    const conversationId = conversationResult.insertId;
    
    const messageQuery = `
      INSERT INTO messages (
        conversation_id,
        content,
        sender,
        phone_number,
        metadata,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const metadata = {
      tipo: 'agendamento',
      data: dataAgendamento,
      horario: horarioAgendamento,
      status: 'confirmado'
    };
    
    await executeMainQuery(messageQuery, [
      conversationId,
      `Agendamento confirmado para ${dataAgendamento} às ${horarioAgendamento}`,
      'user',
      phoneNumber,
      JSON.stringify(metadata),
      new Date(timestamp || Date.now())
    ]);
    
    res.json({
      success: true,
      response: `Agendamento confirmado para ${new Date(dataAgendamento).toLocaleDateString('pt-BR')} às ${horarioAgendamento}. Obrigado!`
    });
    
  } catch (error) {
    console.error('Erro ao processar agendamento:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// PUT /api/barbearia/agendamento/:id - Atualizar agendamento
router.put('/agendamento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, pago, metodo_pagamento, observacoes } = req.body;
    
    const updateFields = [];
    const updateValues = [];
    
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    
    if (pago !== undefined) {
      updateFields.push('pago = ?');
      updateValues.push(pago);
    }
    
    if (metodo_pagamento !== undefined) {
      updateFields.push('metodo_pagamento = ?');
      updateValues.push(metodo_pagamento);
    }
    
    if (observacoes !== undefined) {
      updateFields.push('observacoes = ?');
      updateValues.push(observacoes);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar'
      });
    }
    
    updateFields.push('updated_at = NOW()');
    updateValues.push(id, req.user.id);
    
    const query = `
      UPDATE agendamentos 
      SET ${updateFields.join(', ')}
      WHERE id = ? AND user_id = ?
    `;
    
    const result = await executeMainQuery(query, updateValues);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agendamento não encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Agendamento atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/barbearia/conversas - Listar conversas do WhatsApp
router.get('/conversas', async (req, res) => {
  try {
    const agentId = 7; // ID do agente da barbearia
    const query = `
      SELECT DISTINCT
        c.id,
        c.customer_phone as telefone,
        c.created_at,
        (
          SELECT m.content 
          FROM messages m 
          WHERE m.conversation_id = c.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as ultima_mensagem
      FROM conversations c
      WHERE c.agent_id = ?
      ORDER BY c.updated_at DESC
    `;
    
    const conversas = await executeMainQuery(query, [agentId]);
    
    res.json({
      success: true,
      data: conversas
    });
  } catch (error) {
    console.error('Erro ao buscar conversas:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// GET /api/barbearia/conversas/:id/mensagens - Buscar mensagens de uma conversa
router.get('/conversas/:id/mensagens', async (req, res) => {
  try {
    const conversaId = req.params.id;
    const agentId = 7; // ID do agente da barbearia
    
    const query = `
      SELECT 
        m.id,
        m.content as texto,
        m.sender_type as tipo,
        m.created_at as timestamp
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.id = ? AND c.agent_id = ?
      ORDER BY m.created_at ASC
    `;
    
    const mensagens = await executeMainQuery(query, [conversaId, agentId]);
    
    // Converter sender_type para o formato esperado pelo frontend
    const mensagensFormatadas = mensagens.map(msg => ({
      ...msg,
      tipo: msg.tipo === 'user' ? 'recebida' : 'enviada'
    }));
    
    res.json({
      success: true,
      data: mensagensFormatadas
    });
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// POST /api/barbearia/conversas/nova - Criar nova conversa
router.post('/conversas/nova', async (req, res) => {
  try {
    const { telefone } = req.body;
    const agentId = 7; // ID do agente da barbearia
    
    // Verificar se já existe uma conversa com este telefone
    let query = `
      SELECT id FROM conversations 
      WHERE agent_id = ? AND customer_phone = ?
      LIMIT 1
    `;
    
    let conversa = await executeMainQuery(query, [agentId, telefone]);
    
    if (conversa.length === 0) {
      // Criar nova conversa
      query = `
        INSERT INTO conversations (agent_id, customer_phone, channel_type, status, created_at, updated_at)
        VALUES (?, ?, 'whatsapp', 'active', NOW(), NOW())
      `;
      
      const result = await executeMainQuery(query, [agentId, telefone]);
      
      res.json({
        success: true,
        data: { id: result.insertId }
      });
    } else {
      res.json({
        success: true,
        data: { id: conversa[0].id }
      });
    }
  } catch (error) {
    console.error('Erro ao criar conversa:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// POST /api/barbearia/chat/enviar - Enviar mensagem e processar com Gemini
router.post('/chat/enviar', async (req, res) => {
  try {
    const { conversaId, mensagem } = req.body;
    const agentId = 7; // ID do agente da barbearia
    
    // Verificar se a conversa pertence ao agente
    let query = `
      SELECT id, customer_phone FROM conversations 
      WHERE id = ? AND agent_id = ?
      LIMIT 1
    `;
    
    const conversa = await executeMainQuery(query, [conversaId, agentId]);
    
    if (conversa.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversa não encontrada' });
    }
    
    // Salvar mensagem enviada
    query = `
      INSERT INTO messages (conversation_id, content, sender_type, created_at)
      VALUES (?, ?, 'assistant', NOW())
    `;
    
    await executeMainQuery(query, [conversaId, mensagem]);
    
    // Processar com Gemini para detectar agendamentos
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `
      Você é um assistente de uma barbearia. Analise a seguinte mensagem e determine se é uma solicitação de agendamento:
      
      Mensagem: "${mensagem}"
      
      Se for um agendamento, extraia as seguintes informações e responda APENAS em formato JSON:
      {
        "eh_agendamento": true,
        "cliente": "nome do cliente",
        "telefone": "${conversa[0].customer_phone}",
        "servico": "cabelo" ou "barba" ou "cabelo_barba",
        "data": "YYYY-MM-DD",
        "horario": "HH:MM",
        "valor": numero,
        "resposta": "mensagem de confirmação amigável"
      }
      
      Se NÃO for um agendamento, responda:
      {
        "eh_agendamento": false,
        "resposta": "resposta amigável e útil"
      }
      
      Horários disponíveis: 08:00 às 18:00
      Preços: Cabelo R$25, Barba R$15, Cabelo+Barba R$35
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    let geminiResponse;
    try {
      geminiResponse = JSON.parse(text);
    } catch (e) {
      geminiResponse = {
        eh_agendamento: false,
        resposta: "Desculpe, não consegui processar sua mensagem. Pode repetir?"
      };
    }
    
    let agendamentoCriado = null;
    
    // Se for um agendamento, salvar no banco
    if (geminiResponse.eh_agendamento) {
      try {
        query = `
          INSERT INTO agendamentos (
            user_id, cliente, telefone, email, servico, data, horario, 
            valor, pago, metodo_pagamento, status, created_at, updated_at
          ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 0, 'pendente', 'confirmado', NOW(), NOW())
        `;
        
        const agendamentoResult = await executeMainQuery(query, [
          1, // user_id fixo para barbearia
          geminiResponse.cliente,
          geminiResponse.telefone,
          geminiResponse.servico,
          geminiResponse.data,
          geminiResponse.horario,
          geminiResponse.valor
        ]);
        
        agendamentoCriado = {
          id: agendamentoResult.insertId,
          ...geminiResponse
        };
      } catch (error) {
        console.error('Erro ao criar agendamento:', error);
        geminiResponse.resposta = "Agendamento processado, mas houve um erro ao salvar. Entre em contato conosco.";
      }
    }
    
    // Salvar resposta do Gemini
    if (geminiResponse.resposta) {
      query = `
        INSERT INTO messages (conversation_id, content, sender_type, created_at)
        VALUES (?, ?, 'user', NOW())
      `;
      
      await executeMainQuery(query, [conversaId, geminiResponse.resposta]);
    }
    
    // Atualizar timestamp da conversa
    query = `UPDATE conversations SET updated_at = NOW() WHERE id = ?`;
    await executeMainQuery(query, [conversaId]);
    
    res.json({
      success: true,
      data: {
        resposta: geminiResponse.resposta,
        agendamento: agendamentoCriado
      }
    });
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

export default router;