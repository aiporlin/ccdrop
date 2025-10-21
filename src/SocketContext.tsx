'use client';
import * as React from 'react';
import { createContext, useRef, useState, useEffect, useCallback, ReactNode } from 'react';
// @ts-ignore - 忽略simple-peer的类型检查
const Peer = require('simple-peer');

// 定义类型
interface Call {
  from?: string;
  name?: string;
  signal?: any;
}

interface ReceivedFile {
  name: string;
  url: string;
  type: string;
}

interface SocketContextType {
  call: Call;
  callAccepted: boolean;
  myVideo: React.RefObject<HTMLVideoElement | null>;
  userVideo: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  callEnded: boolean;
  me: string;
  callUser: (id: string) => void;
  leaveCall: () => void;
  answerCall: () => void;
  sendData: (data: string | ArrayBuffer) => void;
  receivedFiles: ReceivedFile[];
  receivedTexts: string[];
  connectionRef: React.RefObject<any>;
}

interface ContextProviderProps {
  children: ReactNode;
}

// 创建上下文
const SocketContext = createContext<SocketContextType | undefined>(undefined);

// 生成随机ID
const generateRandomId = (): string => {
  return Math.random().toString(36).substring(2, 10);
};

const ContextProvider: React.FC<ContextProviderProps> = ({ children }) => {
  // 状态管理
  const [call, setCall] = useState<Call>({});
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState('');
  const [me, setMe] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [receivedTexts, setReceivedTexts] = useState<string[]>([]);
  
  // Refs
  const userVideo = useRef<HTMLVideoElement | null>(null);
  const myVideo = useRef<HTMLVideoElement | null>(null);
  const connectionRef = useRef<any>(null);
  const meRef = useRef(me);
  const wsRef = useRef<WebSocket | null>(null);

  // 更新ref
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  // 获取媒体流
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }
      })
      .catch((err) => {
        console.error('Error accessing media devices:', err);
      });

      return () => {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      };
    }
  }, []);

  // 初始化WebSocket连接
  useEffect(() => {
    // 生成唯一的用户ID
    const userId = generateRandomId();
    setMe(userId);
    meRef.current = userId;

    // 使用原生WebSocket
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connection established');
        ws.send(JSON.stringify({ type: 'join', id: userId }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'call':
              setCall({
                from: data.from,
                name: data.name,
                signal: data.signal
              });
              break;
            case 'callaccepted':
              setCallAccepted(true);
              if (data.signal && connectionRef.current) {
                try {
                  const signalData = typeof data.signal === 'string' ? JSON.parse(data.signal) : data.signal;
                  connectionRef.current.signal(signalData);
                } catch (error) {
                  console.error('Error applying accepted signal:', error);
                }
              }
              break;
            case 'answercall':
              if (connectionRef.current) {
                try {
                  const signalData = typeof data.signal === 'string' ? JSON.parse(data.signal) : data.signal;
                  connectionRef.current.signal(signalData);
                  setCallAccepted(true);
                } catch (error) {
                  console.error('Error applying answer signal:', error);
                }
              }
              break;
            case 'callended':
              setCallEnded(true);
              setCall({});
              setCallAccepted(false);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      return () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }, []);

  // 发送消息函数
  const sendMessage = useCallback((type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const message = {
          type,
          ...payload
        };
        wsRef.current.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  }, []);

  // 消息监听工具函数
  const onMessage = useCallback((messageType: string, callback: (data: any) => void) => {
    const listener = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === messageType) {
          callback(data);
        }
      } catch (error) {
        console.error('Error parsing message in listener:', error);
      }
    };

    if (wsRef.current) {
      wsRef.current.addEventListener('message', listener);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.removeEventListener('message', listener);
      }
    };
  }, []);

  // 处理取消订阅
  useEffect(() => {
    const unsubscribeCall = onMessage('call', (data) => {
      setCall({
        from: data.from,
        name: data.name,
        signal: data.signal
      });
    });

    const unsubscribeCallEnded = onMessage('callended', () => {
      setCallEnded(true);
      setCall({});
      setCallAccepted(false);
    });

    return () => {
      unsubscribeCall();
      unsubscribeCallEnded();
    };
  }, [onMessage]);

  // 应答通话
  const answerCall = useCallback(() => {
    const currentId = meRef.current;
    
    if (!currentId || !call.from) {
      return;
    }
    
    setCallAccepted(true);
    
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream || undefined
    });
    
    peer.on('signal', (data: any) => {
      const serializedSignal = JSON.stringify(data);
      sendMessage('answercall', { signal: serializedSignal, to: call.from });
    });
    
    peer.on('stream', (currentStream: MediaStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
      }
    });
    
    if (call.signal) {
      try {
        const signalData = typeof call.signal === 'string' ? JSON.parse(call.signal) : call.signal;
        peer.signal(signalData);
      } catch (error) {
        console.error('Error applying signal:', error);
      }
    }
    
    connectionRef.current = peer;
  }, [call, sendMessage, stream]);

  // 发起通话
  const callUser = useCallback((id: string) => {
    if (!id || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const currentId = meRef.current;
    
    if (!currentId) {
      return;
    }
    
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream || undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    });
    
    peer.on('signal', (data: any) => {
      const serializedSignal = JSON.stringify(data);
      sendMessage('calluser', {
        userToCall: id,
        signalData: serializedSignal,
        from: currentId,
        name: name
      });
    });
    
    peer.on('stream', (currentStream: MediaStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
      }
    });
    
    const unsubscribeCallAccepted = onMessage('callaccepted', (data) => {
      setCallAccepted(true);
      if (data.signal && connectionRef.current) {
        try {
          const signalData = typeof data.signal === 'string' ? JSON.parse(data.signal) : data.signal;
          connectionRef.current.signal(signalData);
        } catch (error) {
          console.error('Error applying accepted signal:', error);
        }
      }
      unsubscribeCallAccepted();
    });
    
    connectionRef.current = peer;
  }, [sendMessage, stream, name, onMessage]);

  // 离开通话
  const leaveCall = useCallback(() => {
    setCallEnded(true);
    
    if (connectionRef.current) {
      connectionRef.current.destroy();
      connectionRef.current = null;
    }
    
    setCall({});
    setCallAccepted(false);
  }, []);

  // 发送数据
  const sendData = useCallback((data: string | ArrayBuffer) => {
    if (connectionRef.current && callAccepted) {
      connectionRef.current.send(data);
    }
  }, [callAccepted]);

  // 处理接收到的数据
  const handleData = useCallback((data: ArrayBuffer) => {
    const stringData = new TextDecoder().decode(data);
    
    try {
      const parsedData = JSON.parse(stringData);
      
      if (parsedData.type === 'text') {
        setReceivedTexts(prev => [...prev, parsedData.payload]);
      } else if (parsedData.type === 'file') {
        const blob = new Blob([new Uint8Array(parsedData.payload.file)], { type: parsedData.payload.type });
        const url = URL.createObjectURL(blob);
        setReceivedFiles(prev => [...prev, { 
          name: parsedData.payload.name, 
          url, 
          type: parsedData.payload.type 
        }]);
      }
    } catch {
      setReceivedTexts(prev => [...prev, stringData]);
    }
  }, []);

  // 提供上下文值
  const contextValue: SocketContextType = {
    call,
    callAccepted,
    myVideo,
    userVideo,
    stream,
    name,
    setName,
    callEnded,
    me,
    callUser,
    leaveCall,
    answerCall,
    sendData,
    receivedFiles,
    receivedTexts,
    connectionRef
  };

  return React.createElement(
    SocketContext.Provider,
    { value: contextValue },
    children
  );
};

export { ContextProvider, SocketContext };
