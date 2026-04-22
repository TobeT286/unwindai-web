// api/__tests__/chat.test.js
'use strict';

// Must mock before requiring the handler
jest.mock('@anthropic-ai/sdk', () => {
  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } };
      yield { type: 'message_stop' };
    },
  };
  return jest.fn().mockImplementation(() => ({
    messages: { stream: jest.fn().mockReturnValue(mockStream) },
  }));
});

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('You are UnwindAI assistant.'),
}));

const handler = require('../chat');

function mockRes() {
  const written = [];
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
    write: jest.fn((chunk) => written.push(chunk)),
    end: jest.fn(),
    _written: written,
  };
}

test('returns 405 for non-POST requests', async () => {
  const res = mockRes();
  await handler({ method: 'GET' }, res);
  expect(res.status).toHaveBeenCalledWith(405);
  expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
});

test('returns 400 when messages missing', async () => {
  const res = mockRes();
  await handler({ method: 'POST', body: {} }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('returns 400 when messages is empty array', async () => {
  const res = mockRes();
  await handler({ method: 'POST', body: { messages: [] } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('streams SSE tokens for valid request', async () => {
  const res = mockRes();
  await handler({
    method: 'POST',
    body: { messages: [{ role: 'user', content: 'Hi' }] },
  }, res);
  expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
  const output = res._written.join('');
  expect(output).toContain('Hello');
  expect(output).toContain('world');
  expect(output).toContain('[DONE]');
  expect(res.end).toHaveBeenCalled();
});

test('sets CORS header', async () => {
  const res = mockRes();
  await handler({
    method: 'POST',
    body: { messages: [{ role: 'user', content: 'Hi' }] },
  }, res);
  expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
});
