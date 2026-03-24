'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
// 1. New V2 Imports
import { useAgent } from "@copilotkit/react-core/v2";
// import { randomUUID } from "@copilotkit/shared"; 
import { ArrowUp, Settings, Plus, PanelLeft, PanelLeftDashed, CircleStop } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';

// Constants
const CHAT_HISTORY_KEY = 'chat-history';

interface ChatSession {
  id: string;
  threadId: string;
  title: string;
  messages: any[]; // v2 uses a consistent message structure
  createdAt: number;
  updatedAt: number;
}

interface CustomChatProps {
  onSettingsClick?: () => void;
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
  hasApiKey?: boolean;
}

const CustomChat = forwardRef<any, CustomChatProps>(({ 
  onSettingsClick, 
  isSidebarOpen, 
  onSidebarToggle,
  hasApiKey = true 
}, ref) => {
  const [inputValue, setInputValue] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 2. Use the V2 Hook
  const { agent } = useAgent({
    agentId: "mcp_agent", // Matches your LangGraph agent ID
  });

  // Helper aliases to keep the JSX clean
  const messages = agent.messages;
  const isLoading = agent.isRunning;

  // Persistence logic
  useEffect(() => {
    const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setChatHistory(parsed);
        if (parsed.length > 0 && !activeChatId) {
          setActiveChatId(parsed[0].id);
          setThreadId(parsed[0].threadId);
          agent.setMessages(parsed[0].messages);
        }
      } catch (e) { console.error("Failed to load history", e); }
    }
  }, []);

  useEffect(() => {
    if (activeChatId && messages.length > 0) {
      setChatHistory(prev => prev.map(chat => 
        chat.id === activeChatId 
          ? { ...chat, messages: messages, updatedAt: Date.now() } 
          : chat
      ));
    }
  }, [messages, activeChatId]);

  useEffect(() => {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
  }, [chatHistory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  // 3. Updated Messaging Logic
  const sendMessage = async () => {
    if (!inputValue.trim() || !hasApiKey || isLoading) return;

    const userText = inputValue;
    setInputValue('');

    // Add user message to the agent state
    agent.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
    });

    // Trigger the LangGraph agent
    try {
      await agent.run();
    } catch (error) {
      console.error("Agent execution failed:", error);
    }
  };

  const handleNewChat = () => {
    const newChatId = Date.now().toString();
    const newThreadId = uuidv4();
    
    // Clear the agent state directly
    agent.setMessages([]);
    
    const newChat: ChatSession = {
      id: newChatId,
      threadId: newThreadId,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setChatHistory(prev => [newChat, ...prev]);
    setActiveChatId(newChatId);
    setThreadId(newThreadId);
  };

  const loadChat = (chatId: string) => {
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat) {
      agent.setMessages(chat.messages);
      setActiveChatId(chatId);
      setThreadId(chat.threadId);
    }
  };

  useImperativeHandle(ref, () => ({ handleNewChat, loadChat, chatHistory }));

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <button onClick={onSidebarToggle} className="p-2 hover:bg-gray-100 rounded-lg">
          {isSidebarOpen ? <PanelLeftDashed className="w-5 h-5 text-gray-500" /> : <PanelLeft className="w-5 h-5 text-gray-500" />}
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800">MCP Assistant</span>
        </div>
        <button onClick={handleNewChat} className="p-2 hover:bg-gray-100 rounded-lg">
          <Plus className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 bg-[#6666fc15] rounded-full flex items-center justify-center mb-4">
              <span className="text-[#6666fc] text-2xl">👋</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">How can I help you today?</h3>
            <p className="text-gray-500 max-w-sm">Ask me to solve a math problem or anything else.</p>
          </div>
        ) : (
          messages.map((msg: any) => (
            <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="flex items-start gap-3 max-w-[85%]">
                {msg.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#6666fc] flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-xs">AI</span>
                  </div>
                )}
                <div className={`px-4 py-2 rounded-2xl shadow-sm ${
                  msg.role === 'user' ? 'bg-[#D4E1FF] text-gray-800' : 'bg-white border border-gray-100 text-gray-800'
                }`}>
                  <ReactMarkdown className="prose prose-sm max-w-none">
                    {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                  </ReactMarkdown>
                  {/* Tool output styling */}
                  {msg.role === 'tool' && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs font-mono text-blue-600">
                      Result: {msg.content}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start items-center gap-2 text-gray-400 text-sm italic ml-11">
            <div className="flex gap-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce [animation-delay:0.2s]">.</span>
              <span className="animate-bounce [animation-delay:0.4s]">.</span>
            </div>
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white">
        <div className="max-w-4xl mx-auto relative group">
          <div className="relative flex items-center bg-white border-2 border-gray-100 rounded-2xl shadow-sm focus-within:border-[#6666fc] transition-all p-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Type your message..."
              className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-2 px-3 text-gray-800 min-h-[44px] max-h-32"
              rows={1}
            />
            <div className="flex items-center gap-2 pr-2">
              <button onClick={onSettingsClick} className="p-2 text-gray-400 hover:text-gray-600">
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={isLoading ? () => agent.abortRun() : sendMessage}
                disabled={!inputValue.trim() && !isLoading}
                className={`p-2 rounded-xl transition-all ${
                  isLoading ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-[#6666FC] text-white hover:bg-[#5555e0]'
                }`}
              >
                {isLoading ? <CircleStop className="w-5 h-5" /> : <ArrowUp className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

CustomChat.displayName = 'CustomChat';
export default CustomChat;