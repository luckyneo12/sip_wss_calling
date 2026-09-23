/**
 * Standalone WebSocket <-> SIP UDP Bridge
 * Usage: node server/bridge.js
 * Default Port: 8080
 * Target SIP Server: 103.9.14.223:5060
 */

const { WebSocketServer } = require('ws');
const dgram = require('dgram');

const WS_PORT = process.env.BRIDGE_PORT || 8080;
const SIP_SERVER = process.env.SIP_SERVER || '103.9.14.223';
const SIP_PORT = parseInt(process.env.SIP_PORT || '5060', 10);

const wss = new WebSocketServer({ port: WS_PORT });

console.log(`[Bridge] Standalone SIP WebSocket Bridge running on ws://0.0.0.0:${WS_PORT}`);
console.log(`[Bridge] Forwarding SIP traffic to UDP ${SIP_SERVER}:${SIP_PORT}`);

wss.on('connection', (ws, req) => {
  const remoteIp = req.socket.remoteAddress;
  console.log(`[Bridge] New browser client connected from ${remoteIp}`);

  const udpClient = dgram.createSocket('udp4');

  udpClient.on('message', (msg, rinfo) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(msg.toString('utf8'));
    }
  });

  udpClient.on('error', (err) => {
    console.error(`[Bridge] UDP error:`, err.message);
  });

  ws.on('message', (data) => {
    const text = data.toString('utf8');
    const buf = Buffer.from(text, 'utf8');
    udpClient.send(buf, 0, buf.length, SIP_PORT, SIP_SERVER, (err) => {
      if (err) console.error(`[Bridge] Failed to forward to UDP:`, err.message);
    });
  });

  ws.on('close', () => {
    console.log(`[Bridge] Client ${remoteIp} disconnected`);
    try { udpClient.close(); } catch(e) {}
  });

  ws.on('error', (err) => {
    console.error(`[Bridge] WebSocket error:`, err.message);
    try { udpClient.close(); } catch(e) {}
  });
});
