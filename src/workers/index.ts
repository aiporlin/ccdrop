// Cloudflare Workers 实现的信令服务器
// 不依赖Durable Objects的版本

// 导入Cloudflare Workers类型
import type { ExecutionContext } from '@cloudflare/workers-types';

// 定义WebSocket消息类型
interface RegisterMessage {
  type: 'registerShortId';
  shortId: string;
}

interface CallUserMessage {
  type: 'calluser';
  userToCall: string;
  signalData: any;
  from: string;
  name: string;
}

interface AnswerCallMessage {
  type: 'answercall';
  signal: any;
  to: string;
}

type WebSocketMessage = RegisterMessage | CallUserMessage | AnswerCallMessage;

// 使用全局Map存储连接（注意：这只在单个Worker实例内有效）
// 在生产环境中，多个Worker实例之间不会共享这些Map
const connections = new Map<string, WebSocket>();
const reverseMap = new Map<WebSocket, string>();

// 处理WebSocket连接
async function handleWebSocket(ws: WebSocket): Promise<void> {
  // 发送初始消息，包含临时ID
  const tempId = `temp-${Math.random().toString(36).substr(2, 9)}`;
  ws.send(JSON.stringify({ type: 'me', id: tempId }));

  // 处理WebSocket消息
  ws.onmessage = (event: { data: string }) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      handleMessage(ws, message);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  // 处理连接关闭
  ws.onclose = () => {
    const shortId = reverseMap.get(ws);
    if (shortId) {
      console.log(`User disconnected: ${shortId}`);
      connections.delete(shortId);
      reverseMap.delete(ws);
      // 广播callended事件
      broadcastCallEnded(shortId);
    }
  };

  // 处理错误
  ws.onerror = (ev: Event) => {
    console.error('WebSocket error:', ev);
    const shortId = reverseMap.get(ws);
    if (shortId) {
      connections.delete(shortId);
      reverseMap.delete(ws);
    }
    ws.close();
  };
}

// 处理各种类型的消息
function handleMessage(ws: WebSocket, message: WebSocketMessage): void {
  switch (message.type) {
    case 'registerShortId':
      registerShortId(ws, message.shortId);
      break;
    case 'calluser':
      handleCallUser(message);
      break;
    case 'answercall':
      handleAnswerCall(message);
      break;
  }
}

// 注册短ID
function registerShortId(ws: WebSocket, shortId: string): void {
  console.log(`Registering short ID: ${shortId}`);
  
  // 如果该短ID已被其他连接使用，先清理旧连接
  const existingWs = connections.get(shortId);
  if (existingWs && existingWs !== ws) {
    const oldShortId = reverseMap.get(existingWs);
    if (oldShortId) {
      reverseMap.delete(existingWs);
    }
    try {
      existingWs.close();
    } catch (e) {
      console.error('Error closing old connection:', e);
    }
  }

  // 更新映射
  connections.set(shortId, ws);
  reverseMap.set(ws, shortId);
}

// 处理呼叫用户消息
function handleCallUser(message: CallUserMessage): void {
  const { userToCall, signalData, from, name } = message;
  const targetWs = connections.get(userToCall);
  
  if (targetWs) {
    console.log(`Calling user: ${userToCall} from ${from}`);
    // 发送呼叫消息给目标用户
    targetWs.send(JSON.stringify({
      type: 'calluser',
      signal: signalData,
      from,
      name
    }));
  } else {
    console.log(`User ${userToCall} not found`);
    // 如果目标用户不存在，可以发送错误消息给呼叫方
    const callerWs = connections.get(from);
    if (callerWs) {
      callerWs.send(JSON.stringify({
        type: 'error',
        message: 'User not found'
      }));
    }
  }
}

// 处理接听呼叫消息
function handleAnswerCall(message: AnswerCallMessage): void {
  const { signal, to } = message;
  const targetWs = connections.get(to);
  
  if (targetWs) {
    console.log(`Answering call to: ${to}`);
    // 发送接受呼叫消息给发起方
    targetWs.send(JSON.stringify({
      type: 'callaccepted',
      signal
    }));
  }
}

// 广播通话结束消息
function broadcastCallEnded(excludeId: string): void {
  for (const [shortId, ws] of connections.entries()) {
    if (shortId !== excludeId) {
      try {
        ws.send(JSON.stringify({ type: 'callended' }));
      } catch (e) {
        console.error('Error broadcasting call ended:', e);
      }
    }
  }
}

// Workers入口函数
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // 处理CORS预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection'
        }
      });
    }

    // 处理WebSocket连接
    if (request.headers.get('Upgrade') === 'websocket') {
      // @ts-ignore - Cloudflare环境中的WebSocket处理
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      // 为server对象添加类型断言
      const serverWs = server as any;

      // 接受WebSocket连接
      serverWs.accept();

      // 处理WebSocket连接
      handleWebSocket(serverWs);

      // 使WebSocket连接在请求处理完成后保持活跃
      ctx.waitUntil(new Promise(() => {})); // 这会使Worker保持运行直到WebSocket连接关闭

      // 返回WebSocket响应
      return new Response(null, {
        status: 101,
        // @ts-ignore - Cloudflare环境中的WebSocket处理
        webSocket: client
      });
    }

    // 处理普通HTTP请求
    return new Response('CCDrop Signaling Server is running without Durable Objects', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};