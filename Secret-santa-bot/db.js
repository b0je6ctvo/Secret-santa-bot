const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'santa.sqlite'));

module.exports = {
  init() {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guildId TEXT NOT NULL,
        name TEXT NOT NULL,
        budget TEXT,
        date TEXT,
        organizerId TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventId INTEGER NOT NULL,
        userId TEXT NOT NULL,
        wishlist TEXT,
        joinedAt INTEGER NOT NULL,
        UNIQUE(eventId, userId)
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS pairs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventId INTEGER NOT NULL,
        santaId TEXT NOT NULL,
        recipientId TEXT NOT NULL
      )
    `).run();
  },

  createEvent(guildId, name, budget, date, organizerId) {
    const stmt = db.prepare('INSERT INTO events (guildId,name,budget,date,organizerId,createdAt) VALUES (?,?,?,?,?,?)');
    const info = stmt.run(guildId, name, budget, date, organizerId, Date.now());
    return info.lastInsertRowid;
  },

  getEventsByGuild(guildId) {
    return db.prepare('SELECT * FROM events WHERE guildId = ?').all(guildId);
  },

  setBudget(eventId, budget) {
    db.prepare('UPDATE events SET budget = ? WHERE id = ?').run(budget, eventId);
  },

  getEventById(id) {
    return db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  },

  addParticipant(eventId, userId) {
    const stmt = db.prepare('INSERT OR IGNORE INTO participants (eventId,userId,wishlist,joinedAt) VALUES (?,?,?,?)');
    stmt.run(eventId, userId, '', Date.now());
  },

  removeParticipant(eventId, userId) {
    db.prepare('DELETE FROM participants WHERE eventId = ? AND userId = ?').run(eventId, userId);
  },

  getParticipants(eventId) {
    return db.prepare('SELECT * FROM participants WHERE eventId = ?').all(eventId);
  },

  setWishlist(eventId, userId, wishlist) {
    db.prepare('UPDATE participants SET wishlist = ? WHERE eventId = ? AND userId = ?').run(wishlist, eventId, userId);
  },

  getWishlist(eventId, userId) {
    const row = db.prepare('SELECT wishlist FROM participants WHERE eventId = ? AND userId = ?').get(eventId, userId);
    return row ? row.wishlist : '';
  },

  savePair(eventId, santaId, recipientId) {
    db.prepare('INSERT INTO pairs (eventId,santaId,recipientId) VALUES (?,?,?)').run(eventId, santaId, recipientId);
  },

  getPairBySanta(eventId, santaId) {
    return db.prepare('SELECT * FROM pairs WHERE eventId = ? AND santaId = ?').get(eventId, santaId);
  },

  getPairsByRecipient(eventId, recipientId) {
    return db.prepare('SELECT * FROM pairs WHERE eventId = ? AND recipientId = ?').all(eventId, recipientId);
  },

  getPairByRecipient(eventId, recipientId) {
    return db.prepare('SELECT * FROM pairs WHERE eventId = ? AND recipientId = ?').get(eventId, recipientId);
  },

  getPairsByEvent(eventId) {
    return db.prepare('SELECT * FROM pairs WHERE eventId = ?').all(eventId);
  },

  clearPairs(eventId) {
    db.prepare('DELETE FROM pairs WHERE eventId = ?').run(eventId);
  },

  deleteEvent(eventId) {
    const delPairs = db.prepare('DELETE FROM pairs WHERE eventId = ?');
    const delParticipants = db.prepare('DELETE FROM participants WHERE eventId = ?');
    const delEvent = db.prepare('DELETE FROM events WHERE id = ?');
    const txn = db.transaction((id) => {
      delPairs.run(id);
      delParticipants.run(id);
      delEvent.run(id);
    });
    txn(eventId);
  }
};
