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
  }

// ==================== HTTP HANDLERS ====================

  async handleHttpRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    
    // Response for dashboard/root
    if (parsedUrl.pathname === '/') {
      const serverUptime = Math.floor(process.uptime());
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>STATUS // MEDIAFAIRY</title>
          <style>
            body {
              margin: 0;
              background-color: #050505;
              font-family: 'Courier New', Courier, monospace;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              height: 100vh;
              user-select: none;
            }
            .header-brand {
              font-size: 1.5rem;
              font-weight: 900;
              letter-spacing: 4px;
              margin-bottom: 30px;
            }
            .brand-media { color: #FFFFFF; }
            .brand-fairy { color: #0088FF; }
            .status-container {
              background: #0A0A0A;
              border: 1px solid #222;
              border-radius: 16px;
              padding: 40px 60px;
              text-align: center;
              box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }
            .status-badge {
              display: inline-flex;
              align-items: center;
              gap: 12px;
              background: rgba(0, 255, 136, 0.1);
              border: 1px solid rgba(0, 255, 136, 0.2);
              color: #00FF88;
              padding: 8px 16px;
              border-radius: 50px;
              font-size: 0.9rem;
              font-weight: bold;
              letter-spacing: 1px;
              margin-bottom: 25px;
            }
            .dot {
              width: 10px;
              height: 10px;
              background-color: #00FF88;
              border-radius: 50%;
              box-shadow: 0 0 10px #00FF88;
              animation: pulse 2s infinite;
            }
            .uptime-label {
              color: #666;
              font-size: 0.8rem;
              letter-spacing: 2px;
              margin-bottom: 5px;
              text-transform: uppercase;
            }
            .uptime-value {
              color: #EDEDED;
              font-size: 3rem;
              font-weight: bold;
              letter-spacing: 2px;
            }
            @keyframes pulse {
              0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.7); }
              70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(0, 255, 136, 0); }
              100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 255, 136, 0); }
            }
          </style>
        </head>
        <body>
          <div class="header-brand">
            <span class="brand-media">MEDIA</span><span class="brand-fairy">FAIRY</span>
          </div>
          
          <div class="status-container">
            <div class="status-badge">
              <div class="dot"></div>
              SERVER RUNNING
            </div>
            
            <div class="uptime-label">System Uptime</div>
            <div class="uptime-value" id="uptime-display">00:00:00</div>
          </div>

          <script>
            // Mengambil detik uptime asli dari server Node.js saat halaman dimuat
            let totalSeconds = ${serverUptime};
            const display = document.getElementById('uptime-display');
            
            function updateUptime() {
              totalSeconds++;
              const days = Math.floor(totalSeconds / 86400);
              const hours = Math.floor((totalSeconds % 86400) / 3600);
              const minutes = Math.floor((totalSeconds % 3600) / 60);
              const seconds = totalSeconds % 60;
              
              let timeString = '';
              if (days > 0) timeString += days + 'd ';
              timeString += String(hours).padStart(2, '0') + ':';
              timeString += String(minutes).padStart(2, '0') + ':';
              timeString += String(seconds).padStart(2, '0');
              
              display.innerText = timeString;
            }

            // Jalankan sekali lalu set interval tiap detik
            updateUptime();
            setInterval(updateUptime, 1000);
          </script>
        </body>
        </html>
      `);
      return;
    }
    
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
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
