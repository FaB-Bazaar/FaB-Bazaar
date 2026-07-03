// In-memory room store. Two players per room, bounded event buffers, a small
// replayable snapshot (hero/life) for late joiners, and TTL sweeping.
// Errors are typed and carry context — a diagnosing agent should be able to
// tell what went wrong from the error alone.
import { randomBytes } from 'node:crypto';

export class RoomError extends Error {
  constructor(code, message, context = {}) {
    super(`${code}: ${message} ${JSON.stringify(context)}`);
    this.name = 'RoomError';
    this.code = code;
    this.context = context;
  }
}

export function createRooms({
  log,
  now = Date.now,
  maxEvents = 200,
  roomTtlMs = 4 * 60 * 60 * 1000,
  initial = null, // a serialize() blob to rehydrate from (survives a deploy)
} = {}) {
  const rooms = new Map(); // id -> { members, events, snapshot, subscribers, touchedAt }

  // Rehydrate a snapshot written by serialize() before the last shutdown. The
  // live subscriber sockets can't be persisted, so every room starts with an
  // empty set; clients reconnect and re-subscribe on their own.
  if (initial && typeof initial === 'object') {
    for (const [id, room] of Object.entries(initial)) {
      rooms.set(id, {
        members: room.members || {},
        events: room.events || [],
        snapshot: room.snapshot || { heroes: {}, life: {}, presence: {} },
        subscribers: new Set(),
        touchedAt: room.touchedAt || now(),
      });
    }
    log?.info('rooms rehydrated from snapshot', { count: rooms.size });
  }

  function get(roomId) {
    const room = rooms.get(roomId);
    if (!room) {
      throw new RoomError('ROOM_NOT_FOUND', 'no such room (expired or never existed)', { roomId });
    }
    return room;
  }

  function touch(room) {
    room.touchedAt = now();
  }

  // The opponent-facing identity payload. Whitelist ONLY the display name here —
  // this object is broadcast to the other player, so it must never carry a
  // userId, email, or the raw (dc_/gh_ prefixed) username. Player identity on
  // the mat is the display name plus their (public) hero card, which rides the
  // existing 'hero' event — no avatar / no Discord data crosses.
  function presence(seat, { username = null } = {}) {
    return { type: 'presence', seat, username };
  }

  return {
    // `profile` is the ONLY identity that ever reaches the opposing client:
    // { username }. Deliberately no userId/email — see presence(), below.
    create(ownerId, profile = {}) {
      const id = randomBytes(12).toString('base64url');
      const room = {
        members: { 1: ownerId },
        events: [],
        snapshot: { heroes: {}, life: {}, presence: {} },
        subscribers: new Set(),
        touchedAt: now(),
      };
      if (profile.username) room.snapshot.presence['1'] = presence('1', profile);
      rooms.set(id, room);
      log?.info('room created', { roomId: id, ownerId });
      return { id, side: '1' };
    },

    join(roomId, userId, profile = {}) {
      const room = get(roomId);
      touch(room);
      for (const [side, member] of Object.entries(room.members)) {
        if (member === userId) return { side }; // idempotent rejoin: no re-broadcast
      }
      if (!room.members['2']) {
        room.members['2'] = userId;
        if (profile.username) {
          const ev = presence('2', profile);
          room.snapshot.presence['2'] = ev; // replayable for late joiners / reconnects
          for (const fn of room.subscribers) { // and pushed live to the seated opponent
            try { fn(ev); } catch (err) { log?.error('subscriber threw on presence', { roomId, err }); }
          }
        }
        log?.info('room joined', { roomId, userId, side: '2' });
        return { side: '2' };
      }
      throw new RoomError('ROOM_FULL', 'both sides are taken', {
        roomId,
        members: { ...room.members },
        rejectedUserId: userId,
      });
    },

    memberSide(roomId, userId) {
      const room = get(roomId);
      for (const [side, member] of Object.entries(room.members)) {
        if (member === userId) return side;
      }
      return null;
    },

    append(roomId, event) {
      const room = get(roomId);
      touch(room);
      room.events.push(event);
      if (room.events.length > maxEvents) {
        room.events.splice(0, room.events.length - maxEvents);
      }
      // Maintain the late-joiner snapshot
      if (event.type === 'hero' && event.side) {
        room.snapshot.heroes[event.side] = event;
      } else if (event.type === 'life' && (event.seat || event.side)) {
        room.snapshot.life[event.seat || event.side] = event;
      } else if (event.type === 'newgame') {
        // Same players, fresh board: clear hero/life, keep who's seated.
        room.snapshot = { heroes: {}, life: {}, presence: room.snapshot.presence };
      }
      for (const fn of room.subscribers) {
        try {
          fn(event);
        } catch (err) {
          log?.error('subscriber threw while handling event', { roomId, event, err });
        }
      }
      return room.events.length;
    },

    snapshot(roomId) {
      const room = get(roomId);
      return [
        ...Object.values(room.snapshot.presence),
        ...Object.values(room.snapshot.heroes),
        ...Object.values(room.snapshot.life),
      ];
    },

    dump(roomId) {
      return [...get(roomId).events];
    },

    subscribe(roomId, fn) {
      const room = get(roomId);
      room.subscribers.add(fn);
      return () => room.subscribers.delete(fn);
    },

    // Explicit teardown: tell everyone connected, then free the memory now
    // instead of waiting out the idle TTL.
    close(roomId) {
      const room = get(roomId);
      const ev = { type: 'closed' };
      for (const fn of room.subscribers) {
        try {
          fn(ev);
        } catch (err) {
          log?.error('subscriber threw while handling close', { roomId, err });
        }
      }
      rooms.delete(roomId);
      log?.info('room closed', { roomId, members: { ...room.members } });
    },

    sweep() {
      let removed = 0;
      for (const [id, room] of rooms) {
        if (now() - room.touchedAt > roomTtlMs) {
          rooms.delete(id);
          removed++;
          log?.info('room swept (idle past TTL)', {
            roomId: id,
            idleMs: now() - room.touchedAt,
            members: room.members,
          });
        }
      }
      return removed;
    },

    stats() {
      return { rooms: rooms.size };
    },

    // A JSON-serializable snapshot of all room state for a graceful shutdown.
    // Excludes `subscribers` (live sockets, meaningless after a restart).
    serialize() {
      const out = {};
      for (const [id, room] of rooms) {
        out[id] = {
          members: room.members,
          events: room.events,
          snapshot: room.snapshot,
          touchedAt: room.touchedAt,
        };
      }
      return out;
    },
  };
}
