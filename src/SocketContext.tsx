'use client';

import React, { createContext, useState, useRef, useEffect, ReactNode } from 'react';
import Peer from 'simple-peer';

interface SocketProviderProps {
  children: ReactNode;
}

// 定义接口
interface SignalData {
  type?: string;
  sdp?: string;
  candidate?: string;
  [key: string]: unknown;
}

interface CallData {
  isReceivingCall?: boolean;
  from?: string;
  name?: string;
  signal?: SignalData;
}

interface ReceivedFile {
  name: string;
  url: string;
  type: string;
  encrypted?: boolean;
}

// 设置默认值以避免初始渲染时为空
interface SocketContextType {
  call: CallData;
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
  connectionRef: React.RefObject<Peer.Instance | null>;
}

const defaultSocketContext: SocketContextType = {
  call: {},
  callAccepted: false,
  myVideo: React.createRef(),
  userVideo: React.createRef(),
  stream: null,
  name: '',
  setName: () => {},
  callEnded: false,
  // 提供一个初始值而不是空字符串
  me: 'initial-placeholder',
  callUser: () => {},
  leaveCall: () => {},
  answerCall: () => {},
  sendData: () => {},
  receivedFiles: [],
  receivedTexts: [],
  connectionRef: React.createRef()
};

const SocketContext = createContext<SocketContextType>(defaultSocketContext);

// 使用环境变量或默认地址
const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'ws://localhost:3003';

// 定义WebSocket消息类型
interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

const ContextProvider = ({ children }: SocketProviderProps) => {
  // 只在客户端环境初始化WebSocket相关状态
  const wsRef = useRef<WebSocket | null>(null);
  const messageHandlersRef = useRef<{ [key: string]: ((data: any) => void)[] }>({});
  // 添加meRef以同步跟踪me状态
  const meRef = useRef<string>('initial-placeholder');
  
  // WebSocket连接函数
  const connectWebSocket = (url: string) => {
    // 确保只在客户端执行
    if (typeof window === 'undefined' || !window.WebSocket) {
      console.log('WebSocket not available in this environment');
      return;
    }
    
    // 关闭现有连接
    if (wsRef.current && wsRef.current.readyState === window.WebSocket.OPEN) {
      wsRef.current.close();
      console.log('Closed existing WebSocket connection');
    }

    // 创建新的WebSocket连接
    const wsUrl = url.replace(/^http/, 'ws');
    console.log('Attempting to connect to WebSocket server:', wsUrl);
    wsRef.current = new window.WebSocket(wsUrl);

    // 连接打开
    wsRef.current.onopen = () => {
      console.log('✅ WebSocket connected successfully');
    };

    // 接收消息
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received WebSocket message:', data);
        if (data.type && messageHandlersRef.current[data.type]) {
          messageHandlersRef.current[data.type].forEach(handler => handler(data));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // 连接错误
    wsRef.current.onerror = (error) => {
      console.error('❌ WebSocket connection error:', error);
    };

    // 连接关闭
    wsRef.current.onclose = (event) => {
      console.log('WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
      // 尝试重连
      setTimeout(() => {
        console.log('Attempting to reconnect...');
        connectWebSocket(url);
      }, 3000);
    };
  };

  // 发送消息函数
  const sendMessage = (event: string, data: object) => {
    const message = { type: event, ...data };
    console.log('Attempting to send message:', message);
    if (wsRef.current) {
      console.log('WebSocket readyState:', wsRef.current.readyState);
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
        console.log('✅ Message sent successfully');
      } else {
        console.error('❌ WebSocket not connected. Ready state:', wsRef.current.readyState);
      }
    } else {
      console.error('❌ WebSocket connection not initialized');
    }
  };

  // 监听消息函数
  const onMessage = (event: string, handler: (data: any) => void) => {
    if (!messageHandlersRef.current[event]) {
      messageHandlersRef.current[event] = [];
    }
    messageHandlersRef.current[event].push(handler);
    
    // 返回取消监听函数
    return () => {
      messageHandlersRef.current[event] = messageHandlersRef.current[event].filter(h => h !== handler);
    };
  };

  // 初始化WebSocket连接 - 移到组件内部以避免服务器端预渲染错误
  useEffect(() => {
    // 只在客户端执行WebSocket连接
    if (typeof window !== 'undefined' && window.WebSocket) {
      connectWebSocket(SOCKET_SERVER_URL);
    }
  }, []);
  const [stream] = useState<MediaStream | null>(null);
  // 初始设置一个临时值，稍后会更新
  const [me, setMe] = useState('initial-placeholder');
  
  // 同步me状态到ref，确保在任何时候都能访问到最新值
  useEffect(() => {
    meRef.current = me;
    console.log('me state updated:', me);
  }, [me]);
  const [call, setCall] = useState<CallData>({});
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState('');
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [receivedTexts, setReceivedTexts] = useState<string[]>([]);

  const myVideo = useRef<HTMLVideoElement>(null);
  const userVideo = useRef<HTMLVideoElement>(null);
  const connectionRef = useRef<Peer.Instance | null>(null);

  // 生成五位数（数字+字母）的随机ID
  const generateShortId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 5; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  };

  useEffect(() => {
    // Placeholder for camera access, can be removed if only file sharing is needed
    // navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    //   .then((currentStream) => {
    //     setStream(currentStream);
    //     if (myVideo.current) {
    //       myVideo.current.srcObject = currentStream;
    //     }
    //   });

    // 使用自定义的短ID替代socket.id
    const shortId = generateShortId();
    console.log('Generated short ID:', shortId);
    
    // 立即设置me状态并同步到ref
    setMe(shortId);
    meRef.current = shortId;
    console.log('Set me state and ref to:', shortId);
    
    // 向服务器注册短ID
    const registerShortId = () => {
      console.log('Preparing to register short ID:', shortId);
      sendMessage('registerShortId', { shortId });
      console.log('Registered short ID:', shortId);
    };

    // 如果WebSocket已连接，立即注册；否则等待连接
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      registerShortId();
    } else {
      // 等待连接后再注册
      const checkConnection = setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          registerShortId();
          clearInterval(checkConnection);
        }
      }, 100);
    }
    
    // 仍然监听服务器的id，但不直接使用它
    const unsubscribeMe = onMessage('me', (data: { id: string }) => {
      // 可以将服务器返回的ID存储起来用于内部使用，但显示给用户的是我们的短ID
      console.log('Server socket ID:', data.id);
    });

    // 监听呼叫消息
    const unsubscribeCallUser = onMessage('calluser', (data: { from: string, name: string, signal: SignalData }) => {
      setCall({ isReceivingCall: true, from: data.from, name: data.name, signal: data.signal });
    });

    // 监听通话结束消息
    const unsubscribeCallEnded = onMessage('callended', () => {
      leaveCall();
    });

    // 组件卸载时取消所有监听
    return () => {
      unsubscribeMe();
      unsubscribeCallUser();
      unsubscribeCallEnded();
    };
  }, []);

  const answerCall = () => {
    console.log('📞 answerCall function called');
    // 使用ref获取最新的me值，避免状态延迟问题
    const currentId = meRef.current || me;
    console.log('Current ID value (from ref/state):', currentId);
    
    // 检查ID是否有效
    if (!currentId || currentId === 'initial-placeholder') {
      console.error('Invalid current ID:', currentId);
      alert('Your connection is not ready yet. Please wait or refresh the page.');
      return;
    }
    
    // 检查是否有有效的呼叫信息
    if (!call.from) {
      console.error('No valid call information to answer');
      return;
    }
    
    setCallAccepted(true);

    // 简化Peer配置，移除可能导致问题的选项
    const peer = new Peer({ initiator: false, trickle: false });

    peer.on('signal', (data: SignalData) => {
      sendMessage('answercall', { signal: data, to: call.from });
    });

    peer.on('stream', (currentStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
      }
    });
    
    peer.on('data', (data) => {
        handleData(data);
    });

    if (call.signal) {
      // 使用string类型更安全
      peer.signal(JSON.stringify(call.signal));
    }

    connectionRef.current = peer;
  };

  const callUser = (id: string) => {
    console.log('📞 callUser function called with id:', id);
    
    // 验证输入
    if (!id || id.trim() === '') {
      console.error('❌ Empty ID provided for call');
      alert('Please enter a valid ID to call');
      return;
    }
    
    // 检查WebSocket连接状态，但提供更灵活的处理
    if (!wsRef.current) {
      console.error('❌ WebSocket connection not initialized');
      alert('Connection not ready. Please refresh the page and try again.');
      return;
    }
    
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('⚠ WebSocket not fully connected yet. Ready state:', wsRef.current.readyState);
      // 不再直接返回，而是尝试创建Peer连接
    }
    
    try {
      console.log('Creating new Peer connection...');
      // 使用ref获取最新的me值，避免状态延迟问题
      const currentId = meRef.current || me;
      console.log('Current ID value (from ref/state):', currentId);
      
      // 检查ID是否有效
      if (!currentId || currentId === 'initial-placeholder') {
        console.error('Invalid current ID:', currentId);
        alert('Your connection is not ready yet. Please wait or refresh the page.');
        return;
      }
      
      // 简化Peer配置，移除可能导致问题的选项
      const peer = new Peer({ initiator: true, trickle: false });

      peer.on('signal', (data: SignalData) => {
        console.log('Peer signaling data generated, sending call request...');
        sendMessage('calluser', { userToCall: id, signalData: data, from: currentId, name });
      });

      peer.on('stream', (currentStream) => {
        console.log('Received remote stream');
        if (userVideo.current) {
          userVideo.current.srcObject = currentStream;
        }
      });

      peer.on('data', (data) => {
        console.log('Received peer data');
        handleData(data);
      });
      
      peer.on('error', (error) => {
        console.error('Peer connection error:', error);
      });

      // 监听呼叫接受消息
      const unsubscribeCallAccepted = onMessage('callaccepted', (data: { signal: SignalData }) => {
        console.log('Call accepted signal received');
        setCallAccepted(true);
        // 使用string类型更安全
        peer.signal(JSON.stringify(data.signal));
        // 只监听一次
        unsubscribeCallAccepted();
      });

      connectionRef.current = peer;
      console.log('Peer connection initialized successfully');
    } catch (error) {
      console.error('❌ Error in callUser function:', error);
      alert('Failed to initiate call. Please try again.');
    }
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) {
      connectionRef.current.destroy();
      connectionRef.current = null;
    }
    // 重置状态而不是刷新页面
    setCall({});
    setCallAccepted(false);
  };

  const sendData = (data: string | ArrayBuffer) => {
    if (connectionRef.current && callAccepted) {
        try {
            connectionRef.current.send(data);
        } catch (error) {
            console.error('Error sending data:', error);
        }
    } else {
        console.log("Connection not ready to send data");
    }
  }

  const handleData = (data: ArrayBuffer) => {
    const stringData = new TextDecoder().decode(data);
    try {
        const parsedData = JSON.parse(stringData);
        if (parsedData.type === 'text') {
            setReceivedTexts((prev) => [...prev, parsedData.payload]);
        } else if (parsedData.type === 'file') {
            const blob = new Blob([parsedData.payload.file], { type: parsedData.payload.type });
            const url = URL.createObjectURL(blob);
            setReceivedFiles((prev) => [...prev, { name: parsedData.payload.name, url, type: parsedData.payload.type }]);
        }
    } catch {
        // If it's not JSON, treat it as plain text
        setReceivedTexts((prev) => [...prev, stringData]);
    }
  }


  return (
    <SocketContext.Provider value={{
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
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export { ContextProvider, SocketContext };
