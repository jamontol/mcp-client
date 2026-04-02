'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useCopilotChat, useCopilotContext } from "@copilotkit/react-core";
import { Role, TextMessage, Message } from "@copilotkit/runtime-client-gql";
import { ArrowUp, Settings, Plus, PanelLeft, PanelLeftDashed, CircleStop } from 'lucide-react';
import ReactMarkdown, { Components } from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';

const CHAT_HISTORY_KEY = 'chat-history';

interface ChatSession {
  id: string;
  threadId: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface CustomChatProps {
  onSettingsClick?: () => void;
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
  hasApiKey?: boolean;
}

export const CustomChat = forwardRef<{ handleNewChat: () => void, handleSidebarToggle: () => void }, CustomChatProps>((props, ref) => {
  const { onSettingsClick, isSidebarOpen, onSidebarToggle, hasApiKey = true } = props;
  
  // 1. Hook setup with fallbacks to prevent "undefined" crashes
  const { visibleMessages = [], appendMessage, isLoading, stopGeneration, reset } = useCopilotChat(); // { id: "mcp_agent" }
  const context = useCopilotContext();
  const { setThreadId } = context;
  const setMessages = (context as any).setMessages; // Cast for Free Tier history loading

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [inputValue, setInputValue] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Initial Load from LocalStorage
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
          if (setMessages) setMessages(latest.messages);
        }
      } catch (e) { console.error("Failed to parse history", e); }
    }
  }, []);

  // Sync current conversation to History
  useEffect(() => {
    if (activeChatId && visibleMessages.length > 0) {
      console.log("Syncing to history. Message count:", visibleMessages.length);
      setChatHistory(prev => {
        const newHistory = prev.map(chat => 
          chat.id === activeChatId 
            ? { ...chat, messages: visibleMessages, updatedAt: Date.now() } 
            : chat
        );
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(newHistory));
        return newHistory;
      });
    }
  }, [visibleMessages, activeChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages]);

  const handleNewChat = () => {
    reset();
    const newId = Date.now().toString();
    const newThread = uuidv4();
    
    const newChat: ChatSession = {
      id: newId,
      threadId: newThread,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setChatHistory(prev => [newChat, ...prev]);
    setActiveChatId(newId);
    setThreadId(newThread);
    if (setMessages) setMessages([]);
    setInputValue('');
  };

  const loadChat = (chatId: string) => {
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat) {
      reset();
      setThreadId(chat.threadId);
      setActiveChatId(chatId);
      if (setMessages) setMessages(chat.messages);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const currentInput = inputValue;
    setInputValue(''); // Clear immediately for UX

    if (!activeChatId) {
      const newId = Date.now().toString();
      const newThread = uuidv4();
      setActiveChatId(newId);
      setThreadId(newThread);
      setChatHistory(prev => [{
        id: newId,
        threadId: newThread,
        title: currentInput.slice(0, 30),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }, ...prev]);
    }

    await appendMessage(new TextMessage({ content: currentInput, role: Role.User }));
  };

  useImperativeHandle(ref, () => ({ handleNewChat, handleSidebarToggle: onSidebarToggle }));

  console.log("DEBUG: visibleMessages update", visibleMessages);

  const markdownComponents: Components = {
    a: ({ children, ...props }) => (
      <a target="_blank" rel="noopener noreferrer" className="text-blue-600 underline" {...props}>
        {children}
      </a>
    )
  };

  return (
    <div className="flex h-full bg-[#F5F8FF] text-gray-900">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-72' : 'w-0'} h-screen fixed left-0 top-0 bg-[#FFFBF5] border-r border-gray-200 transition-all duration-300 overflow-hidden z-20`}>
        <div className="pt-20 p-4">
          <button onClick={handleNewChat} className="w-full flex items-center gap-2 px-3 py-2 bg-[#6666FC] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-sm">
            <Plus size={18} /> New chat
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-10rem)] px-2">
          {chatHistory.map((chat) => (
            <div 
              key={chat.id} 
              onClick={() => loadChat(chat.id)} 
              className={`group flex items-center justify-between p-3 cursor-pointer rounded-md mb-1 text-sm ${activeChatId === chat.id ? 'bg-[#D4E1FF] font-medium' : 'hover:bg-gray-100'}`}
            >
              <span className="truncate flex-grow">{chat.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col ${isSidebarOpen ? 'ml-72' : 'ml-0'} transition-all duration-300`}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 bg-[#F5F8FF]/80 backdrop-blur sticky top-0 z-10">
          <button onClick={onSidebarToggle} className="p-2 hover:bg-gray-200 rounded-lg">
            {isSidebarOpen ? <PanelLeftDashed size={20} /> : <PanelLeft size={20} />}
          </button>
          <button onClick={onSettingsClick} className="p-2 hover:bg-gray-200 rounded-lg"><Settings size={20} /></button>
        </div>

        {/* Message List */}
        <div className="flex-grow overflow-y-auto px-4">
          <div className="max-w-3xl mx-auto py-8 space-y-6">
            {(visibleMessages?.length ?? 0) === 0 ? (
              <div className="text-center py-20 opacity-60">
                <h2 className="text-2xl font-bold">MCP Assistant</h2>
                <p>Start a conversation to see tool outputs and agent responses.</p>
              </div>
            ) : (
             visibleMessages.map((msg: any, i: number) => {
              console.log(`Message ${i} role:`, msg.role);
              // 1. Identify Role correctly
              const isUser = msg.role === Role.User || msg.role === 'user';
              
              const isTool = msg.role === 'tool' || msg.role === Role.Assistant && msg.tool_calls;

              // 2. Extract Content (The most common point of failure)
              let content = typeof msg.content === 'string' 
              ? msg.content 
              : (msg.text || msg.content?.text || "");
              
              if (typeof msg.content === 'string') {
                content = msg.content;
              } else if (Array.isArray(msg.content)) {
                // Some models return content as an array of objects
                content = msg.content
                  .map((part: any) => part.text || part.content || "")
                  .join("");
              } else if (msg.text) {
                // Catch streaming text
                content = msg.text;
              } else if (msg.content?.text) {
                content = msg.content.text;
              }

              // 3. Skip empty messages, but allow tool messages to show a placeholder
              if (!content && !isTool) return null;

              return (
                <div key={msg.id || i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                    isUser ? 'bg-[#6666FC] text-white' : 'bg-white border text-gray-800'
                  }`}>
                    <div key={`${msg.id || i}-${visibleMessages.length}`} className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : 'prose-gray'}`}>
                      <ReactMarkdown components={markdownComponents}>
                        {content || (isTool ? "_Processing tool call..._" : "")}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            })
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border p-3 rounded-lg text-gray-400 animate-pulse text-sm">AI is thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Floating Input Area */}
        <div className="p-4 bg-gradient-to-t from-[#F5F8FF] to-transparent">
          <div className="max-w-3xl mx-auto relative bg-white rounded-xl shadow-xl border border-gray-300 flex items-center p-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={hasApiKey ? "Message the assistant..." : "Please add an API key in settings"}
              className="flex-grow px-4 py-2 bg-transparent focus:outline-none"
              disabled={isLoading}
            />
            {isLoading ? (
              <button onClick={stopGeneration} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                <CircleStop size={20} />
              </button>
            ) : (
              <button 
                onClick={sendMessage} 
                disabled={!inputValue.trim() || isLoading}
                className="p-2 bg-[#6666FC] text-white rounded-lg disabled:opacity-30 hover:bg-blue-700 transition-colors"
              >
                <ArrowUp size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

CustomChat.displayName = 'CustomChat';