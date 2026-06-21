const WebSocket = require('ws');
const net = require('net');
const dgram = require('dgram');
const http = require('http');
const url = require('url');

// Constants
const horse = Buffer.from("dHJvamFu", 'base64').toString(); // "trojan"
const flash = Buffer.from("dm1lc3M=", 'base64').toString(); // "vmess/vless"

const WS_READY_STATE_OPEN = 1;

class GatewayServer {
  constructor() {
    this.wss = null;
    this.httpServer = null;
    this.activeUDPConnections = new Map();
    
    // In-Memory Bandwidth Tracker
    this.stats = {
      rx: 0, // Received from VPN Client (Upload)
      tx: 0  // Sent to VPN Client (Download)
    };
  }

  // ==================== HTTP HANDLERS & DASHBOARD ====================

  async handleHttpRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    
    // API Endpoint untuk pembaruan data real-time pada UI
    if (parsedUrl.pathname === '/api/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        uptime: Math.floor(process.uptime()),
        rx: this.stats.rx,
        tx: this.stats.tx
      }));
      return;
    }

    // Response untuk dashboard utama (Root Path)
    if (parsedUrl.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>GATEWAY CORE // SYSTEM STATUS</title>
          <style>
            :root {
              --bg-black: #000000;
              --panel-bg: #0a0a0a;
              --card-bg: #000000;
              --border-color: #1f1f1f;
              --border-hover: #333333;
              --text-main: #ffffff;
              --text-muted: #888888;
              --accent-blue: #0070f3;
              --status-green: #00df89;
            }

            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }

            body {
              background-color: var(--bg-black);
              color: var(--text-main);
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Geist Sans", "Inter", sans-serif;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              padding: 24px;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }

            /* macOS Window Container dengan Vercel High Contrast Minimalist */
            .window-container {
              width: 100%;
              max-width: 640px;
              background-color: var(--panel-bg);
              border: 1px solid var(--border-color);
              border-radius: 12px;
              box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8);
              overflow: hidden;
            }

            /* macOS Window Top Bar */
            .window-header {
              background-color: #050505;
              border-bottom: 1px solid var(--border-color);
              padding: 14px 20px;
              display: flex;
              align-items: center;
              justify-content: space-between;
            }

            .mac-dots {
              display: flex;
              gap: 8px;
            }

            .dot {
              width: 12px;
              height: 12px;
              border-radius: 50%;
              opacity: 0.75;
            }
            .dot.close { background-color: #ff5f56; }
            .dot.minimize { background-color: #ffbd2e; }
            .dot.zoom { background-color: #27c93f; }

            /* Brand Typography (MEDIA berwarna putih, FAIRY berwarna biru) */
            .brand-title {
              font-size: 0.8rem;
              font-weight: 700;
              letter-spacing: 3px;
              text-transform: uppercase;
            }
            .brand-media { color: #ffffff; }
            .brand-fairy { color: var(--accent-blue); }

            .status-badge {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 0.75rem;
              font-weight: 600;
              color: var(--status-green);
              letter-spacing: 0.5px;
            }

            .pulse-dot {
              width: 6px;
              height: 6px;
              background-color: var(--status-green);
              border-radius: 50%;
              box-shadow: 0 0 8px var(--status-green);
              animation: ambientPulse 2.5s infinite ease-in-out;
            }

            /* Content Layout */
            .window-content {
              padding: 32px;
            }

            /* Uptime Main Dashboard Section */
            .uptime-section {
              text-align: center;
              padding-bottom: 32px;
              border-bottom: 1px solid var(--border-color);
              margin-bottom: 32px;
            }

            .section-label {
              font-size: 0.7rem;
              text-transform: uppercase;
              color: var(--text-muted);
              letter-spacing: 2px;
              margin-bottom: 8px;
            }

            .uptime-display {
              font-size: 3rem;
              font-weight: 800;
              letter-spacing: -1px;
              color: var(--text-main);
              font-variant-numeric: tabular-nums;
            }

            /* Bandwidth Info Metrics Grid */
            .stats-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }

            .card {
              background-color: var(--card-bg);
              border: 1px solid var(--border-color);
              border-radius: 8px;
              padding: 20px;
              transition: border-color 0.2s ease, box-shadow 0.2s ease;
            }

            .card:hover {
              border-color: var(--border-hover);
            }

            .card-value {
              font-size: 1.5rem;
              font-weight: 700;
              margin-top: 4px;
              color: var(--text-main);
              font-variant-numeric: tabular-nums;
            }

            /* Device Layout Compatibility Adjustments */
            @media (max-width: 540px) {
              body { padding: 16px; }
              .window-content { padding: 24px; }
              .stats-grid { grid-template-columns: 1fr; gap: 16px; }
              .uptime-display { font-size: 2.25rem; }
            }

            @keyframes ambientPulse {
              0%, 100% { opacity: 0.4; }
              50% { opacity: 1; }
            }
          </style>
        </head>
        <body>

          <div class="window-container">
            <div class="window-header">
              <div class="mac-dots">
                <div class="dot close"></div>
                <div class="dot minimize"></div>
                <div class="dot zoom"></div>
              </div>
              <div class="brand-title">
                <span class="brand-media">MEDIA</span><span class="brand-fairy">FAIRY</span>
              </div>
              <div class="status-badge">
                <div class="pulse-dot"></div>
                RUNNING
              </div>
            </div>

            <div class="window-content">
              <div class="uptime-section">
                <div class="section-label">System Uptime</div>
                <div class="uptime-display" id="uptime-field">00:00:00</div>
              </div>

              <div class="stats-grid">
                <div class="card">
                  <div class="section-label">Download (TX)</div>
                  <div class="card-value" id="download-field">0 B</div>
                </div>
                <div class="card">
                  <div class="section-label">Upload (RX)</div>
                  <div class="card-value" id="upload-field">0 B</div>
                </div>
              </div>
            </div>
          </div>

          <script>
            function formatBytes(bytes) {
              if (bytes === 0) return '0 B';
              const k = 1024;
              const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
              const i = Math.floor(Math.log(bytes) / Math.log(k));
              return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }

            function formatTime(totalSeconds) {
              const days = Math.floor(totalSeconds / 86400);
              const hours = Math.floor((totalSeconds % 86400) / 3600);
              const minutes = Math.floor((totalSeconds % 3600) / 60);
              const seconds = totalSeconds % 60;
              
              let timeString = '';
              if (days > 0) timeString += days + 'd ';
              timeString += String(hours).padStart(2, '0') + ':';
              timeString += String(minutes).padStart(2, '0') + ':';
              timeString += String(seconds).padStart(2, '0');
              return timeString;
            }

            async function refreshDashboardStats() {
              try {
                const response = await fetch('/api/stats');
                const statsData = await response.json();
                
                document.getElementById('uptime-field').innerText = formatTime(statsData.uptime);
                document.getElementById('download-field').innerText = formatBytes(statsData.tx);
                document.getElementById('upload-field').innerText = formatBytes(statsData.rx);
              } catch (error) {
                console.error("Gagal memperbarui matriks dasbor jaringan.");
              }
            }

            // Jalankan siklus penarikan data secara berkala tiap 1 detik
            refreshDashboardStats();
            setInterval(refreshDashboardStats, 1000);
          </script>
        </body>
        </html>
      `);
      return;
    }
    
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  // ==================== WEBSOCKET HANDLERS ====================

  async handleWebSocketConnection(ws, request) {
    try {
      const parsedUrl = url.parse(request.url, true);
      const path = parsedUrl.pathname;

      if (path === '/vless-mediafairy' || path === '/trojan-mediafairy') {
        await this.websocketHandler(ws);
        return;
      }

      ws.close(1000, "Invalid WebSocket path");
    } catch (err) {
      ws.close(1011, 'Internal server error');
    }
  }

  async websocketHandler(ws) {
    let remoteSocketWrapper = { value: null };

    ws.on('message', async (message) => {
      try {
        const chunk = Buffer.from(message);
        
        // Catat trafik Upload (Client -> Server)
        this.stats.rx += chunk.length;

        if (remoteSocketWrapper.value) {
          remoteSocketWrapper.value.write(chunk);
          return;
        }

        const protocol = await this.protocolSniffer(chunk);
        let protocolHeader;

        if (protocol === horse) {
          protocolHeader = this.readHorseHeader(chunk);
        } else {
          protocolHeader = this.readFlashHeader(chunk); 
        }

        if (protocolHeader.hasError) throw new Error(protocolHeader.message);

        if (protocolHeader.isUDP) {
          return await this.handleUDPOutbound(
            protocolHeader.addressRemote,
            protocolHeader.portRemote,
            chunk.slice(protocolHeader.rawDataIndex),
            ws,
            protocolHeader.version
          );
        }

        this.handleTCPOutBound(
          remoteSocketWrapper,
          protocolHeader.addressRemote,
          protocolHeader.portRemote,
          protocolHeader.rawClientData,
          ws,
          protocolHeader.version
        );
      } catch (err) {
        ws.close(1011, err.message);
      }
    });

    ws.on('close', () => {
      if (remoteSocketWrapper.value) remoteSocketWrapper.value.end();
      this.cleanupUDPConnections(ws);
    });

    ws.on('error', () => {
      this.cleanupUDPConnections(ws);
    });
  }

  // ==================== PROTOCOL SNIFFERS ====================

  async protocolSniffer(buffer) {
    if (buffer.length >= 62) {
      const horseDelimiter = buffer.slice(56, 60);
      if (horseDelimiter[0] === 0x0d && horseDelimiter[1] === 0x0a) {
        if ([0x01, 0x03, 0x7f].includes(horseDelimiter[2])) {
          if ([0x01, 0x03, 0x04].includes(horseDelimiter[3])) {
            return horse;
          }
        }
      }
    }
    return flash; 
  }

  async handleTCPOutBound(remoteSocket, addressRemote, portRemote, rawClientData, webSocket, responseHeader) {
    const connectAndWrite = (address, port) => {
      return new Promise((resolve, reject) => {
        const tcpSocket = net.createConnection({ host: address, port: port }, () => {
          tcpSocket.write(rawClientData);
          resolve(tcpSocket);
        });
        tcpSocket.on('error', reject);
      });
    };

    try {
      const tcpSocket = await connectAndWrite(addressRemote, portRemote);
      remoteSocket.value = tcpSocket;
      tcpSocket.on('close', () => webSocket.close());
      tcpSocket.on('error', () => webSocket.close());
      this.remoteSocketToWS(tcpSocket, webSocket, responseHeader);
    } catch (error) {
      webSocket.close();
    }
  }

  // ==================== UDP NATIVE HANDLER ====================

  async handleUDPOutbound(targetAddress, targetPort, dataChunk, webSocket, responseHeader) {
    return new Promise((resolve) => {
      try {
        let protocolHeader = responseHeader;
        const connectionKey = `${targetAddress}:${targetPort}:${Date.now()}`;
        const udpSocket = dgram.createSocket('udp4');
        
        this.activeUDPConnections.set(connectionKey, { socket: udpSocket, webSocket: webSocket });
        
        udpSocket.on('error', () => {
          try { udpSocket.close(); } catch (_) {}
          this.activeUDPConnections.delete(connectionKey);
        });

        udpSocket.send(dataChunk, targetPort, targetAddress, (error) => {
          if (error) {
            try { udpSocket.close(); } catch (_) {}
            this.activeUDPConnections.delete(connectionKey);
            return;
          }
        });
        
        udpSocket.on('message', (message) => {
          // Catat trafik UDP Download (Internet -> Server -> Client)
          this.stats.tx += message.length;
          
          if (webSocket.readyState === WebSocket.OPEN) {
            if (protocolHeader) {
              const combined = Buffer.concat([Buffer.from(protocolHeader), message]);
              webSocket.send(combined);
              protocolHeader = null;
            } else {
              webSocket.send(message);
            }
          }
        });
        
        udpSocket.on('close', () => {
          this.activeUDPConnections.delete(connectionKey);
        });
        
        let idleTimeout = setTimeout(() => {
          if (udpSocket) {
            try { udpSocket.close(); } catch (_) {}
            this.activeUDPConnections.delete(connectionKey);
          }
        }, 30000);
        
        udpSocket.on('message', () => {
          clearTimeout(idleTimeout);
          idleTimeout = setTimeout(() => {
            if (udpSocket) {
              try { udpSocket.close(); } catch (_) {}
              this.activeUDPConnections.delete(connectionKey);
            }
          }, 30000);
        });
        
      } catch (e) {}
    });
  }

  cleanupUDPConnections(webSocket) {
    for (const [key, connection] of this.activeUDPConnections.entries()) {
      if (connection.webSocket === webSocket) {
        try { connection.socket.close(); } catch (_) {}
        this.activeUDPConnections.delete(key);
      }
    }
  }

  readFlashHeader(buffer) {
    const version = buffer[0];
    let isUDP = false;
    const optLength = buffer[17];
    const cmd = buffer[18 + optLength];
    
    if (cmd === 2) isUDP = true;
    else if (cmd !== 1) return { hasError: true, message: `command ${cmd} is not supported` };
    
    const portIndex = 18 + optLength + 1;
    const portRemote = buffer.readUInt16BE(portIndex);
    let addressIndex = portIndex + 2;
    const addressType = buffer[addressIndex];
    let addressLength = 0;
    let addressValueIndex = addressIndex + 1;
    let addressValue = "";
    
    switch (addressType) {
      case 1:
        addressLength = 4;
        addressValue = Array.from(buffer.slice(addressValueIndex, addressValueIndex + addressLength)).join(".");
        break;
      case 2:
        addressLength = buffer[addressValueIndex];
        addressValueIndex += 1;
        addressValue = buffer.slice(addressValueIndex, addressValueIndex + addressLength).toString();
        break;
      case 3:
        addressLength = 16;
        const ipv6 = [];
        for (let i = 0; i < 8; i++) ipv6.push(buffer.readUInt16BE(addressValueIndex + i * 2).toString(16));
        addressValue = ipv6.join(":");
        break;
      default:
        return { hasError: true, message: `invalid addressType is ${addressType}` };
    }
    
    if (!addressValue) return { hasError: true, message: `addressValue is empty` };

    return {
      hasError: false,
      addressRemote: addressValue,
      addressType: addressType,
      portRemote: portRemote,
      rawDataIndex: addressValueIndex + addressLength,
      rawClientData: buffer.slice(addressValueIndex + addressLength),
      version: Buffer.from([version, 0]),
      isUDP: isUDP,
    };
  }

  readHorseHeader(buffer) {
    const dataBuffer = buffer.slice(58);
    if (dataBuffer.length < 6) return { hasError: true, message: "invalid request data" };

    let isUDP = false;
    const cmd = dataBuffer[0];
    if (cmd == 3) isUDP = true;
    else if (cmd != 1) throw new Error("Unsupported command type!");

    let addressType = dataBuffer[1];
    let addressLength = 0;
    let addressValueIndex = 2;
    let addressValue = "";
    
    switch (addressType) {
      case 1:
        addressLength = 4;
        addressValue = Array.from(dataBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join(".");
        break;
      case 3:
        addressLength = dataBuffer[addressValueIndex];
        addressValueIndex += 1;
        addressValue = dataBuffer.slice(addressValueIndex, addressValueIndex + addressLength).toString();
        break;
      case 4:
        addressLength = 16;
        const ipv6 = [];
        for (let i = 0; i < 8; i++) ipv6.push(dataBuffer.readUInt16BE(addressValueIndex + i * 2).toString(16));
        addressValue = ipv6.join(":");
        break;
      default:
        return { hasError: true, message: `invalid addressType is ${addressType}` };
    }

    if (!addressValue) return { hasError: true, message: `address is empty` };

    const portIndex = addressValueIndex + addressLength;
    const portRemote = dataBuffer.readUInt16BE(portIndex);
    return {
      hasError: false,
      addressRemote: addressValue,
      addressType: addressType,
      portRemote: portRemote,
      rawDataIndex: portIndex + 4,
      rawClientData: dataBuffer.slice(portIndex + 4),
      version: null,
      isUDP: isUDP,
    };
  }

  remoteSocketToWS(remoteSocket, webSocket, responseHeader) {
    let header = responseHeader;

    remoteSocket.on('data', (chunk) => {
      // Catat trafik TCP Download (Internet -> Server -> Client)
      this.stats.tx += chunk.length;
      
      if (webSocket.readyState !== WS_READY_STATE_OPEN) {
        remoteSocket.destroy();
        return;
      }
      if (header) {
        const combined = Buffer.concat([Buffer.from(header), chunk]);
        webSocket.send(combined);
        header = null;
      } else {
        webSocket.send(chunk);
      }
    });
  }

  // ==================== SERVER START ====================

  start(port = process.env.PORT || 3000) {
    const server = http.createServer((req, res) => {
      this.handleHttpRequest(req, res).catch(() => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      });
    });

    this.wss = new WebSocket.Server({ server, perMessageDeflate: false });

    this.wss.on('connection', (ws, req) => {
      this.handleWebSocketConnection(ws, req);
    });

    const gracefulShutdown = () => {
      if (this.wss) {
        this.wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) client.close();
        });
        this.wss.close();
      }
      for (const [key, connection] of this.activeUDPConnections.entries()) {
        try { connection.socket.close(); } catch (err) {}
      }
      this.activeUDPConnections.clear();
      if (this.httpServer) {
        this.httpServer.close(() => process.exit(0));
      }
      setTimeout(() => { process.exit(1); }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    server.listen(port, '0.0.0.0', () => {
      console.log(`Backend Active on Port ${port}`);
    });

    this.httpServer = server;
  }
}

if (require.main === module) {
  const server = new GatewayServer();
  const port = process.env.PORT || 3000;
  server.start(port);
}

module.exports = GatewayServer;
