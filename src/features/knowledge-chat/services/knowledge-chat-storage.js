const KNOWLEDGE_CHAT_CONFIG_KEY = 'coderOnlineTools.knowledgeChat.config.v1';

const DEFAULT_QUERY_PREFIX = '';

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeNumber(value, fallback) {
  const next = Number(value);
  if (!Number.isFinite(next)) {
    return fallback;
  }
  return Math.max(1, Math.min(20, Math.floor(next)));
}

function normalizeConfig(rawConfig = {}) {
  return {
    apiUrl: sanitizeString(rawConfig.apiUrl),
    authorization: sanitizeString(rawConfig.authorization),
    useQueryPrefix: Boolean(rawConfig.useQueryPrefix),
    queryPrefix: sanitizeString(rawConfig.queryPrefix) || DEFAULT_QUERY_PREFIX,
    topK: sanitizeNumber(rawConfig.topK, 5),
  };
}

function readKnowledgeChatConfig() {
  try {
    const raw = localStorage.getItem(KNOWLEDGE_CHAT_CONFIG_KEY);
    if (!raw) {
      return normalizeConfig();
    }
    const parsed = JSON.parse(raw);
    return normalizeConfig(parsed);
  } catch (_) {
    return normalizeConfig();
  }
}

function saveKnowledgeChatConfig(config) {
  const normalized = normalizeConfig(config);
  localStorage.setItem(KNOWLEDGE_CHAT_CONFIG_KEY, JSON.stringify(normalized));
  return normalized;
}

function hasKnowledgeChatConnection(config) {
  const normalized = normalizeConfig(config);
  return Boolean(normalized.apiUrl && normalized.authorization);
}

function maskAuthorization(value) {
  const text = sanitizeString(value);
  if (!text) return '未配置';
  if (text.length <= 8) return '********';
  return `${text.slice(0, 5)}...${text.slice(-3)}`;
}

export {
  DEFAULT_QUERY_PREFIX,
  KNOWLEDGE_CHAT_CONFIG_KEY,
  hasKnowledgeChatConnection,
  maskAuthorization,
  normalizeConfig,
  readKnowledgeChatConfig,
  saveKnowledgeChatConfig,
};
