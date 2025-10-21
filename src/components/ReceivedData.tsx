'use client';

import React, { useContext, useState } from 'react';
import { SocketContext, ReceivedText } from '../SocketContext';
import * as CryptoJS from 'crypto-js';
import { useI18n } from '@/i18n/I18nProvider';

const ReceivedData = () => {
  const { receivedFiles, receivedTexts } = useContext(SocketContext);
  const [password, setPassword] = useState('');
  const [decryptedTexts, setDecryptedTexts] = useState<{ [key: number]: string }>({});
  const { t } = useI18n();

  const handleDecryptText = (textData: ReceivedText, index: number) => {
    if (password && textData.encrypted) {
      try {
        const bytes = CryptoJS.AES.decrypt(textData.content, password);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        if (originalText) {
          setDecryptedTexts(prev => ({ ...prev, [index]: originalText }));
        } else {
          alert(t('decryptionFailed'));
        }
      } catch {
        alert(t('decryptionFailed'));
      }
    }
  };
  
  const handleDownload = (fileUrl: string, fileName: string, isEncrypted: boolean) => {
    if (isEncrypted && !password) {
        alert(t('fileEncrypted'));
        return;
    }

    fetch(fileUrl)
        .then(response => response.arrayBuffer())
        .then(encryptedData => {
            const decryptedData = encryptedData;
            if (isEncrypted) {
                try {
                    alert(t('fileDecryptionWarning'));
                } catch {
                    alert(t('decryptionFailed'));
                    return;
                }
            }
            
            const blob = new Blob([decryptedData]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        });
};


  return (
    <div className="bg-white p-4 rounded-lg shadow-md mt-4">
      <h2 className="text-lg font-semibold mb-2">{t('receivedData')}</h2>
      <input
        type="password"
        placeholder={t('decryptionPassword')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />
      <div>
        <h3 className="font-semibold">{t('files')}</h3>
        {receivedFiles.length === 0 && <p>{t('noFiles')}</p>}
        <ul>
          {receivedFiles.map((file: {name: string, url: string, type: string, encrypted?: boolean}, index: number) => (
            <li key={index} className="flex justify-between items-center">
              <span>{file.name} ({file.type})</span>
              <button onClick={() => handleDownload(file.url, file.name, file.encrypted || false)} className="text-blue-500 hover:underline">
                {t('download')}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        <h3 className="font-semibold">{t('texts')}</h3>
        {receivedTexts.length === 0 && <p>{t('noTexts')}</p>}
        <ul>
          {receivedTexts.map((textData: ReceivedText, index: number) => (
            <li key={index} className="p-2 border-b">
              <p className="truncate">{decryptedTexts[index] || textData.content}</p>
              {!decryptedTexts[index] && textData.encrypted && (
                <button onClick={() => handleDecryptText(textData, index)} className="text-sm text-blue-500">{t('decrypt')}</button>
              )}
              {textData.encrypted && !decryptedTexts[index] && (
                <span className="ml-2 text-xs text-gray-500">[Encrypted]</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ReceivedData;
