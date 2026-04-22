// api/health.js — safe config check, never exposes the full key
'use strict';
module.exports = function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY || '';
  res.json({
    apiKeySet: key.length > 0,
    apiKeyPrefix: key.length > 0 ? key.slice(0, 10) + '...' : 'NOT SET',
    nodeEnv: process.env.NODE_ENV || 'unknown',
  });
};
