import Stripe from 'stripe';
import paypal from '@paypal/checkout-server-sdk';
import { executeMainQuery } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Stripe only if API key is provided
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// PayPal Environment Setup
const Environment = process.env.NODE_ENV === 'production' 
  ? paypal.core.LiveEnvironment 
  : paypal.core.SandboxEnvironment;

const paypalClient = (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) 
  ? new paypal.core.PayPalHttpClient(
      new Environment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      )
    )
  : null;

// Helper function to get subscription plans from database
async function getSubscriptionPlans() {
  try {
    const plans = await executeMainQuery(
      'SELECT * FROM subscription_plans WHERE active = 1 ORDER BY price ASC'
    );
    
    const plansObject = {};
    plans.forEach(plan => {
      plansObject[plan.slug] = {
        id: plan.id,
        name: plan.name,
        price: parseFloat(plan.price),
        features: JSON.parse(plan.features || '{}'),
        description: plan.description,
        billing_cycle: plan.billing_cycle
      };
    });
    
    return plansObject;
  } catch (error) {
    console.error('Erro ao buscar planos:', error);
    return {};
  }
}

class PaymentController {
  // Listar planos disponíveis
  static async getPlans(req, res) {
    try {
      const plans = await getSubscriptionPlans();
      
      res.json({
        success: true,
        data: { plans }
      });
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // Criar sessão de pagamento Stripe
  static async createStripeSession(req, res) {
    try {
      const { planId, userId } = req.body;
      const plans = await getSubscriptionPlans();
      const plan = plans[planId];
      
      if (!plan) {
        return res.status(400).json({
          success: false,
          error: 'Plano não encontrado'
        });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'brl',
            product_data: {
              name: plan.name,
              description: `Assinatura mensal - ${plan.name}`
            },
            unit_amount: Math.round(plan.price * 100),
            recurring: {
              interval: 'month'
            }
          },
          quantity: 1
        }],
        mode: 'subscription',
        success_url: `${process.env.FRONTEND_URL}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/billing?payment=cancelled`,
        client_reference_id: userId,
        metadata: {
          planId,
          userId
        }
      });

      // Salvar sessão no banco
      await db.query(
        'INSERT INTO payment_sessions (id, user_id, plan_id, provider, session_id, status, amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [uuidv4(), userId, planId, 'stripe', session.id, 'pending', plan.price]
      );

      res.json({
        success: true,
        data: { sessionUrl: session.url, sessionId: session.id }
      });
    } catch (error) {
      console.error('Erro ao criar sessão Stripe:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao processar pagamento'
      });
    }
  }

  // Criar pagamento PayPal
  static async createPayPalPayment(req, res) {
    try {
      const { planId, userId } = req.body;
      const plan = SUBSCRIPTION_PLANS[planId];
      
      if (!plan) {
        return res.status(400).json({
          success: false,
          error: 'Plano não encontrado'
        });
      }

      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'BRL',
            value: plan.price.toFixed(2)
          },
          description: `Assinatura ${plan.name}`
        }],
        application_context: {
          return_url: `${process.env.FRONTEND_URL}/dashboard?payment=success`,
          cancel_url: `${process.env.FRONTEND_URL}/billing?payment=cancelled`
        }
      });

      const order = await paypalClient.execute(request);
      const approvalUrl = order.result.links.find(link => link.rel === 'approve').href;

      // Salvar no banco
      await db.query(
        'INSERT INTO payment_sessions (id, user_id, plan_id, provider, session_id, status, amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [uuidv4(), userId, planId, 'paypal', order.result.id, 'pending', plan.price]
      );

      res.json({
        success: true,
        data: { approvalUrl, orderId: order.result.id }
      });
    } catch (error) {
      console.error('Erro ao criar pagamento PayPal:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao processar pagamento'
      });
    }
  }

  // Gerar código Pix
  static async createPixPayment(req, res) {
    try {
      const { planId, userId } = req.body;
      const plan = SUBSCRIPTION_PLANS[planId];
      
      if (!plan) {
        return res.status(400).json({
          success: false,
          error: 'Plano não encontrado'
        });
      }

      // Gerar código Pix (simulado - em produção usar API do banco)
      const pixCode = `00020126580014BR.GOV.BCB.PIX0136${process.env.PIX_KEY}0208${plan.name}5204000053039865802BR5925${process.env.COMPANY_NAME}6009SAO PAULO62070503***6304`;
      const pixId = uuidv4();

      // Salvar no banco
      await db.query(
        'INSERT INTO payment_sessions (id, user_id, plan_id, provider, session_id, status, amount, pix_code, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE), NOW())',
        [uuidv4(), userId, planId, 'pix', pixId, 'pending', plan.price, pixCode]
      );

      res.json({
        success: true,
        data: {
          pixCode,
          pixId,
          amount: plan.price,
          expiresIn: 30 * 60 * 1000 // 30 minutos em ms
        }
      });
    } catch (error) {
      console.error('Erro ao gerar Pix:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao gerar código Pix'
      });
    }
  }

  // Webhook Stripe
  static async stripeWebhook(req, res) {
    try {
      const sig = req.headers['stripe-signature'];
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      switch (event.type) {
        case 'checkout.session.completed':
          await PaymentController.handleStripeSuccess(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await PaymentController.handleStripeRenewal(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await PaymentController.handleStripeCancellation(event.data.object);
          break;
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Erro no webhook Stripe:', error);
      res.status(400).json({ error: 'Webhook error' });
    }
  }

  // Processar sucesso do Stripe
  static async handleStripeSuccess(session) {
    try {
      const userId = session.client_reference_id;
      const planId = session.metadata.planId;
      
      // Atualizar sessão de pagamento
      await executeMainQuery(
        'UPDATE payment_sessions SET status = "completed", completed_at = NOW() WHERE session_id = ?',
        [session.id]
      );

      // Atualizar plano do usuário
      await PaymentController.updateUserSubscription(userId, planId);
      
      // Registrar transação
      await executeMainQuery(
        'INSERT INTO transactions (id, user_id, plan_id, amount, provider, transaction_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [uuidv4(), userId, planId, session.amount_total / 100, 'stripe', session.id, 'completed']
      );

    } catch (error) {
      console.error('Erro ao processar sucesso Stripe:', error);
    }
  }

  // Atualizar assinatura do usuário
  static async updateUserSubscription(userId, planId) {
    try {
      const plan = SUBSCRIPTION_PLANS[planId];
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await executeMainQuery(
        'UPDATE users SET subscription_plan = ?, subscription_status = "active", subscription_expires_at = ?, updated_at = NOW() WHERE id = ?',
        [planId, expiresAt, userId]
      );

      // Atualizar limites do usuário
      await executeMainQuery(
        'UPDATE user_limits SET max_agents = ?, max_conversations = ?, max_whatsapp_sessions = ?, max_ai_requests = ?, updated_at = NOW() WHERE user_id = ?',
        [plan.features.agents, plan.features.conversations, plan.features.whatsapp_sessions, plan.features.ai_requests, userId]
      );

    } catch (error) {
      console.error('Erro ao atualizar assinatura:', error);
    }
  }

  // Verificar limites do usuário
  static async checkUserLimits(req, res) {
    try {
      const { userId } = req.params;
      
      const [userLimits] = await executeMainQuery(
        'SELECT * FROM user_limits WHERE user_id = ?',
        [userId]
      );

      const [usage] = await executeMainQuery(`
        SELECT 
          (SELECT COUNT(*) FROM agents WHERE user_id = ?) as agents_count,
          (SELECT COUNT(*) FROM conversations WHERE user_id = ? AND DATE(created_at) = CURDATE()) as conversations_today,
          (SELECT COUNT(*) FROM whatsapp_sessions WHERE user_id = ? AND status = 'active') as active_sessions,
          (SELECT COUNT(*) FROM ai_requests WHERE user_id = ? AND DATE(created_at) = CURDATE()) as ai_requests_today
      `, [userId, userId, userId, userId]);

      res.json({
        success: true,
        data: {
          limits: userLimits[0],
          usage: usage[0],
          canCreateAgent: usage[0].agents_count < userLimits[0].max_agents,
          canCreateConversation: usage[0].conversations_today < userLimits[0].max_conversations,
          canCreateWhatsAppSession: usage[0].active_sessions < userLimits[0].max_whatsapp_sessions,
          canMakeAIRequest: usage[0].ai_requests_today < userLimits[0].max_ai_requests
        }
      });
    } catch (error) {
      console.error('Erro ao verificar limites:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao verificar limites'
      });
    }
  }

  // Histórico de pagamentos
  static async getPaymentHistory(req, res) {
    try {
      const { userId } = req.params;
      
      const [transactions] = await executeMainQuery(
        'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
        [userId]
      );

      res.json({
        success: true,
        data: { transactions }
      });
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar histórico de pagamentos'
      });
    }
  }

  // Cancelar assinatura
  static async cancelSubscription(req, res) {
    try {
      const { userId } = req.body;
      
      await executeMainQuery(
        'UPDATE users SET subscription_status = "cancelled", updated_at = NOW() WHERE id = ?',
        [userId]
      );

      res.json({
        success: true,
        message: 'Assinatura cancelada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao cancelar assinatura'
      });
    }
  }
}

export default PaymentController;