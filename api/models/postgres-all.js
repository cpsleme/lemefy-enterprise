/**
 * PostgreSQL-only implementation of all models
 */

const { Pool } = require('pg');
const pgChat = require('@lemefy/data-schemas');
const { logger } = require('@lemefy/data-schemas');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'lemefy',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function query(text, params) {
  return await pool.query(text, params);
}

// Chat functions - use data-schemas
const chatExports = {
  getConvo: pgChat.getConvo,
  getConvosByCursor: pgChat.getConvosByCursor,
  saveConvo: pgChat.upsertConvo,
  deleteConvos: pgChat.deleteConvos,
  upsertConvo: pgChat.upsertConvo,
  getMessages: pgChat.getMessages,
  getMessagesByCursor: pgChat.getMessagesByCursor,
  saveMessage: pgChat.saveMessage,
  updateMessage: pgChat.updateMessage,
  deleteMessages: pgChat.deleteMessages,
  searchMessages: pgChat.searchMessages,
  createToolCall: pgChat.createToolCall,
  getToolCallsByConvo: pgChat.getToolCallsByConvo,
  deleteToolCalls: pgChat.deleteToolCalls,
  createChatProject: pgChat.createChatProject,
  getChatProjects: pgChat.getChatProjects,
  upsertConversationTag: pgChat.upsertConversationTag,
  saveCheckpoint: pgChat.saveCheckpoint,
  getCheckpoint: pgChat.getCheckpoint,
  deleteChatCheckpoints: pgChat.deleteChatCheckpoints,
};

// Critical RBAC functions
async function getRoleByName(roleName) {
  const result = await query(
    'SELECT * FROM roles WHERE name = $1 LIMIT 1',
    [roleName.toUpperCase()]
  );
  if (result.rows.length > 0) return result.rows[0];
  
  // Insert default system roles if not exists
  const systemRoles = [
    { _id: '6789abcd0123456789012345', name: 'USER', description: 'Default user role', permissions: { read: true } },
    { _id: '6789abcd0123456789012346', name: 'ADMIN', description: 'Administrator role', permissions: { read: true, write: true, admin: true } },
    { _id: '6789abcd0123456789012347', name: 'SUPER_ADMIN', description: 'Super administrator role', permissions: { read: true, write: true, admin: true, super_admin: true } }
  ];
  
  for (const role of systemRoles) {
    await query(
      'INSERT INTO roles (_id, name, description, permissions) VALUES ($1, $2, $3, $4) ON CONFLICT (_id) DO NOTHING',
      [role._id, role.name, role.description, role.permissions]
    );
  }
  
  const result2 = await query(
    'SELECT * FROM roles WHERE name = $1 LIMIT 1',
    [roleName.toUpperCase()]
  );
  
  if (result2.rows.length === 0) {
    throw new Error(`Role not found: ${roleName}`);
  }
  return result2.rows[0];
}

async function findRoleByIdentifier(identifier) {
  const result = await query('SELECT * FROM roles WHERE _id = $1 OR name = $1 LIMIT 1', [identifier]);
  return result.rows[0] || null;
}

async function initializeRoles() {
  const systemRoles = [
    { _id: '6789abcd0123456789012345', name: 'USER', description: 'Default user role', permissions: { read: true } },
    { _id: '6789abcd0123456789012346', name: 'ADMIN', description: 'Administrator role', permissions: { read: true, write: true, admin: true } },
    { _id: '6789abcd0123456789012347', name: 'SUPER_ADMIN', description: 'Super administrator role', permissions: { read: true, write: true, admin: true, super_admin: true } }
  ];
  for (const role of systemRoles) {
    await query(
      'INSERT INTO roles (_id, name, description, permissions) VALUES ($1, $2, $3, $4) ON CONFLICT (_id) DO NOTHING',
      [role._id, role.name, role.description, role.permissions]
    );
  }
}

async function seedDefaultRoles() { await initializeRoles(); }
async function ensureDefaultCategories() {}
async function seedSystemGrants() {}

async function findUser(filter) {
  const { _id, id, email, username } = filter || {};
  let q = 'SELECT * FROM users';
  const params = [];
  if (_id || id) {
    q += ' WHERE _id = $1';
    params.push(_id || id);
  } else if (email) {
    q += ' WHERE email = $1';
    params.push(email);
  } else if (username) {
    q += ' WHERE username = $1';
    params.push(username);
  }
  const result = await query(q + ' LIMIT 1', params);
  return result.rows[0] || null;
}

async function createUser(userData) {
  const { _id, email, username, password_hash, role, roles, tenant_id, balance, config } = userData;
  const result = await query(
    `INSERT INTO users (_id, email, username, password_hash, role, roles, tenant_id, balance, config) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [_id, email, username, password_hash, role, roles, tenant_id, balance, config]
  );
  return result.rows[0];
}

async function updateUser(filter, updateData) {
  const user = await findUser(filter);
  if (!user) return null;
  const updates = [];
  const params = [];
  let i = 1;
  for (const [k, v] of Object.entries(updateData)) {
    if (v !== undefined && k !== '_id' && k !== 'id') {
      updates.push(`${k} = $${i++}`);
      params.push(v);
    }
  }
  params.push(user._id);
  const result = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE _id = $${i} RETURNING *`,
    params
  );
  return result.rows[0] || user;
}

async function getUserById(userId) {
  return await findUser({ _id: userId });
}

async function findBalanceByUser(userId) {
  const user = await getUserById(userId);
  return user?.balance || null;
}

async function upsertBalanceFields(userId, fields) {
  const user = await getUserById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  const newBalance = { ...(user.balance || {}), ...fields };
  await updateUser({ _id: userId }, { balance: newBalance });
  return newBalance;
}

async function getUserPrincipals(userId) {
  const user = await getUserById(userId);
  return user ? { roles: user.roles || [], groups: [], user: { _id: user._id, id: user._id } } : { roles: [], groups: [], user: null };
}

async function hasCapabilityForPrincipals(principals, capability) {
  const roles = principals.roles || [];
  if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) return true;
  return false;
}

// Stub functions
const stubFn = (name) => (...args) => { logger.warn(`[postgres-all] Stub: ${name}`); return null; };

const seedDatabase = async () => {
  await initializeRoles();
  await seedDefaultRoles();
  await ensureDefaultCategories();
  await seedSystemGrants();
};

module.exports = {
  ...chatExports,
  getRoleByName,
  findRoleByIdentifier,
  initializeRoles,
  seedDefaultRoles,
  ensureDefaultCategories,
  seedSystemGrants,
  findUser,
  createUser,
  updateUser,
  getUserById,
  findBalanceByUser,
  upsertBalanceFields,
  getUserPrincipals,
  hasCapabilityForPrincipals,
  getFiles: stubFn('getFiles'),
  getBanner: stubFn('getBanner'),
  createBanner: stubFn('createBanner'),
  deleteBanner: stubFn('deleteBanner'),
  findToken: stubFn('findToken'),
  createToken: stubFn('createToken'),
  updateToken: stubFn('updateToken'),
  deleteTokens: stubFn('deleteTokens'),
  deleteAllUserSessions: stubFn('deleteAllUserSessions'),
  updateUserKey: stubFn('updateUserKey'),
  deleteUserKey: stubFn('deleteUserKey'),
  getUserKeyExpiry: stubFn('getUserKeyExpiry'),
  getPresets: stubFn('getPresets'),
  savePreset: stubFn('savePreset'),
  deletePresets: stubFn('deletePresets'),
  getSkillById: stubFn('getSkillById'),
  findMCPServerByServerName: stubFn('findMCPServerByServerName'),
  findMCPServerByObjectId: stubFn('findMCPServerByObjectId'),
  updateRoleByName: stubFn('updateRoleByName'),
  getGroup: stubFn('getGroup'),
  updateAccessPermissions: stubFn('updateAccessPermissions'),
  seedDatabase,
  _pool: pool,
};
