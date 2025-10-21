'use client';

import React, { useContext, useState } from 'react';
import { SocketContext } from '../SocketContext';
import * as CryptoJS from 'crypto-js';
import { useI18n } from '@/i18n/I18nProvider';

const TextShare = () => {
  const { sendData, callAccepted } = useContext(SocketContext);
  const [text, setText] = useState('');
  const [password, setPassword] = useState('');
  const { t } = useI18n();

  const handleSendText = () => {
    if (text && callAccepted) {
      let content = text;
      if (password) {
        content = CryptoJS.AES.encrypt(text, password).toString();
      }
      const data = JSON.stringify({
        type: 'text',
        payload: content,
        encrypted: !!password
      });
      sendData(data);
      setText('');
      setPassword('');
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mt-4">
      <h2 className="text-lg font-semibold mb-2">{t('textSharing')}</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('enterText')}
        className="border p-2 rounded w-full mb-2"
      />
      <input
        type="password"
        placeholder={t('encryptionPasswordOptional')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />
      <button onClick={handleSendText} disabled={!text || !callAccepted} className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400">
        {t('sendText')}
      </button>
    </div>
  );
};

export default TextShare;
