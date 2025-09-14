import { AIProvider } from '../types';

export class AIService {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    const defaultProviders: AIProvider[] = [
      {
        id: 'chatgpt',
        name: 'ChatGPT (OpenAI)',
        type: 'chatgpt',
        models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
        isConfigured: false,
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        type: 'gemini',
        models: ['gemini-pro', 'gemini-pro-vision'],
        isConfigured: false,
      },
      {
        id: 'huggingface',
        name: 'Hugging Face',
        type: 'huggingface',
        models: ['microsoft/DialoGPT-large', 'facebook/blenderbot-400M-distill'],
        isConfigured: false,
      },
    ];

    defaultProviders.forEach(provider => {
      this.providers.set(provider.id, provider);
    });
  }

  getProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  configureProvider(providerId: string, config: { apiKey: string; model?: string }) {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.isConfigured = true;
      provider.apiKey = config.apiKey;
      provider.config = { ...provider.config, ...config };
      this.providers.set(providerId, provider);
    }
  }
}

export const getImplementationTutorial = () => {
  return {
    chatgpt: {
      title: "Como configurar ChatGPT (OpenAI)",
      steps: [
        "1. Crie uma conta em https://platform.openai.com/",
        "2. Gere uma API Key em https://platform.openai.com/api-keys",
        "3. Adicione OPENAI_API_KEY=sua-chave no arquivo .env",
        "4. Reinicie o servidor",
        "5. Teste a conexão criando um agente"
      ],
      documentation: "https://platform.openai.com/docs/api-reference",
    },
    gemini: {
      title: "Como configurar Google Gemini",
      steps: [
        "1. Acesse https://makersuite.google.com/app/apikey",
        "2. Crie um projeto no Google Cloud Console",
        "3. Ative a API Generative Language",
        "4. Gere uma API Key",
        "5. Adicione GOOGLE_GEMINI_API_KEY=sua-chave no .env"
      ],
      documentation: "https://ai.google.dev/docs",
    },
    huggingface: {
      title: "Como configurar Hugging Face",
      steps: [
        "1. Crie conta em https://huggingface.co/",
        "2. Vá para https://huggingface.co/settings/tokens",
        "3. Gere um Access Token",
        "4. Adicione HUGGINGFACE_API_KEY=sua-chave no .env",
        "5. Reinicie o servidor"
      ],
      documentation: "https://huggingface.co/docs/api-inference/index",
    },
  };
};

export const aiService = new AIService();