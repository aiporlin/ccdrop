'use client';

import React, { useState, useEffect } from 'react';
import { generateRoomId, generateKey } from '../services/encryption';
import { useI18n } from '@/i18n/I18nProvider';

interface RoomManagerProps {
  onRoomCreated?: (roomId: string, key?: string) => void;
  onJoinRoom?: (roomId: string, key?: string) => void;
}

const RoomManager: React.FC<RoomManagerProps> = ({ onRoomCreated, onJoinRoom }) => {
  const [roomId, setRoomId] = useState('');
  const [generatedRoomId, setGeneratedRoomId] = useState('');
  const [key, setKey] = useState('');
  const [generateKeyEnabled, setGenerateKeyEnabled] = useState(true);
  const { t } = useI18n();

  // 创建房间
  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    const newKey = generateKeyEnabled ? generateKey() : '';
    setGeneratedRoomId(newRoomId);
    setKey(newKey);
    onRoomCreated?.(newRoomId, newKey);
    // 复制房间ID到剪贴板
    navigator.clipboard.writeText(newRoomId).catch(err => {
      console.error('无法复制到剪贴板:', err);
    });
  };

  // 加入房间
  const handleJoinRoom = () => {
    if (roomId.trim()) {
      onJoinRoom?.(roomId.trim(), key.trim() || undefined);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-lg font-semibold mb-4">{t('roomManagement')}</h2>
      
      {/* 创建房间 */}
      <div className="mb-6">
        <h3 className="font-medium mb-2">{t('createRoom')}</h3>
        <div className="flex flex-col space-y-2">
          <div className="flex items-center">
            <input 
              type="checkbox" 
              id="generateKey" 
              checked={generateKeyEnabled} 
              onChange={(e) => setGenerateKeyEnabled(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="generateKey">{t('generateEncryptionKey')}</label>
          </div>
          <button 
            onClick={handleCreateRoom} 
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            {t('createNewRoom')}
          </button>
        </div>
      </div>

      {/* 加入房间 */}
      <div>
        <h3 className="font-medium mb-2">{t('joinRoom')}</h3>
        <div className="flex flex-col space-y-2">
          <input
            type="text"
            placeholder={t('enterRoomId')}
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            type="text"
            placeholder={t('enterEncryptionKeyOptional')}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="border p-2 rounded"
          />
          <button 
            onClick={handleJoinRoom} 
            disabled={!roomId.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
          >
            {t('joinExistingRoom')}
          </button>
        </div>
      </div>

      {/* 显示生成的房间信息 */}
      {generatedRoomId && (
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <p><strong>{t('yourRoomId')}:</strong> {generatedRoomId}</p>
          {key && <p><strong>{t('yourEncryptionKey')}:</strong> {key}</p>}
          <p className="text-sm text-gray-600 mt-1">{t('shareRoomIdWithOthers')}</p>
        </div>
      )}
    </div>
  );
};

export default RoomManager;