'use client';

import React, { useContext, useState } from 'react';
import { SocketContext } from '../SocketContext';
import { useI18n } from '@/i18n/I18nProvider';

const ConnectionManager = () => {
  const { me, call, callAccepted, callEnded, name, setName, leaveCall, callUser, answerCall } = useContext(SocketContext);
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
          <button onClick={() => callUser(idToCall)} className="bg-green-500 text-white px-4 py-2 rounded">
            {t('call')}
          </button>
        )}
      </div>
      {call.isReceivingCall && !callAccepted && (
        <div className="mt-4 flex justify-around items-center">
          <p>{t('calling', { name: call.name || 'Someone' })}</p>
          <button onClick={answerCall} className="bg-green-500 text-white px-4 py-2 rounded">
            {t('answer')}
          </button>
        </div>
      )}
    </div>
  );
};

export default ConnectionManager;
