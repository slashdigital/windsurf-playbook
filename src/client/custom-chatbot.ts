import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

import '../css/custom-chatbot.css';

const WEBHOOK_URL =
  'https://slash-digital.app.n8n.cloud/webhook/d31361f2-720e-42fd-9cc5-b856c61269a6/chat';

type ChatRole = 'user' | 'bot';

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

const SESSION_STORAGE_KEY = 'customChatbotSessionId';

function RobotDogIcon(props: { size: number }) {
  const { size } = props;
  return React.createElement(
    'svg',
    {
      className: 'ccbRobotDog',
      width: size,
      height: size,
      viewBox: '0 0 64 64',
      fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': true,
    },
    React.createElement('rect', {
      x: 14,
      y: 18,
      width: 36,
      height: 30,
      rx: 14,
      fill: 'rgba(255, 255, 255, 0.22)',
      stroke: 'rgba(255, 255, 255, 0.72)',
      strokeWidth: 2,
    }),
    React.createElement('path', {
      d: 'M16 30c-5 0-9-3.5-9-8 0-3.5 2.3-6.4 5.6-7.5 2.1-.7 4.4.1 5.9 1.7',
      stroke: 'rgba(255, 255, 255, 0.72)',
      strokeWidth: 3,
      strokeLinecap: 'round',
    }),
    React.createElement('path', {
      d: 'M48 30c5 0 9-3.5 9-8 0-3.5-2.3-6.4-5.6-7.5-2.1-.7-4.4.1-5.9 1.7',
      stroke: 'rgba(255, 255, 255, 0.72)',
      strokeWidth: 3,
      strokeLinecap: 'round',
    }),
    React.createElement('circle', {
      className: 'ccbRobotDogEye',
      cx: 26,
      cy: 34,
      r: 4,
      fill: '#ffffff',
      opacity: 0.92,
    }),
    React.createElement('circle', {
      className: 'ccbRobotDogEye',
      cx: 38,
      cy: 34,
      r: 4,
      fill: '#ffffff',
      opacity: 0.92,
    }),
    React.createElement('circle', { cx: 26.7, cy: 34.6, r: 1.6, fill: '#111' }),
    React.createElement('circle', { cx: 38.7, cy: 34.6, r: 1.6, fill: '#111' }),
    React.createElement('path', {
      d: 'M32 38c-2.8 0-5.2 1.6-6.3 3.9 1.9 2 4 3.1 6.3 3.1s4.4-1.1 6.3-3.1C37.2 39.6 34.8 38 32 38Z',
      fill: 'rgba(255, 255, 255, 0.85)',
    }),
    React.createElement('path', {
      d: 'M30 40c.6 1.6 1.3 2.4 2 2.4s1.4-.8 2-2.4',
      stroke: 'rgba(17, 17, 17, 0.9)',
      strokeWidth: 2,
      strokeLinecap: 'round',
    }),
  );
}

function XIcon(props: { size: number }) {
  const { size } = props;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
    },
    React.createElement('path', { d: 'M18 6 6 18' }),
    React.createElement('path', { d: 'M6 6l12 12' }),
  );
}

function SendIcon(props: { size: number }) {
  const { size } = props;
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
    },
    React.createElement('path', { d: 'M22 2 11 13' }),
    React.createElement('path', { d: 'M22 2 15 22 11 13 2 9 22 2' }),
  );
}

function tryExtractText(payload: unknown): string {
  if (payload == null) return '';

  if (typeof payload === 'string') return payload;

  if (typeof payload === 'object') {
    const p = payload as Record<string, unknown>;

    const directCandidates = [
      p.text,
      p.message,
      p.output,
      p.response,
      p.result,
      p.answer,
    ];

    for (const c of directCandidates) {
      if (typeof c === 'string' && c.trim()) return c;
    }

    const data = p.data;
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0] as Record<string, unknown>;
      if (typeof first.text === 'string' && first.text.trim()) return first.text;
      if (typeof first.message === 'string' && first.message.trim())
        return first.message;
    }
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function tryExtractSessionId(payload: unknown): string | undefined {
  if (payload == null) return undefined;
  if (typeof payload !== 'object') return undefined;

  const p = payload as Record<string, unknown>;
  if (typeof p.sessionId === 'string' && p.sessionId.trim()) return p.sessionId;

  const data = p.data;
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as Record<string, unknown>;
    if (typeof first.sessionId === 'string' && first.sessionId.trim())
      return first.sessionId;
  }

  return undefined;
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function sendToWebhook(params: {
  text: string;
  sessionId: string;
}): Promise<{ text: string; sessionId?: string }> {
  const { text, sessionId } = params;

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chatInput: text, sessionId }),
  });

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    const errText = contentType.includes('application/json')
      ? JSON.stringify(await res.json())
      : await res.text();
    throw new Error(errText || `Request failed: ${res.status}`);
  }

  if (contentType.includes('application/json')) {
    const payload = await res.json();
    return {
      text: tryExtractText(payload),
      sessionId: tryExtractSessionId(payload),
    };
  }

  return { text: (await res.text()) || '' };
}

function CustomChatbotWidget(): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [sessionId, setSessionId] = React.useState(() => {
    if (typeof window === 'undefined') return generateSessionId();
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return existing && existing.trim() ? existing : generateSessionId();
  });
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => [
    {
      id: 'welcome_1',
      role: 'bot',
      text: "Woof! I'm Byte — your tiny robot dog co-pilot.",
    },
    {
      id: 'welcome_2',
      role: 'bot',
      text: 'Ask me anything about the playbook — I can give quick answers, examples, or next steps.',
    },
  ]);

  const starterPrompts = React.useMemo(
    () => [
      'Give me a quick summary of the Windsurf Playbook',
      'Show me a good prompt template for building a feature',
      'Help me debug an issue step-by-step',
    ],
    [],
  );

  const hasUserMessage = React.useMemo(
    () => messages.some((m) => m.role === 'user'),
    [messages],
  );

  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [isOpen, messages.length, isSending]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || isSending) return;

    setDraft('');
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const reply = await sendToWebhook({ text, sessionId });
      if (reply.sessionId && reply.sessionId !== sessionId) {
        setSessionId(reply.sessionId);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(SESSION_STORAGE_KEY, reply.sessionId);
        }
      }
      const botMsg: ChatMessage = {
        id: `b_${Date.now()}`,
        role: 'bot',
        text: reply.text || '(no response)',
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      const errMsg: ChatMessage = {
        id: `e_${Date.now()}`,
        role: 'bot',
        text:
          e instanceof Error
            ? `Error: ${e.message}`
            : 'Error: failed to fetch response',
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return React.createElement(
    'div',
    { className: 'customChatbotRoot' },
    isOpen
      ? React.createElement(
          'div',
          { className: 'customChatbotPanel' },
          React.createElement(
            'div',
            { className: 'customChatbotHeader' },
            React.createElement(
              'div',
              { className: 'customChatbotHeaderLeft' },
              React.createElement(
                'div',
                { className: 'customChatbotAvatar', 'aria-hidden': true },
                React.createElement(RobotDogIcon, { size: 28 }),
                React.createElement(
                  'span',
                  { className: 'customChatbotQMarks', 'aria-hidden': true },
                  React.createElement('span', { className: 'customChatbotQMark' }, '?'),
                  React.createElement('span', { className: 'customChatbotQMark' }, '?'),
                  React.createElement('span', { className: 'customChatbotQMark' }, '?'),
                ),
              ),
              React.createElement(
                'div',
                null,
                React.createElement(
                  'div',
                  { className: 'customChatbotHeaderTitle' },
                  'Byte',
                ),
                React.createElement(
                  'div',
                  { className: 'customChatbotHeaderSubtitle' },
                  'Fast answers for builders',
                ),
              ),
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'customChatbotHeaderClose',
                onClick: () => setIsOpen(false),
                'aria-label': 'Close',
              },
              React.createElement(XIcon, { size: 18 }),
            ),
          ),
          React.createElement(
            'div',
            { className: 'customChatbotBody', ref: listRef },
            messages
              .map((m) =>
                React.createElement(
                  'div',
                  {
                    key: m.id,
                    className:
                      'customChatbotMsg ' +
                      (m.role === 'user'
                        ? 'customChatbotMsgUser'
                        : 'customChatbotMsgBot'),
                  },
                  m.role === 'bot'
                    ? React.createElement(
                        'div',
                        { className: 'customChatbotMarkdown' },
                        React.createElement(
                          ReactMarkdown as any,
                          {
                            remarkPlugins: [remarkGfm],
                            rehypePlugins: [rehypeSanitize],
                          } as any,
                          m.text,
                        ),
                      )
                    : m.text,
                ),
              )
              .concat(
                !hasUserMessage
                  ? [
                      React.createElement(
                        'div',
                        {
                          key: 'starters',
                          className:
                            'customChatbotStarters customChatbotMsg customChatbotMsgBot',
                        },
                        React.createElement(
                          'div',
                          { className: 'customChatbotStartersTitle' },
                          'Try one of these:',
                        ),
                        React.createElement(
                          'div',
                          { className: 'customChatbotStartersGrid' },
                          starterPrompts.map((p) =>
                            React.createElement(
                              'button',
                              {
                                key: p,
                                type: 'button',
                                className: 'customChatbotStarterChip',
                                onClick: () => {
                                  setDraft(p);
                                  requestAnimationFrame(() => {
                                    inputRef.current?.focus();
                                  });
                                },
                              },
                              p,
                            ),
                          ),
                        ),
                      ),
                    ]
                  : [],
              )
              .concat(
                isSending
                  ? [
                      React.createElement(
                        'div',
                        {
                          key: 'typing',
                          className:
                            'customChatbotMsg customChatbotMsgBot customChatbotTyping',
                        },
                        React.createElement(
                          'span',
                          { className: 'customChatbotTypingDots', 'aria-hidden': true },
                          React.createElement('span', {
                            className: 'customChatbotTypingDot',
                          }),
                          React.createElement('span', {
                            className: 'customChatbotTypingDot',
                          }),
                          React.createElement('span', {
                            className: 'customChatbotTypingDot',
                          }),
                        ),
                      ),
                    ]
                  : [],
              ),
          ),
          React.createElement(
            'div',
            { className: 'customChatbotFooter' },
            React.createElement(
              'div',
              { className: 'customChatbotComposer' },
              React.createElement('textarea' as any, {
                className: 'customChatbotInput',
                ref: inputRef,
                value: draft,
                placeholder: 'Type a message…',
                onChange: (e: any) => setDraft(e.target.value),
                onKeyDown,
              } as any),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'customChatbotSend',
                  onClick: () => void handleSend(),
                  disabled: isSending || !draft.trim(),
                  'aria-label': 'Send',
                },
                React.createElement(SendIcon, { size: 18 }),
              ),
            ),
          ),
        )
      : null,
    !isOpen
      ? React.createElement(
          'button',
          {
            type: 'button',
            className: 'customChatbotButton',
            onClick: () => setIsOpen((v) => !v),
            'aria-label': 'Open custom chatbot',
          },
          React.createElement(RobotDogIcon, { size: 32 }),
          React.createElement(
            'span',
            { className: 'customChatbotQMarks', 'aria-hidden': true },
            React.createElement('span', { className: 'customChatbotQMark' }, '?'),
            React.createElement('span', { className: 'customChatbotQMark' }, '?'),
            React.createElement('span', { className: 'customChatbotQMark' }, '?'),
          ),
        )
      : null,
  );
}

function mount(): void {
  if (typeof window === 'undefined') return;

  const existing = document.getElementById('custom-chatbot-root');
  if (existing) return;

  const host = document.createElement('div');
  host.id = 'custom-chatbot-root';
  document.body.appendChild(host);

  const root: Root = createRoot(host);
  root.render(React.createElement(CustomChatbotWidget));
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}
