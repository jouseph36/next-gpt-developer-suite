import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}

test('chat supports the original JSON client and the streaming client', async t => {
  const requests = [];
  const provider = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    requests.push(body);
    if (!body.stream) {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({output: [{content: [{type: 'output_text', text: 'رد سابق'}]}]}));
      return;
    }
    const event = {type: 'content_block_delta', delta: {type: 'text_delta', text: 'رد تدريجي'}};
    res.writeHead(200, {'Content-Type': 'text/event-stream'});
    res.end('data: ' + JSON.stringify(event) + '\n\n');
  });
  const providerUrl = await listen(provider);
  t.after(() => new Promise(resolve => provider.close(resolve)));
  const password = randomBytes(24).toString('hex');
  Object.assign(process.env, {
    NODE_ENV: 'test', APP_PASSWORD: password,
    OPENAI_API_KEY: 'local-fixture', ANTHROPIC_API_KEY: 'local-fixture',
    OPENAI_API_URL: providerUrl, ANTHROPIC_API_URL: providerUrl
  });
  const {server} = await import('../server.js');
  const appUrl = await listen(server);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const config = await (await fetch(appUrl + '/api/config')).json();
  assert.equal(config.secured, true);
  assert.equal(config.requiresPassword, true);
  assert.equal((await fetch(appUrl + '/api/chat', {method:'POST'})).status, 401);
  const send = payload => fetch(appUrl + '/api/chat', {
    method: 'POST', headers: {Authorization: 'Bearer ' + password, 'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
  });
  const model = config.models.openai[0];
  const oldReply = await send({provider: 'openai', model, messages: [{role: 'user', content: 'مرحبا'}]});
  assert.equal(oldReply.status, 200);
  assert.deepEqual(await oldReply.json(), {answer: 'رد سابق', provider: 'openai', model});
  assert.equal(requests[0].stream, false);
  const newReply = await send({
    provider: 'anthropic', model: config.models.anthropic[0],
    messages: [{role: 'user', text: 'لخّص الملف', attachments: [
      {type: 'application/pdf', name: 'note.pdf', base64: 'YWJj'}
    ]}]
  });
  assert.equal(newReply.status, 200);
  assert.match(newReply.headers.get('content-type'), /text\/event-stream/);
  const events = (await newReply.text()).trim().split('\n\n').map(line => JSON.parse(line.slice(6)));
  assert.deepEqual(events, [{type: 'ready'}, {type: 'delta', text: 'رد تدريجي'}, {type: 'done'}]);
  assert.equal(requests[1].stream, true);
  assert.equal(requests[1].messages[0].content[1].type, 'document');
});
