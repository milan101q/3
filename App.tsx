import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Reminder } from './types';
import { analyzePlantImage, createChatSession, sendMessageToChat } from './services/geminiService';
import { UploadIcon, SendIcon, SparklesIcon, CalendarIcon, BellIcon, TrashIcon, MicrophoneIcon, ShareIcon } from './components/icons';
import type { Chat } from '@google/genai';
import { useLanguage, useTranslations } from './i18n';

// Add type definitions for SpeechRecognition API
interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: any) => void;
  onend: () => void;
  onerror: (event: any) => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

const ReminderModal: React.FC<{
    plantName: string,
    onSave: (interval: number) => void,
    onClose: () => void,
    t: any 
}> = ({ plantName, onSave, onClose, t }) => {
    const [interval, setInterval] = useState(7);
    const { lang } = useLanguage();

    const handleSave = () => {
        if (interval > 0) {
            onSave(interval);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm text-end">
                <h3 className="text-lg font-bold text-gray-800 mb-2">{t.reminderModal.title}</h3>
                <p className="text-sm text-gray-600 mb-4" dangerouslySetInnerHTML={{ __html: t.reminderModal.description.replace('{plantName}', `<span class="font-semibold text-green-700">${plantName}</span>`) }}></p>
                <div className={`flex items-center justify-center space-x-2 mb-6 ${lang === 'fa' ? 'space-x-reverse' : ''}`}>
                    <input
                        type="number"
                        value={interval}
                        onChange={(e) => setInterval(parseInt(e.target.value, 10) || 1)}
                        className="w-24 text-center p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        min="1"
                    />
                    <span className="font-medium text-gray-700">{t.reminderModal.days}</span>
                </div>
                <div className="flex justify-between">
                    <button onClick={handleSave} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">{t.reminderModal.saveButton}</button>
                    <button onClick={onClose} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">{t.reminderModal.cancelButton}</button>
                </div>
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const { lang, setLang } = useLanguage();
  const t = useTranslations();

  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plantName, setPlantName] = useState<string | null>(null);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminders, setReminders] = useState<(Reminder & { nextWateringDate: Date })[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'reminders'>('chat');

  const chatSession = useRef<Chat | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    document.title = t.appTitle;
  }, [t]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
  useEffect(() => {
    chatSession.current = createChatSession(lang);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = lang === 'fa' ? 'fa-IR' : 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;
      
      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setUserInput(finalTranscript + interimTranscript);
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setError(t.errors.speechRecognition);
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    } else {
      console.warn("Speech recognition not supported in this browser.");
    }
  }, [lang, t.errors.speechRecognition]);

  useEffect(() => {
    const storedReminders = localStorage.getItem('wateringReminders');
    if (storedReminders) {
        try {
            const parsedReminders: Reminder[] = JSON.parse(storedReminders);
            const remindersWithDates = parsedReminders.map(reminder => {
                const msInDay = 24 * 60 * 60 * 1000;
                const intervalMs = reminder.interval * msInDay;
                const timeSinceStart = Date.now() - reminder.startDate;
                
                const intervalsPassed = Math.floor(timeSinceStart / intervalMs);
                const nextWateringTimestamp = reminder.startDate + (intervalsPassed + 1) * intervalMs;
                const nextWateringDate = new Date(nextWateringTimestamp);

                if (Date.now() >= nextWateringDate.getTime() - msInDay && Date.now() < nextWateringDate.getTime() + msInDay) {
                  setTimeout(() => alert(t.reminderAlert.replace('{plantName}', reminder.plantName)), 500);
                }
                return { ...reminder, nextWateringDate };
            });
            remindersWithDates.sort((a, b) => a.nextWateringDate.getTime() - b.nextWateringDate.getTime());
            setReminders(remindersWithDates);
        } catch (e) {
            console.error("Failed to parse reminders from localStorage", e);
            localStorage.removeItem('wateringReminders');
        }
    }
  }, [t.reminderAlert]);


  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setMessages([]);
      setError(null);
      setPlantName(null);
      setActiveTab('chat');
    }
  };

  const handleAnalyzeClick = async () => {
    if (!image) {
      setError(t.errors.selectPhoto);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setMessages([]);
    setPlantName(null);

    try {
      const base64Image = await fileToBase64(image);
      const response = await analyzePlantImage(base64Image, image.type, lang);
      const modelResponse = response.text;
      
      setMessages([{ role: 'model', text: modelResponse }]);
      
      const nameMatch = modelResponse.match(/\*\*(?:Plant Name|نام گیاه):\*\*\s*(.*?)\s*(\/|\n)/);
      if (nameMatch && nameMatch[1]) {
        setPlantName(nameMatch[1].trim());
      }
      
      chatSession.current = createChatSession(lang);

    } catch (err) {
      console.error(err);
      setError(t.errors.analysisError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userMessage: ChatMessage = { role: 'user', text: userInput };
    setMessages((prev) => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);
    setError(null);

    try {
        if (!chatSession.current) {
            chatSession.current = createChatSession(lang);
        }
        const response = await sendMessageToChat(chatSession.current, userInput);
        const modelResponse = response.text;
        setMessages((prev) => [...prev, { role: 'model', text: modelResponse }]);
    } catch (err) {
      console.error(err);
      setError(t.errors.serverError);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveReminder = (interval: number) => {
    if (!plantName) return;
    const newReminder: Reminder = { plantName, interval, startDate: Date.now() };
    const updatedReminders = [...reminders.filter(r => r.plantName !== plantName), newReminder];
    localStorage.setItem('wateringReminders', JSON.stringify(updatedReminders));
    const msInDay = 24 * 60 * 60 * 1000;
    const nextWateringDate = new Date(newReminder.startDate + newReminder.interval * msInDay);
    setReminders(prev => {
        const newList = [...prev.filter(r => r.plantName !== plantName), { ...newReminder, nextWateringDate}];
        newList.sort((a, b) => a.nextWateringDate.getTime() - b.nextWateringDate.getTime());
        return newList;
    });
    setIsReminderModalOpen(false);
  };

  const handleDeleteReminder = (plantNameToDelete: string) => {
    const updatedReminders = reminders.filter(r => r.plantName !== plantNameToDelete);
    localStorage.setItem('wateringReminders', JSON.stringify(updatedReminders));
    setReminders(updatedReminders);
  };
  
  const handleToggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setUserInput('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const getPlantDescription = (modelResponse: string): string => {
    const match = modelResponse.match(/\*\*(?:Introduction|معرفی):\*\*\n([\s\S]*?)\n\*\*/);
    return match ? match[1].trim() : t.share.noInfo;
  };
  
  const handleShare = async () => {
    if (!plantName || messages.length === 0 || !navigator.share) return;
    const description = getPlantDescription(messages[0].text);
    const shareData = {
      title: t.share.title.replace('{plantName}', plantName),
      text: t.share.text.replace('{plantName}', plantName).replace('{description}', description),
    };
    try {
      await navigator.share(shareData);
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const formattedText = (text: string) => {
    const sections = text.split('\n');
    return sections.map((section, index) => {
        if (section.startsWith('**') && section.endsWith('**')) {
            return <h2 key={index} className="text-xl font-bold mt-4 mb-2 text-green-800">{section.replace(/\*\*/g, '')}</h2>;
        }
        if (section.startsWith('*   **')) {
            const parts = section.replace('*   **', '').split(':**');
            return <p key={index} className="mb-2"><strong className="font-semibold text-green-700">{parts[0]}:</strong> {parts[1]}</p>;
        }
        if (section.startsWith('*   ')) {
           return <li key={index} className="mb-1 list-disc ms-5">{section.replace('*   ', '')}</li>
        }
        return <p key={index} className="mb-2">{section}</p>;
    });
  };

  const hasReminderForCurrentPlant = plantName ? reminders.some(r => r.plantName === plantName) : false;

  return (
    <div className="flex flex-col h-screen bg-green-50">
      {isReminderModalOpen && plantName && <ReminderModal plantName={plantName} onSave={handleSaveReminder} onClose={() => setIsReminderModalOpen(false)} t={t} />}
      <header className="bg-white shadow-md p-4 flex items-center justify-between border-b-2 border-green-200">
        <h1 className="text-2xl font-bold text-green-800">🌿 {t.appTitle}</h1>
        <div className="flex items-center space-x-2">
            <button onClick={() => setLang('en')} className={`px-3 py-1 text-sm rounded-md ${lang === 'en' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>EN</button>
            <button onClick={() => setLang('fa')} className={`px-3 py-1 text-sm rounded-md ${lang === 'fa' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>FA</button>
        </div>
      </header>

      <nav className="flex bg-white border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-center font-semibold transition-colors ${activeTab === 'chat' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          {t.identifyAndChat}
        </button>
        <button 
          onClick={() => setActiveTab('reminders')}
          className={`flex-1 py-3 text-center font-semibold transition-colors ${activeTab === 'reminders' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          {t.myReminders} {reminders.length > 0 && `(${reminders.length})`}
        </button>
      </nav>
      
      {activeTab === 'chat' && (
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="w-full md:w-1/3 lg:w-2/5 p-6 bg-white md:border-e-2 border-green-100 flex flex-col items-center justify-center">
              <div className="w-full max-w-sm">
                  <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">{t.identifyYourPlant}</h2>
                  <div 
                      className="relative border-2 border-dashed border-green-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                  >
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                      {imagePreview ? (
                          <img src={imagePreview} alt={t.plantPreviewAlt} className="mx-auto rounded-lg max-h-60 object-contain" />
                      ) : (
                          <div className="flex flex-col items-center text-green-700">
                              <UploadIcon className="w-12 h-12 mb-2"/>
                              <p className="font-semibold">{t.clickToSelect}</p>
                              <p className="text-sm text-gray-500">{t.dragAndDrop}</p>
                          </div>
                      )}
                  </div>
                  
                  {image && (
                      <button
                          onClick={handleAnalyzeClick}
                          disabled={isLoading}
                          className="w-full mt-4 bg-green-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                      >
                          {isLoading && messages.length === 0 ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin me-2"></div> : <SparklesIcon className="w-6 h-6 me-2" />}
                          <span>{isLoading && messages.length === 0 ? t.analyzing : t.analyzeButton}</span>
                      </button>
                  )}
                  {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
                  
                  {plantName && messages.length > 0 && (
                      <div className={`w-full mt-4 flex space-x-2 ${lang === 'fa' ? 'space-x-reverse' : ''}`}>
                          {!hasReminderForCurrentPlant && (
                              <button
                                  onClick={() => setIsReminderModalOpen(true)}
                                  className="flex-1 bg-blue-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-all"
                              >
                                  <CalendarIcon className="w-6 h-6 me-2" />
                                  <span>{t.reminderButton}</span>
                              </button>
                          )}
                           {typeof navigator.share === 'function' && (
                            <button
                                  onClick={handleShare}
                                  className="flex-1 bg-gray-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center hover:bg-gray-600 transition-all"
                              >
                                  <ShareIcon className="w-6 h-6 me-2" />
                                  <span>{t.shareButton}</span>
                              </button>
                          )}
                      </div>
                  )}

                  {hasReminderForCurrentPlant && (
                    <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg text-center text-green-800">
                      <p className="text-sm">{t.reminderSetNotice}</p>
                    </div>
                  )}
              </div>
          </div>

          <div className="flex-1 flex flex-col bg-gray-50 p-4">
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto pe-2">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                  <p className="text-lg">{t.welcome.title}</p>
                  <p>{t.welcome.subtitle}</p>
                </div>
              )}

              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
                  <div className={`max-w-xl p-4 rounded-2xl ${msg.role === 'user' ? 'bg-green-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none shadow-sm'}`}>
                    {msg.role === 'model' ? formattedText(msg.text) : <p>{msg.text}</p>}
                  </div>
                </div>
              ))}
              {isLoading && messages.length > 0 && (
                  <div className="flex justify-start mb-4">
                      <div className="max-w-xl p-4 rounded-2xl bg-white text-gray-800 rounded-bl-none shadow-sm flex items-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse me-2"></div>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse [animation-delay:75ms] me-2"></div>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse [animation-delay:150ms]"></div>
                      </div>
                  </div>
              )}
            </div>
            
            <div className="mt-4 border-t pt-4">
              <form onSubmit={handleSendMessage} className={`flex items-center space-x-2 ${lang === 'fa' ? 'space-x-reverse' : ''}`}>
                <input 
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder={isListening ? t.input.listening : (messages.length > 0 ? t.input.askMore : t.input.analyzeFirst)}
                  className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={messages.length === 0 || isLoading}
                />
                {recognitionRef.current && (
                  <button
                      type="button"
                      onClick={handleToggleListening}
                      disabled={messages.length === 0 || isLoading}
                      className={`p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors ${
                          isListening ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-green-600'
                      }`}
                      aria-label={isListening ? t.aria.stopRecording : t.aria.startRecording}
                  >
                      <MicrophoneIcon className="w-6 h-6"/>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!userInput.trim() || isLoading || messages.length === 0}
                  className="bg-green-600 text-white p-3 rounded-full hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  aria-label={t.aria.sendMessage}
                >
                  <SendIcon className="w-6 h-6"/>
                </button>
              </form>
            </div>
          </div>
        </main>
      )}
      {activeTab === 'reminders' && (
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{t.myWateringReminders}</h2>
            {reminders.length === 0 ? (
              <div className="text-center text-gray-500 mt-12">
                <BellIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg">{t.noReminders.title}</p>
                <p>{t.noReminders.subtitle}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reminders.map(reminder => (
                  <div key={reminder.plantName} className="bg-white p-4 rounded-lg shadow-md flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-green-700">{reminder.plantName}</h3>
                      <p className="text-sm text-gray-600">
                        {t.reminderCard.every} <span className="font-semibold">{reminder.interval}</span> {t.reminderCard.days}
                      </p>
                      <p className="text-sm text-gray-800 mt-1">
                        {t.reminderCard.nextWatering} <span className="font-bold">{reminder.nextWateringDate.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US')}</span>
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDeleteReminder(reminder.plantName)}
                      className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors"
                      aria-label={t.aria.deleteReminder.replace('{plantName}', reminder.plantName)}
                    >
                      <TrashIcon className="w-6 h-6" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
