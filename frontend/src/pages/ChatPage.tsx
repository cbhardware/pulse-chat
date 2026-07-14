import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../auth/AuthContext';
import { getMessages, sendMessage, uploadMedia } from '../lib/api';
import { SOCKET_URL } from '../lib/config';
import { getTokens } from '../lib/tokenStore';
import type { Message } from '../types';

export function ChatPage() {
  const { groupId = '' } = useParams();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  const sorted = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages]
  );

  useEffect(() => {
    if (!user || !groupId) return;

    setLoading(true);
    getMessages(groupId)
      .then((payload) => setMessages(payload))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Failed to load messages'))
      .finally(() => setLoading(false));

    const token = getTokens()?.accessToken;
    if (!token) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      socket.emit('join_group', groupId);
    });

    socket.on('new_message', (incoming: Message) => {
      if (incoming.groupId !== groupId) return;
      setMessages((current) => {
        if (current.some((m) => m.id === incoming.id)) return current;
        return [...current, incoming];
      });
    });

    socket.on('socket_error', (payload: { message?: string }) => {
      setError(payload.message || 'Socket error');
    });

    socketRef.current = socket;

    return () => {
      socket.emit('leave_group', groupId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [groupId, user]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() && !file) return;

    setSending(true);
    setError(null);

    try {
      let mediaUrl: string | undefined;
      let mediaMimeType: string | undefined;
      let messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' = 'TEXT';

      if (file) {
        const uploaded = await uploadMedia(file);
        mediaUrl = uploaded.url;
        mediaMimeType = uploaded.mimeType;

        if (uploaded.mimeType.startsWith('video/')) messageType = 'VIDEO';
        else if (uploaded.mimeType.startsWith('audio/')) messageType = 'AUDIO';
        else messageType = 'IMAGE';
      }

      const created = await sendMessage(groupId, {
        content: text.trim() || undefined,
        messageType,
        mediaUrl,
        mediaMimeType,
      });

      setMessages((current) => [...current, created]);
      setText('');
      setFile(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div>
          <h1>Group Chat</h1>
          <p className="muted">Group ID: {groupId}</p>
        </div>
        <Link className="ghost link-btn" to="/groups">Back to groups</Link>
      </header>

      <section className="card chat-card">
        {loading && <p>Loading messages...</p>}
        {error && <p className="error">{error}</p>}
        <div className="messages">
          {sorted.map((message) => (
            <article className="message" key={message.id}>
              <header>
                <strong>{message.sender.name || message.sender.phoneNumber}</strong>
                <small>{new Date(message.createdAt).toLocaleString()}</small>
              </header>
              {message.content && <p>{message.content}</p>}
              {message.mediaUrl && (
                <a href={message.mediaUrl} target="_blank" rel="noreferrer">Open media</a>
              )}
            </article>
          ))}
        </div>

        <form onSubmit={onSend} className="send-form">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message"
            rows={3}
          />
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            accept="image/*,video/*,audio/*"
          />
          <button type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send'}</button>
        </form>
      </section>
    </div>
  );
}
