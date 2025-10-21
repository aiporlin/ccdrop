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

export interface ReceivedText {
  content: string;
  encrypted: boolean;
}

const SocketContext = createContext<{
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
  receivedTexts: ReceivedText[];
  connectionRef: React.RefObject<Peer.Instance | null>;
}>({
  call: {},
  callAccepted: false,
  myVideo: React.createRef(),
  userVideo: React.createRef(),
  stream: null,
  name: '',
  setName: () => {},
  callEnded: false,
  me: '',
  callUser: () => {},
  leaveCall: () => {},
  answerCall: () => {},
  sendData: () => {},
  receivedFiles: [],
  receivedTexts: [],
  connectionRef: React.createRef()
});

// WebSocket服务器URL配置 - 支持内网使用
// 从环境变量获取WebSocket服务器地址，默认为ws://localhost:3003
const DEFAULT_SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'ws://localhost:3003';

// 获取适合当前环境的WebSocket服务器URL
export const getWebSocketServerUrl = () => {
  // 如果是生产环境或者已经配置了具体的IP地址，则直接使用配置的URL
  if (process.env.NODE_ENV === 'production' || !DEFAULT_SOCKET_SERVER_URL.includes('localhost') && !DEFAULT_SOCKET_SERVER_URL.includes('0.0.0.0')) {
    return DEFAULT_SOCKET_SERVER_URL;
  }
  
  // 在开发环境下，如果使用localhost或0.0.0.0，则尝试使用window.location.hostname
  // 这样客户端会连接到与页面相同的主机地址
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    const port = DEFAULT_SOCKET_SERVER_URL.split(':').pop();
    return `${protocol}//${hostname}:${port}`;
  }
  
  // 回退到默认URL
  return DEFAULT_SOCKET_SERVER_URL;
};

// 导出SOCKET_SERVER_URL以便其他组件使用，同时保持向后兼容性
const SOCKET_SERVER_URL = DEFAULT_SOCKET_SERVER_URL;
export { SOCKET_SERVER_URL };

// 定义WebSocket消息类型
interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

const ContextProvider = ({ children }: SocketProviderProps) => {
  // 只在客户端环境初始化WebSocket相关状态
  const wsRef = useRef<WebSocket | null>(null);
  const messageHandlersRef = useRef<{ [key: string]: ((data: any) => void)[] }>({});
  
  // WebSocket连接函数
  const connectWebSocket = (url: string) => {
    // 确保只在客户端执行
    if (typeof window === 'undefined' || !window.WebSocket) {
      return;
    }
    
    // 关闭现有连接
    if (wsRef.current && wsRef.current.readyState === window.WebSocket.OPEN) {
      wsRef.current.close();
    }

    // 创建新的WebSocket连接
    const wsUrl = url.replace(/^http/, 'ws');
    wsRef.current = new window.WebSocket(wsUrl);

    // 连接打开
    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
    };

    // 接收消息
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type && messageHandlersRef.current[data.type]) {
          messageHandlersRef.current[data.type].forEach(handler => handler(data));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // 连接错误
    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // 连接关闭
    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      // 尝试重连
      setTimeout(() => {
        connectWebSocket(url);
      }, 3000);
    };
  };

  // 发送消息函数
  const sendMessage = (event: string, data: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: event, ...data }));
    } else {
      console.error('WebSocket not connected');
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
      // 使用智能URL解析函数获取适合当前环境的WebSocket服务器地址
      const wsUrl = getWebSocketServerUrl();
      console.log('Connecting to WebSocket server:', wsUrl);
      connectWebSocket(wsUrl);
    }
  }, []);
  const [stream] = useState<MediaStream | null>(null);
  const [me, setMe] = useState('');
  const [call, setCall] = useState<CallData>({});
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState('');
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [receivedTexts, setReceivedTexts] = useState<ReceivedText[]>([]);

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

    // 只在客户端生成随机ID，避免hydration不匹配
    let shortId = '';
    if (typeof window !== 'undefined') {
      // 使用自定义的短ID替代socket.id
      shortId = generateShortId();
      setMe(shortId);
    }
    
    // 向服务器注册短ID
    const registerShortId = () => {
      if (shortId) {
        sendMessage('registerShortId', { shortId });
        console.log('Registered short ID:', shortId);
      }
    };

    // 如果WebSocket已连接且有shortId，立即注册；否则等待连接
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && shortId) {
      registerShortId();
    } else if (shortId) {
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
    setCallAccepted(true);
    setCallEnded(false); // 确保重置callEnded状态

    // 添加STUN和可选的TURN服务器配置，增强连接成功率
    const peer = new Peer({
      initiator: false, 
      trickle: false, 
      stream: stream || undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          // 添加备用STUN服务器
          { urls: 'stun:stun.services.mozilla.com' }
        ]
      }
    });

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
    
    // 添加错误处理
    peer.on('error', (error) => {
      console.error('Peer error in answerCall:', error);
      // 只在连接未建立时重置状态
      if (!callAccepted || callEnded) {
        leaveCall();
      }
    });
    
    // 添加连接关闭处理
    peer.on('close', () => {
      console.log('Peer connection closed');
      if (!callEnded) {
        leaveCall();
      }
    });

    if (call.signal) {
      // 使用string类型更安全
      peer.signal(JSON.stringify(call.signal));
    }

    connectionRef.current = peer;
  };

  const callUser = (id: string) => {
    setCallEnded(false); // 确保重置callEnded状态
    
    // 添加STUN和可选的TURN服务器配置，增强连接成功率
    const peer = new Peer({
      initiator: true, 
      trickle: false, 
      stream: stream || undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          // 添加备用STUN服务器
          { urls: 'stun:stun.services.mozilla.com' }
        ]
      }
    });

    peer.on('signal', (data: SignalData) => {
      sendMessage('calluser', { userToCall: id, signalData: data, from: me, name });
    });

    peer.on('stream', (currentStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
      }
    });

    peer.on('data', (data) => {
        handleData(data);
    });
    
    // 添加错误处理
    peer.on('error', (error) => {
      console.error('Peer error in callUser:', error);
      // 只在连接未建立时重置状态
      if (!callAccepted || callEnded) {
        leaveCall();
      }
    });
    
    // 添加连接关闭处理
    peer.on('close', () => {
      console.log('Peer connection closed');
      if (!callEnded) {
        leaveCall();
      }
    });

    // 监听呼叫接受消息
    const unsubscribeCallAccepted = onMessage('callaccepted', (data: { signal: SignalData }) => {
      setCallAccepted(true);
      // 使用string类型更安全
      peer.signal(JSON.stringify(data.signal));
      // 只监听一次
      unsubscribeCallAccepted();
    });

    connectionRef.current = peer;
  };

  const leaveCall = () => {
    // 首先设置状态为已结束，防止其他函数继续尝试发送数据
    setCallEnded(true);
    
    try {
      // 安全地销毁Peer连接
      if (connectionRef.current) {
        // 先检查连接状态
        if (connectionRef.current.connected || connectionRef.current.destroy) {
          try {
            connectionRef.current.destroy();
          } catch (e) {
            console.log('Peer already destroyed or closing');
          }
        }
        connectionRef.current = null;
      }
    } catch (error) {
      console.error('Error during leaveCall:', error);
    }
    
    // 重置所有相关状态
    setCall({});
    setCallAccepted(false);
    
    console.log('Call ended and resources cleaned up');
  };

  const sendData = (data: string | ArrayBuffer) => {
    // 增强检查，确保connectionRef.current存在且未被销毁
    if (connectionRef.current && callAccepted && !callEnded) {
        try {
            // 在发送前再次确认peer状态
            if (connectionRef.current.connected) {
                connectionRef.current.send(data);
            } else {
                console.log("Peer is not connected yet, cannot send data");
            }
        } catch (error) {
            console.error('Error sending data:', error);
        }
    } else {
        console.log("Connection not ready to send data or call ended");
    }
  }

  const handleData = (data: ArrayBuffer) => {
    const stringData = new TextDecoder().decode(data);
    try {
        const parsedData = JSON.parse(stringData);
        if (parsedData.type === 'text') {
            // 保存完整的文本对象，包含加密标志
            const textData: ReceivedText = {
              content: parsedData.payload,
              encrypted: parsedData.encrypted || false
            };
            setReceivedTexts((prev: ReceivedText[]) => [...prev, textData]);
        } else if (parsedData.type === 'file') {
            // 确保正确处理文件内容，特别是加密文件
            // 对于字符串类型的文件内容（加密后的），需要特殊处理
            let fileContent: any = parsedData.payload.file;
            
            // 如果是加密的文件内容（字符串），我们需要将其转换为Blob
            if (typeof fileContent === 'string') {
                fileContent = new TextEncoder().encode(fileContent);
            }
            
            const blob = new Blob([fileContent], { type: parsedData.payload.type });
            const url = URL.createObjectURL(blob);
            
            // 保存文件信息，包含加密标志
            setReceivedFiles((prev) => [...prev, {
              name: parsedData.payload.name, 
              url, 
              type: parsedData.payload.type,
              encrypted: parsedData.payload.encrypted || false
            }]);
        }
    } catch (error) {
        console.error('Error parsing received data:', error);
        // If it's not JSON, treat it as plain text
        const plainText: ReceivedText = { content: stringData, encrypted: false };
        setReceivedTexts((prev: ReceivedText[]) => [...prev, { content: plainText.content, encrypted: false }]);
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
