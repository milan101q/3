import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

export type Language = 'fa' | 'en';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
}

const translations = {
    fa: {
        appTitle: 'دستیار هوشمند باغبانی',
        identifyAndChat: 'شناسایی و گفتگو',
        myReminders: 'یادآورهای من',
        identifyYourPlant: 'گیاه خود را شناسایی کنید',
        plantPreviewAlt: 'پیش‌نمایش گیاه',
        clickToSelect: 'برای انتخاب عکس کلیک کنید',
        dragAndDrop: 'یا عکس را به اینجا بکشید',
        analyzing: 'در حال تحلیل...',
        analyzeButton: 'تحلیل عکس گیاه',
        reminderButton: 'یادآور',
        shareButton: 'اشتراک',
        reminderSetNotice: 'یادآور آبیاری برای این گیاه فعال است. می‌توانید آن را در تب "یادآورهای من" مدیریت کنید.',
        welcome: {
            title: 'برای شروع، عکسی از گیاه خود آپلود و تحلیل کنید.',
            subtitle: 'سپس می‌توانید سوالات بیشتری بپرسید!'
        },
        input: {
            listening: 'در حال شنیدن...',
            askMore: 'سوال دیگری بپرسید...',
            analyzeFirst: 'ابتدا یک گیاه را تحلیل کنید...'
        },
        myWateringReminders: 'یادآورهای آبیاری من',
        noReminders: {
            title: 'هنوز یادآوری ثبت نکرده‌اید.',
            subtitle: 'گیاهی را در تب "شناسایی و گفتگو" تحلیل کنید تا بتوانید یادآور آبیاری برای آن تنظیم کنید.'
        },
        reminderCard: {
            every: 'هر',
            days: 'روز یکبار',
            nextWatering: 'آبیاری بعدی:'
        },
        reminderModal: {
            title: 'تنظیم یادآور آبیاری',
            description: 'هر چند روز یکبار برای آبیاری {plantName} به شما یادآوری کنیم؟',
            days: 'روز',
            saveButton: 'ذخیره یادآور',
            cancelButton: 'لغو'
        },
        errors: {
            selectPhoto: 'لطفاً ابتدا یک عکس انتخاب کنید.',
            analysisError: 'خطایی در تحلیل تصویر رخ داد. لطفاً دوباره تلاش کنید.',
            serverError: 'خطایی در ارتباط با سرور رخ داد. لطفاً دوباره تلاش کنید.',
            speechRecognition: 'خطایی در تشخیص گفتار رخ داد.'
        },
        aria: {
            stopRecording: 'توقف ضبط',
            startRecording: 'شروع ضبط',
            sendMessage: 'ارسال پیام',
            deleteReminder: 'حذف یادآور برای {plantName}'
        },
        share: {
            title: '🌿 گیاه شناسایی شده: {plantName}',
            text: 'من همین الان با دستیار باغبانی، گیاه "{plantName}" را شناسایی کردم!\n\nمعرفی کوتاه:\n{description}',
            noInfo: 'اطلاعاتی یافت نشد.'
        },
        reminderAlert: '🌿 یادت نره! امروز نوبت آبیاری "{plantName}" است.'
    },
    en: {
        appTitle: 'Intelligent Gardening Assistant',
        identifyAndChat: 'Identify & Chat',
        myReminders: 'My Reminders',
        identifyYourPlant: 'Identify Your Plant',
        plantPreviewAlt: 'Plant preview',
        clickToSelect: 'Click to select a photo',
        dragAndDrop: 'or drag and drop it here',
        analyzing: 'Analyzing...',
        analyzeButton: 'Analyze Plant Photo',
        reminderButton: 'Reminder',
        shareButton: 'Share',
        reminderSetNotice: 'A watering reminder is active for this plant. You can manage it in the "My Reminders" tab.',
        welcome: {
            title: 'To get started, upload and analyze a photo of your plant.',
            subtitle: 'Then you can ask more questions!'
        },
        input: {
            listening: 'Listening...',
            askMore: 'Ask another question...',
            analyzeFirst: 'Analyze a plant first...'
        },
        myWateringReminders: 'My Watering Reminders',
        noReminders: {
            title: 'You haven\'t set any reminders yet.',
            subtitle: 'Analyze a plant in the "Identify & Chat" tab to set a watering reminder for it.'
        },
        reminderCard: {
            every: 'Every',
            days: 'days',
            nextWatering: 'Next watering:'
        },
        reminderModal: {
            title: 'Set Watering Reminder',
            description: 'How often should we remind you to water {plantName}?',
            days: 'days',
            saveButton: 'Save Reminder',
            cancelButton: 'Cancel'
        },
        errors: {
            selectPhoto: 'Please select a photo first.',
            analysisError: 'An error occurred while analyzing the image. Please try again.',
            serverError: 'An error occurred while communicating with the server. Please try again.',
            speechRecognition: 'A speech recognition error occurred.'
        },
        aria: {
            stopRecording: 'Stop recording',
            startRecording: 'Start recording',
            sendMessage: 'Send message',
            deleteReminder: 'Delete reminder for {plantName}'
        },
        share: {
            title: '🌿 Plant Identified: {plantName}',
            text: 'I just identified the "{plantName}" plant with the Gardening Assistant!\n\nShort intro:\n{description}',
            noInfo: 'No information found.'
        },
        reminderAlert: '🌿 Don\'t forget! Today is watering day for "{plantName}".'
    }
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    const savedLang = localStorage.getItem('app-lang');
    return (savedLang === 'en' || savedLang === 'fa') ? savedLang : 'fa';
  });

  useEffect(() => {
    localStorage.setItem('app-lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const useTranslations = () => {
    const { lang } = useLanguage();
    return translations[lang];
}
