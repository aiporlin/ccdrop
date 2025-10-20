'use client';

import React, { useContext, useState } from 'react';
import { SocketContext } from '../SocketContext';
import * as CryptoJS from 'crypto-js';
import { useI18n } from '@/i18n/I18nProvider';

const FileUpload = () => {
  const { sendData, callAccepted } = useContext(SocketContext);
  const [files, setFiles] = useState<FileList | null>(null);
  const [password, setPassword] = useState('');
  const { t } = useI18n();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
  };

  const handleSendFiles = () => {
    if (files && callAccepted) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
          let fileContent: string | ArrayBuffer = reader.result!;
          if (password) {
            fileContent = CryptoJS.AES.encrypt(fileContent.toString(), password).toString();
          }
          
          const data = JSON.stringify({
            type: 'file',
            payload: {
              file: fileContent,
              name: file.name,
              type: file.type,
              encrypted: !!password
            }
          });
          sendData(data);
        };
        reader.readAsArrayBuffer(file);
      });
      setFiles(null);
      setPassword('');
      // Clear the file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if(fileInput) fileInput.value = '';
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-lg font-semibold mb-2">{t('fileTransfer')}</h2>
      <input id="file-input" type="file" multiple onChange={handleFileChange} className="mb-2" />
      <input
        type="password"
        placeholder={t('encryptionPasswordOptional')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />
      <button onClick={handleSendFiles} disabled={!files || !callAccepted} className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400">
        {t('sendFiles')}
      </button>
    </div>
  );
};

export default FileUpload;
