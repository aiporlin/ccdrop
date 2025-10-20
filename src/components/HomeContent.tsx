'use client';

import { useEffect } from 'react';
import ConnectionManager from "./ConnectionManager";
import FileUpload from "./FileUpload";
import ReceivedData from "./ReceivedData";
import TextShare from "./TextShare";
import { useI18n } from "../i18n/I18nProvider";

interface HomeContentProps {
  lang: string;
}

export default function HomeContent({ lang }: HomeContentProps) {
  const { t, setLocale, locale } = useI18n();
  
  // Set locale based on route parameter when component mounts
  useEffect(() => {
    if (lang && ['en', 'zh'].includes(lang)) {
      setLocale(lang as 'en' | 'zh');
    }
  }, [lang, setLocale]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-gray-100">
      <div className="absolute top-4 right-4">
        <button 
          onClick={() => window.location.href = '/en'}
          disabled={locale === 'en'} 
          className="px-3 py-1 rounded-l-md bg-blue-500 text-white disabled:bg-gray-400"
        >
          EN
        </button>
        <button 
          onClick={() => window.location.href = '/zh'}
          disabled={locale === 'zh'} 
          className="px-3 py-1 rounded-r-md bg-blue-500 text-white disabled:bg-gray-400"
        >
          中文
        </button>
      </div>
      <h1 className="text-4xl font-bold mb-8">{t('title')}</h1>
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <ConnectionManager />
        </div>
        <div>
          <FileUpload />
          <TextShare />
          <ReceivedData />
        </div>
      </div>
    </main>
  );
}