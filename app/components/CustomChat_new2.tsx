'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useCopilotChat, useCopilotContext } from "@copilotkit/react-core";
import { useCopilotChatHeadless_c } from "@copilotkit/react-core";
import { Role, TextMessage, Message } from "@copilotkit/runtime-client-gql";
import { ArrowUp, Settings, Plus, PanelLeft, PanelLeftDashed, CircleStop } from 'lucide-react';
import ReactMarkdown, { Components } from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';

const CHAT_HISTORY_KEY = 'chat-history';

export const CustomChat = forwardRef<{ handleNewChat: () => void, handleSidebarToggle: () => void }, CustomChatProps>((props, ref) => {
  const { onSettingsClick, isSidebarOpen, onSidebarToggle, hasApiKey = true } = props;
  
  // 1. Correct Hook Usage
  const { visibleMessages, appendMessage, isLoading, stopGeneration, reset } = useCopilotChat({id: "mcp_agent"});
  const { setThreadId, setMessages } = useCopilotContext(); // Get global setter here
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Load history once on mount
  useEffect(() => {
    const saved = localStorage.getItem(CHAT_HISTORY_KEY);
    if (saved) {
      try {
        const history = JSON.parse(saved);
        setChatHistory(history);
        if (history.length > 0 && !activeChatId) {
          const latest = history[0];
          setActiveChatId(latest.id);
          setThreadId(latest.threadId);
          setMessages(latest.messages); // Load into context
        }
      } catch (e) { console.error(e); }
    }
  }, []);

  // 2. Persist history ONLY when loading finishes to avoid UI wipes
  useEffect(() => {
    if (activeChatId && !isLoading && visibleMessages.length > 0) {
      setChatHistory(prev => {
        const updated = prev.map(chat => 
          chat.id === activeChatId ? { ...chat, messages: visibleMessages, updatedAt: Date.now() } : chat
        );
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  }, [isLoading, activeChatId]);

  const handleNewChat = () => {
    reset(); // Use the official reset method
    const newId = Date.now().toString();
    const newThread = uuidv4();
    
    setThreadId(newThread);
    setActiveChatId(newId);
    
    setChatHistory(prev => [{
      id: newId,
      threadId: newThread,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }, ...prev]);
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || !hasApiKey || isLoading) return;
    
    const content = inputValue;
    setInputValue('');

    // Update title for the first message
    if (activeChatId) {
      setChatHistory(prev => prev.map(chat => 
        (chat.id === activeChatId && chat.messages.length === 0) 
          ? { ...chat, title: content.slice(0, 30) } : chat
      ));
    }

    await appendMessage(new TextMessage({ content, role: Role.User }));
  };

  return (
    <div className="flex h-full bg-[#F5F8FF]">
      {/* Sidebar ... (Keep your existing Sidebar JSX) */}
      
      <div className={`flex-1 flex flex-col ${isSidebarOpen ? 'ml-64' : ''} transition-all duration-300`}>
        {/* Main Chat Area */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {visibleMessages.map((msg: any, i) => {
            // 3. IMPROVED RENDERING LOGIC
            const isUser = msg.role === Role.User;
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

            if (!content && msg.role !== 'tool') return null;

            return (
              <div key={msg.id || i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${isUser ? 'bg-blue-600 text-white' : 'bg-white border text-gray-800'}`}>
                  {!isUser && <span className="text-xs font-bold block mb-1 text-blue-500">AI</span>}
                  <ReactMarkdown>{content}</ReactMarkdown>
                  
                  {/* Explicit Tool Result Handling */}
                  {msg.role === 'tool' && (
                    <div className="mt-2 text-xs font-mono bg-gray-100 p-1 rounded">
                      Output: {content}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {isLoading && <div className="text-gray-400 italic">Thinking...</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <input
              ref={inputRef}
              className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask anything..."
            />
            <button 
              onClick={sendMessage} 
              disabled={isLoading}
              className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700"
            >
              <ArrowUp size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});