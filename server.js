const http = require('http');
const WebSocket = require('ws');
const PORT = process.env.PORT || 3003;

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*'
  });
  res.end('CCDrop Signaling Server is running');
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 存储连接映射
const connections = new Map();
const reverseMap = new Map();

wss.on('connection', (ws) => {
  // 生成临时ID
  const tempId = `temp-${Math.random().toString(36).substr(2, 9)}`;
  console.log('User connected:', tempId);
  
  // 发送初始消息
  ws.send(JSON.stringify({ type: 'me', id: tempId }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'registerShortId':
          // 注册短ID
          const shortId = data.shortId;
          console.log(`Registering short ID: ${shortId}`);
          
          // 如果该短ID已被使用，清理旧连接
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
          break;
          
        case 'calluser':
          // 查找目标用户
          const targetWs = connections.get(data.userToCall);
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            console.log(`Calling user: ${data.userToCall} from ${data.from}`);
            targetWs.send(JSON.stringify({
              type: 'calluser',
              signal: data.signalData,
              from: data.from,
              name: data.name
            }));
          }
          break;
          
        case 'answercall':
          // 查找目标用户
          const answerTargetWs = connections.get(data.to);
          if (answerTargetWs && answerTargetWs.readyState === WebSocket.OPEN) {
            console.log(`Answering call to: ${data.to}`);
            answerTargetWs.send(JSON.stringify({
              type: 'callaccepted',
              signal: data.signal
            }));
          }
          break;
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    const shortId = reverseMap.get(ws);
    if (shortId) {
      console.log(`User disconnected: ${shortId}`);
      connections.delete(shortId);
      reverseMap.delete(ws);
      
      // 广播callended事件
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client !== ws) {
          client.send(JSON.stringify({ type: 'callended' }));
        }
      });
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    const shortId = reverseMap.get(ws);
    if (shortId) {
      connections.delete(shortId);
      reverseMap.delete(ws);
    }
  });
});

// 启动服务器 - 监听0.0.0.0以接受局域网内所有设备的连接
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Signaling server listening on port ${PORT}`);
  console.log(`Server is accessible from local network on any device`);
});

// 处理CORS预检请求
server.on('request', (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection'
    });
    res.end();
  }
});
