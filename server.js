const server = require('http').createServer();
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3003;

// 存储短ID到socket.id的映射
const shortIdToSocketId = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 初始时仍然发送socket.id，但客户端会忽略它并使用自己生成的短ID
  socket.emit('me', socket.id);
  
  // 接收客户端发送的短ID并存储映射
  socket.on('registerShortId', (shortId) => {
    console.log(`Registering short ID: ${shortId} for socket: ${socket.id}`);
    // 存储短ID到socket.id的映射
    shortIdToSocketId.set(shortId, socket.id);
    // 将短ID关联到socket对象，便于断开连接时清理
    socket.shortId = shortId;
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // 清理映射
    if (socket.shortId) {
      console.log(`Removing short ID: ${socket.shortId}`);
      shortIdToSocketId.delete(socket.shortId);
    }
    socket.broadcast.emit('callended');
  });

  socket.on('calluser', ({ userToCall, signalData, from, name }) => {
    // 查找目标用户的socket.id
    const targetSocketId = shortIdToSocketId.get(userToCall) || userToCall;
    console.log(`Calling user: ${userToCall}, target socket: ${targetSocketId}`);
    io.to(targetSocketId).emit('calluser', { signal: signalData, from, name });
  });

  socket.on('answercall', (data) => {
    // 查找目标用户的socket.id
    const targetSocketId = shortIdToSocketId.get(data.to) || data.to;
    console.log(`Answering call to: ${data.to}, target socket: ${targetSocketId}`);
    io.to(targetSocketId).emit('callaccepted', data.signal);
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT}`);
});
