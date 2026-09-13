/* Панель сетевой игры. Кладётся в интерфейс симулятора рядом с рычагами.
   Логика простая: игрок собирает решения как обычно, но вместо локального
   «Завершить квартал» отправляет их в комнату и ждёт второго. Квартал считает сервер. */
import React, { useEffect, useRef, useState } from 'react';
import { createRoom, joinRoom, submitDecisions, cancelSubmission, watchRoom } from '../lib/client.js';

const SEAT_LABEL = { central_bank: 'Центральный банк', ministry_finance: 'Министерство финансов' };

export default function MultiplayerPanel({ decisions, onRoomState, style }) {
  const [id, setId] = useState('');
  const [seat, setSeat] = useState('central_bank');
  const [name, setName] = useState('');
  const [token, setToken] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const stopRef = useRef(null);

  useEffect(() => () => { if (stopRef.current) stopRef.current(); }, []);
  const watch = (roomId) => {
    if (stopRef.current) stopRef.current();
    stopRef.current = watchRoom(roomId, (r) => { setRoom(r); if (onRoomState) onRoomState(r); }, (e) => setError(e.message));
  };
  const guard = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const create = () => guard(async () => {
    const r = await createRoom({ difficulty: 'medium' });
    setId(r.id); await join(r.id);
  });
  const join = (roomId) => guard(async () => {
    const r = await joinRoom((roomId || id).toUpperCase(), seat, name || 'игрок');
    setToken(r.token); setRoom(r.room); watch(r.room.id); setId(r.room.id);
  });
  const send = () => guard(async () => {
    const r = await submitDecisions(id, seat, token, decisions);
    setRoom(r.room);
  });
  const cancel = () => guard(async () => {
    const r = await cancelSubmission(id, seat, token);
    setRoom(r.room);
  });

  const ready = room ? room.ready[seat] : false;
  const waiting = room && ready && !Object.values(room.ready).every(Boolean);

  return (
    <div style={{ border: '1px solid #28324A', borderRadius: 3, padding: 13, fontSize: 12.5, ...style }}>
      <div style={{ fontSize: 13.5, marginBottom: 8 }}>Сетевая игра</div>
      {!token && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
            {Object.keys(SEAT_LABEL).map((sx) => (
              <button key={sx} onClick={() => setSeat(sx)}
                style={{ flex: 1, padding: '6px 0', background: seat === sx ? '#C9A227' : 'transparent', color: seat === sx ? '#1B1204' : '#8B94A8' }}>
                {SEAT_LABEL[sx]}
              </button>
            ))}
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ваше имя"
            style={{ width: '100%', marginBottom: 6, padding: 6 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={id} onChange={(e) => setId(e.target.value.toUpperCase())} placeholder="код комнаты"
              style={{ flex: 1, padding: 6 }} />
            <button disabled={busy || !id} onClick={() => join()}>Войти</button>
            <button disabled={busy} onClick={create}>Создать</button>
          </div>
        </>
      )}
      {token && room && (
        <>
          <div style={{ marginBottom: 6 }}>
            Комната <b>{room.id}</b> · вы за {SEAT_LABEL[seat]} · {room.quarterLabel}
          </div>
          <div style={{ marginBottom: 8, color: '#8B94A8' }}>
            {Object.keys(SEAT_LABEL).map((sx) => (
              <div key={sx}>
                {SEAT_LABEL[sx]}: {room.occupied[sx] ? (room.names[sx] || 'игрок') : 'бот'} — {room.ready[sx] ? 'решения отправлены' : 'думает'}
              </div>
            ))}
          </div>
          {!ready && <button disabled={busy} onClick={send} style={{ width: '100%', padding: 9 }}>Отправить решения квартала</button>}
          {ready && waiting && (
            <>
              <div style={{ marginBottom: 6 }}>Ждём второго игрока…</div>
              <button disabled={busy} onClick={cancel} style={{ width: '100%', padding: 7 }}>Отозвать решения</button>
            </>
          )}
        </>
      )}
      {error && <div style={{ color: '#B0503A', marginTop: 7 }}>{error}</div>}
    </div>
  );
}
