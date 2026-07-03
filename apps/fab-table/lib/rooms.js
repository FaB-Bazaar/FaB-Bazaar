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
} = {}) {
  const rooms = new Map(); // id -> { members, events, snapshot, subscribers, touchedAt }

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

  return {
    create(ownerId) {
      const id = randomBytes(12).toString('base64url');
      rooms.set(id, {
        members: { 1: ownerId },
        events: [],
        snapshot: { heroes: {}, life: {} },
        subscribers: new Set(),
        touchedAt: now(),
      });
      log?.info('room created', { roomId: id, ownerId });
      return { id, side: '1' };
    },

    join(roomId, userId) {
      const room = get(roomId);
      touch(room);
      for (const [side, member] of Object.entries(room.members)) {
        if (member === userId) return { side };
      }
      if (!room.members['2']) {
        room.members['2'] = userId;
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
      } else if (event.type === 'life' && event.side) {
        room.snapshot.life[event.side] = event;
      } else if (event.type === 'newgame') {
        room.snapshot = { heroes: {}, life: {} };
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
      return [...Object.values(room.snapshot.heroes), ...Object.values(room.snapshot.life)];
    },

    dump(roomId) {
      return [...get(roomId).events];
    },

    subscribe(roomId, fn) {
      const room = get(roomId);
      room.subscribers.add(fn);
      return () => room.subscribers.delete(fn);
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
  };
}
