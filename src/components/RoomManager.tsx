import React, { useState, useEffect } from 'react';
import { generateRoomId, generateKey } from '../services/encryption';
import fileTransferService from '../services/fileTransfer';

interface RoomManagerProps {
  onConnectionEstablished?: (roomId: string, encryptionKey: string) => void;
}

const RoomManager: React.FC<RoomManagerProps> = ({ onConnectionEstablished }) => {
  const [roomId, setRoomId] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // 生成新房间
  const createNewRoom = () => {
    setIsCreatingRoom(true);
    setError('');
    
    try {
      const newRoomId = generateRoomId();
      const newEncryptionKey = generateKey();
      
      setRoomId(newRoomId);
      setEncryptionKey(newEncryptionKey);
      
      // 连接到房间
      connectToRoom(newRoomId, newEncryptionKey);
    } catch (err) {
      setError('创建房间失败，请重试');
      console.error('Error creating room:', err);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // 加入已有房间
  const joinExistingRoom = () => {
    if (!roomId.trim()) {
      setError('请输入房间ID');
      return;
    }

    if (!encryptionKey.trim()) {
      setError('请输入加密密钥');
      return;
    }

    connectToRoom(roomId.trim(), encryptionKey.trim());
  };

  // 连接到房间
  const connectToRoom = (room: string, key: string) => {
    try {
      // 使用动态URL，自动适配部署环境
      // 在Cloudflare Pages中，window.location.origin会自动指向部署域名
      const serverUrl = window.location.origin;
      fileTransferService.connect(serverUrl, room, key);
      
      setIsConnected(true);
      if (onConnectionEstablished) {
        onConnectionEstablished(room, key);
      }
    } catch (err) {
      setError('连接失败，请检查房间ID和密钥');
      console.error('Error connecting to room:', err);
    }
  };

  // 复制房间信息
  const copyRoomInfo = () => {
    const info = `房间ID: ${roomId}\n加密密钥: ${encryptionKey}`;
    navigator.clipboard.writeText(info).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 断开连接
  const disconnect = () => {
    fileTransferService.disconnect();
    setIsConnected(false);
    setRoomId('');
    setEncryptionKey('');
    setError('');
  };

  // 组件卸载时断开连接
  useEffect(() => {
    return () => {
      fileTransferService.disconnect();
    };
  }, []);

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">文件快传</h2>
          <p className="text-gray-600">创建房间或加入现有房间开始传输</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4 p-6 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
            <div className="text-4xl text-center mb-4">➕</div>
            <h3 className="text-xl font-semibold text-center text-gray-800">创建新房间</h3>
            <p className="text-gray-600 text-center text-sm mb-4">
              自动生成房间ID和加密密钥
            </p>
            <button
              onClick={createNewRoom}
              disabled={isCreatingRoom}
              className={`w-full py-3 rounded-lg font-medium transition-all ${isCreatingRoom 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-primary hover:bg-primary/90 text-white'}
              `}
            >
              {isCreatingRoom ? '创建中...' : '创建房间'}
            </button>
          </div>

          <div className="space-y-4 p-6 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
            <div className="text-4xl text-center mb-4">🔗</div>
            <h3 className="text-xl font-semibold text-center text-gray-800">加入房间</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">房间ID</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="输入房间ID"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">加密密钥</label>
                <input
                  type="text"
                  value={encryptionKey}
                  onChange={(e) => setEncryptionKey(e.target.value)}
                  placeholder="输入加密密钥"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
            </div>
            
            <button
              onClick={joinExistingRoom}
              className="w-full py-3 rounded-lg bg-secondary hover:bg-secondary/90 text-white font-medium transition-all"
            >
              加入房间
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-green-700 font-medium flex items-center gap-2">
            <span className="text-lg">✓</span> 已连接到房间
          </h3>
          <button
            onClick={disconnect}
            className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
          >
            断开连接
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="font-medium text-gray-700">房间ID:</div>
            <div className="flex-1 flex items-center gap-2">
              <code className="bg-gray-100 px-3 py-1.5 rounded text-gray-800 font-mono text-sm break-all">
                {roomId}
              </code>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="font-medium text-gray-700">加密密钥:</div>
            <div className="flex-1 flex items-center gap-2">
              <code className="bg-gray-100 px-3 py-1.5 rounded text-gray-800 font-mono text-sm break-all">
                {encryptionKey}
              </code>
            </div>
          </div>
        </div>

        <button
          onClick={copyRoomInfo}
          className="mt-4 w-full py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
        >
          {copied ? '已复制！' : '复制房间信息'}
        </button>
      </div>
    </div>
  );
};

export default RoomManager;