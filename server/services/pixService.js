import QRCode from 'qrcode';
import crypto from 'crypto';

class PixService {
  constructor() {
    this.merchantId = process.env.PIX_MERCHANT_ID || '12345678901';
    this.merchantName = process.env.PIX_MERCHANT_NAME || 'Dinamica SaaS';
    this.merchantCity = process.env.PIX_MERCHANT_CITY || 'Sao Paulo';
    this.pixKey = process.env.PIX_KEY || 'contato@dinamica.com';
  }

  // Gerar código PIX EMV
  generatePixCode(amount, description = '', txId = null) {
    if (!txId) {
      txId = crypto.randomBytes(16).toString('hex').substring(0, 25);
    }

    // Formatação do valor (sempre com 2 casas decimais)
    const formattedAmount = parseFloat(amount).toFixed(2);

    // Construção do payload PIX EMV
    const payload = this.buildPixPayload({
      pixKey: this.pixKey,
      description,
      merchantName: this.merchantName,
      merchantCity: this.merchantCity,
      txId,
      amount: formattedAmount
    });

    return {
      pixCode: payload,
      txId,
      amount: formattedAmount,
      qrCodeData: payload
    };
  }

  // Construir payload PIX EMV
  buildPixPayload({ pixKey, description, merchantName, merchantCity, txId, amount }) {
    // Payload Format Indicator
    let payload = '000201';

    // Point of Initiation Method
    payload += '010212';

    // Merchant Account Information
    const pixKeyLength = pixKey.length.toString().padStart(2, '0');
    const pixKeyData = `0014br.gov.bcb.pix01${pixKeyLength}${pixKey}`;
    const pixKeyDataLength = pixKeyData.length.toString().padStart(2, '0');
    payload += `26${pixKeyDataLength}${pixKeyData}`;

    // Merchant Category Code
    payload += '52040000';

    // Transaction Currency (BRL)
    payload += '5303986';

    // Transaction Amount
    if (amount && parseFloat(amount) > 0) {
      const amountLength = amount.length.toString().padStart(2, '0');
      payload += `54${amountLength}${amount}`;
    }

    // Country Code
    payload += '5802BR';

    // Merchant Name
    const merchantNameLength = merchantName.length.toString().padStart(2, '0');
    payload += `59${merchantNameLength}${merchantName}`;

    // Merchant City
    const merchantCityLength = merchantCity.length.toString().padStart(2, '0');
    payload += `60${merchantCityLength}${merchantCity}`;

    // Additional Data Field Template
    if (txId || description) {
      let additionalData = '';
      
      if (txId) {
        const txIdLength = txId.length.toString().padStart(2, '0');
        additionalData += `05${txIdLength}${txId}`;
      }
      
      if (description) {
        const descLength = description.substring(0, 72).length.toString().padStart(2, '0');
        additionalData += `02${descLength}${description.substring(0, 72)}`;
      }
      
      const additionalDataLength = additionalData.length.toString().padStart(2, '0');
      payload += `62${additionalDataLength}${additionalData}`;
    }

    // CRC16
    payload += '6304';
    const crc = this.calculateCRC16(payload);
    payload += crc;

    return payload;
  }

  // Calcular CRC16
  calculateCRC16(payload) {
    const polynomial = 0x1021;
    let crc = 0xFFFF;

    for (let i = 0; i < payload.length; i++) {
      crc ^= (payload.charCodeAt(i) << 8);
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ polynomial;
        } else {
          crc <<= 1;
        }
        crc &= 0xFFFF;
      }
    }

    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  // Gerar QR Code
  async generateQRCode(pixCode, options = {}) {
    const defaultOptions = {
      type: 'png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    };

    const qrOptions = { ...defaultOptions, ...options };

    try {
      const qrCodeDataURL = await QRCode.toDataURL(pixCode, qrOptions);
      return qrCodeDataURL;
    } catch (error) {
      throw new Error(`Erro ao gerar QR Code: ${error.message}`);
    }
  }

  // Validar código PIX
  validatePixCode(pixCode) {
    if (!pixCode || typeof pixCode !== 'string') {
      return false;
    }

    // Verificar se tem o tamanho mínimo
    if (pixCode.length < 44) {
      return false;
    }

    // Verificar se começa com o formato correto
    if (!pixCode.startsWith('000201')) {
      return false;
    }

    // Verificar CRC
    const payloadWithoutCRC = pixCode.substring(0, pixCode.length - 4);
    const providedCRC = pixCode.substring(pixCode.length - 4);
    const calculatedCRC = this.calculateCRC16(payloadWithoutCRC + '6304');

    return providedCRC === calculatedCRC;
  }

  // Extrair informações do código PIX
  parsePixCode(pixCode) {
    if (!this.validatePixCode(pixCode)) {
      throw new Error('Código PIX inválido');
    }

    const data = {};
    let position = 0;

    while (position < pixCode.length - 4) {
      const id = pixCode.substring(position, position + 2);
      const length = parseInt(pixCode.substring(position + 2, position + 4));
      const value = pixCode.substring(position + 4, position + 4 + length);

      switch (id) {
        case '54':
          data.amount = parseFloat(value);
          break;
        case '59':
          data.merchantName = value;
          break;
        case '60':
          data.merchantCity = value;
          break;
        case '62':
          // Additional data - parse nested fields
          data.additionalData = this.parseAdditionalData(value);
          break;
      }

      position += 4 + length;
    }

    return data;
  }

  // Parse additional data fields
  parseAdditionalData(additionalData) {
    const data = {};
    let position = 0;

    while (position < additionalData.length) {
      const id = additionalData.substring(position, position + 2);
      const length = parseInt(additionalData.substring(position + 2, position + 4));
      const value = additionalData.substring(position + 4, position + 4 + length);

      switch (id) {
        case '05':
          data.txId = value;
          break;
        case '02':
          data.description = value;
          break;
      }

      position += 4 + length;
    }

    return data;
  }

  // Simular verificação de pagamento PIX (em produção, integrar com API do banco)
  async checkPixPayment(txId) {
    // Esta é uma simulação - em produção, você integraria com a API do seu banco
    // ou provedor de pagamentos PIX
    
    // Simular delay de verificação
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simular status aleatório para demonstração
    const statuses = ['pending', 'completed', 'failed'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
      txId,
      status: randomStatus,
      paidAt: randomStatus === 'completed' ? new Date() : null,
      amount: null // Seria retornado pela API do banco
    };
  }

  // Gerar dados completos para pagamento PIX
  async createPixPayment(amount, description, planId) {
    const txId = `PIX_${planId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const pixData = this.generatePixCode(amount, description, txId);
    const qrCodeImage = await this.generateQRCode(pixData.pixCode);
    
    return {
      ...pixData,
      qrCodeImage,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutos
      description,
      planId
    };
  }
}

export default new PixService();