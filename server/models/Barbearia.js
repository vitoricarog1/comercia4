import { executeMainQuery } from '../config/database.js';

class Barbearia {
  // Criar agendamento
  static async createAgendamento(agendamentoData) {
    const {
      user_id,
      cliente,
      telefone,
      email,
      data,
      horario,
      servico,
      valor,
      observacoes,
      criado_por_ia = false
    } = agendamentoData;
    
    const query = `
      INSERT INTO agendamentos (
        user_id, cliente, telefone, email, data, horario, 
        servico, valor, observacoes, criado_por_ia, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')
    `;
    
    const values = [
      user_id, cliente, telefone, email, data, horario,
      servico, valor, observacoes, criado_por_ia
    ];
    
    const result = await executeMainQuery(query, values);
    return { id: result.insertId, ...agendamentoData };
  }

  // Buscar agendamentos por data
  static async findByDate(userId, data) {
    const query = `
      SELECT * FROM agendamentos 
      WHERE user_id = ? AND DATE(data) = ?
      ORDER BY horario ASC
    `;
    
    const result = await executeMainQuery(query, [userId, data]);
    return result;
  }

  // Buscar agendamentos por período
  static async findByPeriod(userId, dataInicio, dataFim) {
    const query = `
      SELECT * FROM agendamentos 
      WHERE user_id = ? AND data BETWEEN ? AND ?
      ORDER BY data ASC, horario ASC
    `;
    
    const result = await executeMainQuery(query, [userId, dataInicio, dataFim]);
    return result;
  }

  // Verificar disponibilidade de horário
  static async checkAvailability(userId, data, horario) {
    const query = `
      SELECT COUNT(*) as count FROM agendamentos 
      WHERE user_id = ? AND data = ? AND horario = ? 
      AND status IN ('confirmado', 'pendente')
    `;
    
    const result = await executeMainQuery(query, [userId, data, horario]);
    return result[0].count === 0;
  }

  // Atualizar agendamento
  static async update(id, userId, updates) {
    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) return null;

    values.push(id, userId);

    const query = `
      UPDATE agendamentos 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = ? AND user_id = ?
    `;

    await executeMainQuery(query, values);
    return await this.findById(id, userId);
  }

  // Buscar agendamento por ID
  static async findById(id, userId) {
    const query = `
      SELECT * FROM agendamentos 
      WHERE id = ? AND user_id = ?
    `;
    
    const result = await executeMainQuery(query, [id, userId]);
    return result[0];
  }

  // Deletar agendamento
  static async delete(id, userId) {
    const query = 'DELETE FROM agendamentos WHERE id = ? AND user_id = ?';
    const result = await executeMainQuery(query, [id, userId]);
    return result.affectedRows > 0;
  }

  // Obter estatísticas
  static async getStats(userId) {
    const queries = await Promise.all([
      executeMainQuery('SELECT COUNT(*) as total FROM agendamentos WHERE user_id = ?', [userId]),
      executeMainQuery('SELECT COUNT(*) as confirmados FROM agendamentos WHERE user_id = ? AND status = "confirmado"', [userId]),
      executeMainQuery('SELECT COUNT(*) as hoje FROM agendamentos WHERE user_id = ? AND DATE(data) = CURDATE()', [userId]),
      executeMainQuery('SELECT SUM(valor) as receita FROM agendamentos WHERE user_id = ? AND pago = true', [userId]),
      executeMainQuery(`
        SELECT DATE(data) as date, COUNT(*) as count 
        FROM agendamentos 
        WHERE user_id = ? AND data >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(data)
        ORDER BY date
      `, [userId])
    ]);

    return {
      total: parseInt(queries[0][0]?.total || 0),
      confirmados: parseInt(queries[1][0]?.confirmados || 0),
      hoje: parseInt(queries[2][0]?.hoje || 0),
      receita: parseFloat(queries[3][0]?.receita || 0),
      dailyBookings: queries[4]
    };
  }

  // Buscar horários disponíveis para uma data
  static async getAvailableSlots(userId, data, configuracao) {
    const { horarioFuncionamento, diasFolga } = configuracao;
    
    // Verificar se é dia de folga
    if (diasFolga.includes(data)) {
      return [];
    }

    // Buscar agendamentos existentes
    const agendamentos = await this.findByDate(userId, data);
    const horariosOcupados = agendamentos.map(a => a.horario);

    // Gerar horários disponíveis
    const horarios = [];
    const [horaInicio] = horarioFuncionamento.inicio.split(':').map(Number);
    const [horaFim] = horarioFuncionamento.fim.split(':').map(Number);

    for (let hora = horaInicio; hora < horaFim; hora++) {
      for (let minuto = 0; minuto < 60; minuto += 30) {
        const horario = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}:00`;
        
        if (!horariosOcupados.includes(horario)) {
          horarios.push(horario);
        }
      }
    }

    return horarios;
  }
}

export default Barbearia;