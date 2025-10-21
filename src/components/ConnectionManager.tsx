'use client';

import React, { useContext, useState } from 'react';
import { SocketContext } from '../SocketContext';
import { useI18n } from '../i18n/I18nProvider';

const ConnectionManager = () => {
  const socketContext = useContext(SocketContext);
  
  // 添加调试日志，确认上下文是否正确获取
  console.log('ConnectionManager - SocketContext:', socketContext);
  
  // 确保socketContext存在
  if (!socketContext) {
    return <div>Socket Context not available</div>;
  }
  
  const { me, call, callAccepted, callEnded, name, setName, leaveCall, callUser, answerCall } = socketContext;
  const [idToCall, setIdToCall] = useState('');
  const { t } = useI18n();

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-lg font-semibold mb-2">{t('connection')}</h2>
      <div className="flex flex-col space-y-2">
        <input
          type="text"
          placeholder={t('yourName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded"
        />
        <p>{t('yourId', { id: me })}</p>
        <input
          type="text"
          placeholder={t('idToCall')}
          value={idToCall}
          onChange={(e) => setIdToCall(e.target.value)}
          className="border p-2 rounded"
        />
        {callAccepted && !callEnded ? (
          <button onClick={leaveCall} className="bg-red-500 text-white px-4 py-2 rounded">
            {t('hangUp')}
          </button>
        ) : (
          <button 
            onClick={() => {
              console.log('Call button clicked with id:', idToCall);
              if (typeof callUser === 'function') {
                callUser(idToCall);
              } else {
                console.error('callUser is not a function:', callUser);
              }
            }} 
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            {t('call')}
          </button>
        )}
      </div>
      {call.from && !callAccepted && (
        <div className="mt-4 flex justify-around items-center">
          <p>{t('calling', { name: call.name || 'Someone' })}</p>
          <button 
            onClick={() => {
              console.log('Answer button clicked');
              if (typeof answerCall === 'function') {
                answerCall();
              } else {
                console.error('answerCall is not a function:', answerCall);
              }
            }} 
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            {t('answer')}
          </button>
        </div>
      )}
    </div>
  );
};

export default ConnectionManager;
