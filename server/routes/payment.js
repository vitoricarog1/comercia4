import express from 'express';
import PaymentController from '../controllers/paymentController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Rotas públicas (webhooks)
router.post('/webhook/stripe', express.raw({type: 'application/json'}), PaymentController.stripeWebhook);

// Rotas protegidas
router.use(authMiddleware);

// Listar planos disponíveis
router.get('/plans', PaymentController.getPlans);

// Criar sessões de pagamento
router.post('/stripe/create-session', PaymentController.createStripeSession);
router.post('/paypal/create-payment', PaymentController.createPayPalPayment);
router.post('/pix/create-payment', PaymentController.createPixPayment);

// Verificar limites do usuário
router.get('/limits/:userId', PaymentController.checkUserLimits);

// Histórico de pagamentos
router.get('/history/:userId', PaymentController.getPaymentHistory);

// Cancelar assinatura
router.post('/cancel-subscription', PaymentController.cancelSubscription);

// Middleware de tratamento de erros específico para pagamentos
router.use((error, req, res, next) => {
  console.error('Erro nas rotas de pagamento:', error);
  
  // Erros específicos de pagamento
  if (error.type === 'StripeCardError') {
    return res.status(400).json({
      success: false,
      error: 'Erro no cartão de crédito: ' + error.message
    });
  }
  
  if (error.type === 'StripeInvalidRequestError') {
    return res.status(400).json({
      success: false,
      error: 'Dados de pagamento inválidos'
    });
  }
  
  // Erro genérico
  res.status(500).json({
    success: false,
    error: 'Erro interno no sistema de pagamentos'
  });
});

export default router;