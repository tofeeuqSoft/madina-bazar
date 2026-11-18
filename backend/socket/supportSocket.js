import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import { postChatMessage } from '../services/support/chatService.js';

// Room-based: chat:<conversationId> + ticket:<ticketId>
// Auth via JWT (same as REST). Typing / online / read receipts included.
export const initSupportSocket = (io) => {
  global.supportIO = io;

  const cookieToken = (headers) => {
    const raw = headers?.cookie || '';
    const m = raw.match(/(?:^|;\s*)accessToken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  };

  io.use(async (socket, next) => {
    try {
      // httpOnly cookie first (XSS-safe), then explicit auth (mobile apps)
      const token = cookieToken(socket.handshake.headers) || socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('No token'));
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user || !user.isActive) return next(new Error('Unauthorized'));
      socket.user = user;
      next();
    } catch (e) {
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', (socket) => {
    const { _id, role, name } = socket.user;
    socket.join(`user:${_id}`);
    io.emit('support:presence', { userId: String(_id), name, role, online: true });

    const canAccess = async (conversationId) => {
      const convo = await Conversation.findOne({ conversationId });
      if (!convo) return null;
      if (role !== 'CUSTOMER') return convo;
      if (String(convo.customer) === String(_id)) return convo;
      return null;
    };

    socket.on('chat:join', async (conversationId, ack) => {
      const convo = await canAccess(conversationId);
      if (!convo) return ack?.({ success: false, message: 'Not authorized' });
      socket.join(`chat:${conversationId}`);
      ack?.({ success: true });
    });
    socket.on('ticket:join', (ticketId) => {
      socket.join(`ticket:${ticketId}`);
    });

    socket.on('chat:typing', async ({ conversationId, typing }) => {
      if (!(await canAccess(conversationId))) return;
      socket.to(`chat:${conversationId}`).emit('chat:typing', { userId: String(_id), name, typing: !!typing });
    });

    socket.on('chat:send', async ({ conversationId, content, messageType = 'TEXT', mediaUrl = null }, ack) => {
      try {
        const convo = await canAccess(conversationId);
        if (!convo) return ack?.({ success: false, message: 'Not authorized' });
        const senderType = role === 'CUSTOMER' ? 'CUSTOMER' : 'HUMAN_AGENT';
        const msg = await postChatMessage({
          conversation: convo, senderType, senderId: _id, content, messageType, mediaUrl,
        });
        io.to(`chat:${conversationId}`).emit('chat:message', msg);
        ack?.({ success: true, data: msg });
      } catch (e) {
        ack?.({ success: false, message: e.message });
      }
    });

    socket.on('chat:read', ({ conversationId }) => {
      io.to(`chat:${conversationId}`).emit('chat:read', { userId: String(_id), at: new Date() });
    });

    // ---- Rider live location (riders only, only while on shift) ----
    // Rider app → backend → admin dashboard rooms. No continuous tracking:
    // updates accepted only when the rider has an active shift.
    socket.on('rider:location', async ({ lng, lat }, ack) => {
      try {
        if (role !== 'DELIVERY_RIDER') return ack?.({ success: false, message: 'Riders only' });
        const Rider = (await import('../models/Rider.js')).default;
        const rider = await Rider.findOne({ user: _id });
        if (!rider || !rider.activeShift) return ack?.({ success: false, message: 'No active shift' });
        const { updateLocation } = await import('../services/delivery/riderShiftService.js');
        const updated = await updateLocation({ riderId: rider._id, lng: Number(lng), lat: Number(lat) });
        io.to('admin:riders').emit('rider:location', {
          riderId: String(rider._id),
          lng: Number(lng),
          lat: Number(lat),
          at: updated.currentLocation?.updatedAt || new Date(),
        });
        ack?.({ success: true });
      } catch (e) {
        ack?.({ success: false, message: e.message });
      }
    });

    socket.on('admin:riders:watch', () => {
      if (role === 'CUSTOMER' || role === 'DELIVERY_RIDER') return;
      socket.join('admin:riders');
    });

    socket.on('disconnect', () => {
      io.emit('support:presence', { userId: String(_id), name, role, online: false });
    });
  });
};
