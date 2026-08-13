// MedBot Embed Widget v1.0
// Usage:
// <script
//   src="https://embed.medbot.ng/v1.js"
//   data-tenant="clinic_public_id"
//   data-theme="light"
//   data-locale="en-NG">
// </script>

(function() {
  'use strict';

  const CONFIG = {
    tenantId: null,
    theme: 'light',
    locale: 'en-NG',
    position: 'bottom-right',
    primaryColor: '#00A8A8',
    secondaryColor: '#073B4C',
    welcomeMessage: 'Hello! How can I help you today?',
    title: 'Medical Triage',
    subtitle: 'AI-powered health assessment',
    apiUrl: '',
  };

  // Parse script tag attributes
  function parseConfig() {
    const script = document.currentScript || document.querySelector('script[data-tenant]');
    if (!script) return;

    CONFIG.tenantId = script.getAttribute('data-tenant');
    CONFIG.theme = script.getAttribute('data-theme') || CONFIG.theme;
    CONFIG.locale = script.getAttribute('data-locale') || CONFIG.locale;
    CONFIG.position = script.getAttribute('data-position') || CONFIG.position;
    CONFIG.primaryColor = script.getAttribute('data-primary-color') || CONFIG.primaryColor;
    CONFIG.secondaryColor = script.getAttribute('data-secondary-color') || CONFIG.secondaryColor;
    CONFIG.welcomeMessage = script.getAttribute('data-welcome') || CONFIG.welcomeMessage;
    CONFIG.title = script.getAttribute('data-title') || CONFIG.title;
    CONFIG.subtitle = script.getAttribute('data-subtitle') || CONFIG.subtitle;
    CONFIG.apiUrl = script.getAttribute('data-api-url') || window.location.origin;
  }

  // Create the widget container
  function createWidget() {
    const container = document.createElement('div');
    container.id = 'medbot-widget';
    container.innerHTML = `
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" />
      <style>
        #medbot-widget {
          position: fixed;
          ${CONFIG.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;'}
          bottom: 20px;
          z-index: 9999;
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        #medbot-widget * {
          box-sizing: border-box;
        }
        
        .medbot-fab {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: ${CONFIG.primaryColor};
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .medbot-fab:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }
        
        .medbot-fab svg {
          width: 28px;
          height: 28px;
        }
        
        .medbot-window {
          display: none;
          position: absolute;
          ${CONFIG.position === 'bottom-left' ? 'left: 0;' : 'right: 0;'}
          bottom: 70px;
          width: 380px;
          height: 560px;
          background: ${CONFIG.theme === 'dark' ? '#1a1a1a' : 'white'};
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          flex-direction: column;
        }
        
        .medbot-window.open {
          display: flex;
        }
        
        .medbot-header {
          background: ${CONFIG.secondaryColor};
          color: white;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .medbot-header-logo {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .medbot-header-text h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .medbot-header-text p {
          margin: 0;
          font-size: 12px;
          opacity: 0.8;
        }
        
        .medbot-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .medbot-message {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .medbot-message.bot {
          background: ${CONFIG.theme === 'dark' ? '#2a2a2a' : '#f0f0f0'};
          color: ${CONFIG.theme === 'dark' ? 'white' : '#333'};
          align-self: flex-start;
          border-bottom-left-radius: 4px;
        }
        
        .medbot-message.user {
          background: ${CONFIG.primaryColor};
          color: white;
          align-self: flex-end;
          border-bottom-right-radius: 4px;
        }
        
        .medbot-message.emergency {
          background: #dc2626;
          color: white;
        }
        
        .medbot-input-area {
          padding: 12px;
          border-top: 1px solid ${CONFIG.theme === 'dark' ? '#333' : '#eee'};
        }
        
        .medbot-input-wrapper {
          border-radius: 24px;
          border: 1px solid ${CONFIG.theme === 'dark' ? '#444' : '#e5e7eb'};
          background: ${CONFIG.theme === 'dark' ? '#1f2937' : 'white'};
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        
        .medbot-input {
          width: 100%;
          padding: 14px 16px 4px;
          border: none;
          font-size: 14px;
          background: transparent;
          color: ${CONFIG.theme === 'dark' ? 'white' : '#333'};
          outline: none;
          border-radius: 24px 24px 0 0;
        }
        
        .medbot-input::placeholder {
          color: ${CONFIG.theme === 'dark' ? '#666' : '#9ca3af'};
        }
        
        .medbot-send-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 4px 8px 8px;
        }
        
        .medbot-send {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${CONFIG.primaryColor};
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s;
        }
        
        .medbot-send:hover {
          opacity: 0.9;
        }
        
        .medbot-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .medbot-typing {
          display: none;
          padding: 8px 12px;
          font-size: 12px;
          color: #666;
        }
        
        .medbot-typing.show {
          display: block;
        }
        
        .medbot-powered {
          text-align: center;
          padding: 8px;
          font-size: 10px;
          color: #999;
          background: ${CONFIG.theme === 'dark' ? '#1a1a1a' : '#f9f9f9'};
        }
      </style>
      
      <button class="medbot-fab" aria-label="Open medical triage">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      
      <div class="medbot-window">
        <div class="medbot-header">
          <div class="medbot-header-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div class="medbot-header-text">
            <h3>${CONFIG.title}</h3>
            <p>${CONFIG.subtitle}</p>
          </div>
        </div>
        
        <div class="medbot-messages">
          <div class="medbot-message bot">${CONFIG.welcomeMessage}</div>
        </div>
        
        <div class="medbot-typing">
          <span>MedBot is typing...</span>
        </div>
        
        <div class="medbot-input-area">
          <div class="medbot-input-wrapper">
            <input type="text" class="medbot-input" placeholder="Describe your symptoms..." />
            <div class="medbot-send-row">
              <button class="medbot-send" aria-label="Send message">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="19" x2="12" y2="5"/>
                  <polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        <div class="medbot-powered">
          Powered by MedBot
        </div>
      </div>
    `;

    document.body.appendChild(container);
    return container;
  }

  // API client
  const API = {
    baseUrl: '',
    token: null,
    sessionId: null,
    consented: false,

    async init() {
      this.baseUrl = CONFIG.apiUrl.replace(/\/$/, '');
      const response = await fetch(`${this.baseUrl}/v1/widget/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: CONFIG.tenantId }),
      });
      if (!response.ok) throw new Error('Unable to start MedBot widget');
      const data = await response.json();
      this.token = data.widgetToken;
      this.sessionId = data.sessionId;
      if (data.branding) applyBranding(data.branding);
    },

    async sendMessage(message) {
      try {
        if (!this.token || !this.sessionId) await this.init();
        if (!this.consented) {
          this.consented = window.confirm('Do you consent to MedBot processing your health information for triage?');
          if (!this.consented) return { reply: 'Please provide consent before describing symptoms.', sessionId: this.sessionId, triage: null };
        }
        const response = await fetch(`${this.baseUrl}/v1/sessions/${encodeURIComponent(this.sessionId)}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-widget-token': this.token,
          },
          body: JSON.stringify({ message, consent: true }),
        });
        
        if (!response.ok) throw new Error('Failed to send message');
        return await response.json();
      } catch (error) {
        console.error('MedBot API error:', error);
        throw error;
      }
    }
  };

  // Widget controller
  let widget = null;
  let isOpen = false;

  function applyBranding(b) {
    if (!widget) return;
    const styleId = 'medbot-branding-overrides';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    const rules = [];
    if (b.primaryColor) {
      CONFIG.primaryColor = b.primaryColor;
      rules.push(`#medbot-widget .medbot-fab { background: ${b.primaryColor} !important; }`);
      rules.push(`#medbot-widget .medbot-send { background: ${b.primaryColor} !important; }`);
      rules.push(`#medbot-widget .medbot-message.user { background: ${b.primaryColor} !important; }`);
    }
    if (b.accentColor) {
      CONFIG.secondaryColor = b.accentColor;
      rules.push(`#medbot-widget .medbot-header { background: ${b.accentColor} !important; }`);
    }
    styleEl.textContent = rules.join('\n');
    if (b.logoUrl) {
      const logo = widget.querySelector('.medbot-header-logo');
      if (logo) logo.innerHTML = `<img src="${b.logoUrl}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:8px" />`;
    }
    if (b.clinicName) {
      const title = widget.querySelector('.medbot-header-text h3');
      if (title) title.textContent = b.clinicName;
    }
    if (b.welcomeMessage) {
      const welcome = widget.querySelector('.medbot-message.bot');
      if (welcome) welcome.textContent = b.welcomeMessage;
    }
  }

  function toggleWidget() {
    if (!widget) {
      widget = createWidget();
      setupEventListeners();
    }
    
    isOpen = !isOpen;
    const window = widget.querySelector('.medbot-window');
    window.classList.toggle('open', isOpen);
    
    if (isOpen) {
      widget.querySelector('.medbot-input').focus();
    }
  }

  function setupEventListeners() {
    const fab = widget.querySelector('.medbot-fab');
    const input = widget.querySelector('.medbot-input');
    const sendBtn = widget.querySelector('.medbot-send');
    const messages = widget.querySelector('.medbot-messages');
    const typing = widget.querySelector('.medbot-typing');

    fab.addEventListener('click', toggleWidget);

    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;

      // Add user message
      messages.innerHTML += `<div class="medbot-message user">${escapeHtml(text)}</div>`;
      input.value = '';
      sendBtn.disabled = true;
      typing.classList.add('show');

      // Scroll to bottom
      messages.scrollTop = messages.scrollHeight;

      try {
        const response = await API.sendMessage(text);
        
        // Add bot response
        const isEmergency = response.triage === 'emergency';
        messages.innerHTML += `<div class="medbot-message bot ${isEmergency ? 'emergency' : ''}">${escapeHtml(stripEmotionTags(response.reply))}</div>`;
        
        // Emit event for parent page
        window.dispatchEvent(new CustomEvent('medbot:message', {
          detail: {
            sessionId: response.sessionId,
            triage: response.triage,
            message: response.reply,
          }
        }));
      } catch (error) {
        messages.innerHTML += `<div class="medbot-message bot">Sorry, I'm having trouble connecting. Please try again.</div>`;
      } finally {
        typing.classList.remove('show');
        sendBtn.disabled = false;
        messages.scrollTop = messages.scrollHeight;
      }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function stripEmotionTags(text) {
    return text.replace(/\[[a-z_]+\]\s*/g, '');
  }

  // Initialize
  parseConfig();
  if (CONFIG.tenantId) {
    widget = createWidget();
    setupEventListeners();
    API.init().catch((error) => console.error('MedBot: widget initialization failed', error));
    
    // Expose global API
    window.MedBot = {
      open: () => { if (!isOpen) toggleWidget(); },
      close: () => { if (isOpen) toggleWidget(); },
      toggle: toggleWidget,
      config: CONFIG,
    };
  } else {
    console.error('MedBot: data-tenant attribute is required');
  }
})();
