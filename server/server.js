const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const dgram = require('dgram');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

// Create HTTP Server
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // API Endpoint: Diagnostic port check for SIP & WSS
  if (pathname === '/api/diagnose') {
    const host = parsedUrl.searchParams.get('host') || '103.9.14.223';
    const ports = [5060, 80, 443, 8088, 8089, 7443, 8443];
    
    Promise.all(ports.map(port => checkPort(host, port)))
      .then(results => {
        // Also do a UDP SIP test
        checkSipUdp(host, 5060).then(udpResult => {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            host,
            timestamp: new Date().toISOString(),
            tcpPorts: results,
            udpSip5060: udpResult,
            recommendation: getRecommendation(results, udpResult)
          }));
        });
      })
      .catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }

  // Serve static files
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

// Helper: Test TCP Port
function checkPort(host, port, timeout = 2500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = 'closed';
    socket.setTimeout(timeout);

    socket.on('connect', () => {
      status = 'open';
      socket.destroy();
    });

    socket.on('timeout', () => {
      status = 'timeout';
      socket.destroy();
    });

    socket.on('error', (err) => {
      status = err.code === 'ECONNREFUSED' ? 'refused' : 'error';
    });

    socket.on('close', () => {
      resolve({ port, status });
    });

    socket.connect(port, host);
  });
}

// Helper: Test SIP UDP Ping
function checkSipUdp(host, port = 5060, timeout = 2500) {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    const branch = 'z9hG4bK-' + Math.random().toString(36).substring(2, 10);
    const sipPing = 
      `OPTIONS sip:${host}:${port} SIP/2.0\r\n` +
      `Via: SIP/2.0/UDP 127.0.0.1:5060;branch=${branch};rport\r\n` +
      `Max-Forwards: 70\r\n` +
      `To: <sip:${host}:${port}>\r\n` +
      `From: <sip:diag@127.0.0.1:5060>;tag=diag123\r\n` +
      `Call-ID: ${Math.random().toString(36).substring(2)}@127.0.0.1\r\n` +
      `CSeq: 1 OPTIONS\r\n` +
      `Contact: <sip:diag@127.0.0.1:5060>\r\n` +
      `Accept: application/sdp\r\n` +
      `Content-Length: 0\r\n\r\n`;

    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { client.close(); } catch(e) {}
        resolve({ reachable: false, details: 'UDP SIP OPTIONS timed out (normal for firewalls filtering unauthenticated OPTIONS)' });
      }
    }, timeout);

    client.on('message', (msg) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        try { client.close(); } catch(e) {}
        resolve({ reachable: true, details: msg.toString().split('\r\n')[0] });
      }
    });

    client.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        try { client.close(); } catch(e) {}
        resolve({ reachable: false, error: err.message });
      }
    });

    try {
      client.send(sipPing, port, host);
    } catch(err) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ reachable: false, error: err.message });
      }
    }
  });
}

function getRecommendation(tcpPorts, udpResult) {
  const p8089 = tcpPorts.find(p => p.port === 8089);
  const p8088 = tcpPorts.find(p => p.port === 8088);
  const p5060 = tcpPorts.find(p => p.port === 5060);
  const p443 = tcpPorts.find(p => p.port === 443);

  if (p8089 && p8089.status === 'open') {
    return 'WSS port 8089 is open on the server! Connect via wss://103.9.14.223:8089/ws';
  } else if (p443 && p443.status === 'open') {
    return 'Port 443 (HTTPS) is open. If your PBX has a reverse proxy for WebSockets, use wss://103.9.14.223/ws. Otherwise, standard SIP 5060 is available via the built-in Node.js SIP Bridge.';
  } else if (p5060 && p5060.status === 'open') {
    return 'Standard SIP Port 5060 is open. Since browsers cannot send raw UDP SIP, use the built-in Local SIP Bridge.';
  }
  return 'Check firewall settings on server 103.9.14.223.';
}

// Attach WebSocket Server for SIP Bridge (ws://localhost:3000/sip-bridge)
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  console.log('[Bridge] Client connected to SIP Bridge from', req.socket.remoteAddress);
  
  // Create UDP socket to communicate with SIP server
  const udpClient = dgram.createSocket('udp4');
  const targetHost = process.env.SIP_SERVER || '103.9.14.223';
  const targetPort = parseInt(process.env.SIP_PORT || '5060', 10);

  udpClient.on('message', (msg) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(msg.toString('utf8'));
    }
  });

  udpClient.on('error', (err) => {
    console.error('[Bridge] UDP Error:', err.message);
  });

  ws.on('message', (data) => {
    const sipText = data.toString('utf8');
    const buf = Buffer.from(sipText, 'utf8');
    udpClient.send(buf, 0, buf.length, targetPort, targetHost, (err) => {
      if (err) console.error('[Bridge] UDP Send Error:', err.message);
    });
  });

  ws.on('close', () => {
    console.log('[Bridge] WebSocket client disconnected');
    try { udpClient.close(); } catch(e) {}
  });

  ws.on('error', (err) => {
    console.error('[Bridge] WebSocket client error:', err.message);
    try { udpClient.close(); } catch(e) {}
  });
});

// Upgrade handling for WebSocket
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === '/sip-bridge' || pathname === '/ws') {
    // Negotiate 'sip' subprotocol if requested
    const protocols = request.headers['sec-websocket-protocol'] || '';
    const chosenProtocol = protocols.split(',').map(s => s.trim()).includes('sip') ? 'sip' : undefined;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Start listening
server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Tata SIP Web Dialer running at http://localhost:${PORT}`);
  console.log(`📡 Built-in WebSocket Bridge at ws://localhost:${PORT}/sip-bridge`);
  console.log(`🔍 Diagnostic API at http://localhost:${PORT}/api/diagnose`);
  console.log('====================================================');
});
