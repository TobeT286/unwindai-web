// api/chat.js
'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { readFileSync } = require('fs');
const { join } = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FALLBACK_PROMPT = 'You are a helpful assistant for UnwindAI, an Australian data, AI, and energy upgrade company based in Melbourne. Help users with data automation, Victorian Energy Upgrades (VEU), and free tools. Be friendly and concise.';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { messages } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array required' });
    return;
  }

  let systemPrompt = FALLBACK_PROMPT;
  try {
    systemPrompt = readFileSync(join(__dirname, '..', 'context', 'thomas-context.md'), 'utf-8');
  } catch { /* use fallback if context file missing */ }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
        if (res.flush) res.flush();
      }
    }

    res.write('data: [DONE]\n\n');
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }

  res.end();
};
