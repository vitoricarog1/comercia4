/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Tipografia global seguindo as diretrizes
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // Hierarquia tipográfica consistente
        'h1': ['2rem', { lineHeight: '2.5rem', fontWeight: '700' }],     // 32px
        'h2': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],     // 24px
        'h3': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }], // 20px
        'body': ['1rem', { lineHeight: '1.5rem', fontWeight: '400' }],   // 16px
        'caption': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }], // 14px
      },
      colors: {
        // Sistema de cores para modo claro e escuro
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // Azul principal
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981', // Verde sucesso
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b', // Amarelo aviso
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444', // Vermelho erro
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Cores neutras para modo escuro
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      spacing: {
        // Espaçamentos consistentes
        '18': '4.5rem',   // 72px
        '88': '22rem',    // 352px
        '128': '32rem',   // 512px
      },
      borderRadius: {
        // Bordas arredondadas consistentes
        'xs': '0.125rem', // 2px
        'sm': '0.25rem',  // 4px
        'md': '0.375rem', // 6px
        'lg': '0.5rem',   // 8px
        'xl': '0.75rem',  // 12px
        '2xl': '1rem',    // 16px
      },
      boxShadow: {
        // Sombras consistentes
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'modal': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      animation: {
        // Animações suaves
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [
    // Plugin para tipografia aprimorada
    function({ addUtilities }) {
      const newUtilities = {
        '.text-h1': {
          fontSize: '2rem',
          lineHeight: '2.5rem',
          fontWeight: '700',
        },
        '.text-h2': {
          fontSize: '1.5rem',
          lineHeight: '2rem',
          fontWeight: '600',
        },
        '.text-h3': {
          fontSize: '1.25rem',
          lineHeight: '1.75rem',
          fontWeight: '600',
        },
        '.text-body': {
          fontSize: '1rem',
          lineHeight: '1.5rem',
          fontWeight: '400',
        },
        '.text-caption': {
          fontSize: '0.875rem',
          lineHeight: '1.25rem',
          fontWeight: '400',
        },
        // Botões consistentes
        '.btn-primary': {
          height: '2.5rem', // 40px
          paddingLeft: '1rem',
          paddingRight: '1rem',
          borderRadius: '0.375rem',
          backgroundColor: '#3b82f6',
          color: '#ffffff',
          fontWeight: '500',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: '#2563eb',
          },
          '&:focus': {
            outline: 'none',
            boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
          },
        },
        '.btn-secondary': {
          height: '2.5rem',
          paddingLeft: '1rem',
          paddingRight: '1rem',
          borderRadius: '0.375rem',
          backgroundColor: '#f8fafc',
          color: '#334155',
          border: '1px solid #e2e8f0',
          fontWeight: '500',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: '#f1f5f9',
          },
        },
        // Inputs consistentes
        '.input-field': {
          height: '2.5rem', // 40px
          paddingLeft: '0.75rem',
          paddingRight: '0.75rem',
          borderRadius: '0.375rem',
          border: '1px solid #d1d5db',
          backgroundColor: '#ffffff',
          fontSize: '1rem',
          transition: 'all 0.2s ease-in-out',
          '&:focus': {
            outline: 'none',
            borderColor: '#3b82f6',
            boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
          },
        },
        // Cards consistentes
        '.card': {
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          padding: '1rem',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
        },
      };
      addUtilities(newUtilities);
    },
  ],
};
