import http from 'http';
import os from 'os';
import fs from 'fs';
import { getAllAfkData, getAllMsgCounts, getAllBlacklist } from './database.js';

export function startWebserver(client) {
  const PORT = process.env.PORT || 3000;
  const startTime = Date.now();

  const server = http.createServer(async (req, res) => {
    if (req.url === '/') {
      try {
        // Gather Stats
        const uptime = formatUptime(client.uptime);
        const ping = Math.round(client.ws.ping);
        const guilds = client.guilds.cache.size;
        const members = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const channels = client.channels.cache.size;
        
        const afkData = await getAllAfkData();
        const msgCounts = await getAllMsgCounts();
        const blacklist = await getAllBlacklist();

        const afkCount = afkData.size;
        const msgCount = msgCounts.size;
        const blacklistCount = blacklist.size;
        
        // System stats
        const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

        // Load commands from JSON (auto-updates when Git updates)
        let commands = [];
        try {
          const data = fs.readFileSync('./commands.json', 'utf8');
          commands = JSON.parse(data).commands || [];
        } catch (err) {
          console.error("Failed to load commands.json:", err);
        }

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="refresh" content="5">
  <title>NINJA BOT STATUS</title>
  <style>
    * {
      box-sizing: border-box;
    }
    :root {
      --bg: #000000;
      --fg: #ffffff;
      --accent: #444444;
      --border: #ffffff;
    }
    html, body {
      height: 100%;
    }
    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: 'Courier New', Courier, monospace;
      margin: 0;
      padding: 15px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      width: 100%;
      max-width: 900px;
      border: 2px solid var(--border);
      padding: 15px;
    }
    header {
      border-bottom: 2px solid var(--border);
      padding-bottom: 15px;
      margin-bottom: 15px;
      text-align: center;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    header p {
      margin: 8px 0 0 0;
      font-size: 0.9rem;
    }
    .status-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .card {
      border: 1px solid var(--accent);
      padding: 12px 8px;
      text-align: center;
      background: rgba(255,255,255,0.02);
    }
    .card h2 {
      font-size: 0.7rem;
      margin: 0 0 8px 0;
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .card .value {
      font-size: 1.2rem;
      font-weight: bold;
      word-break: break-word;
    }
    .footer {
      margin-top: 20px;
      font-size: 0.7rem;
      opacity: 0.4;
      text-align: center;
    }
    .blink {
      animation: blink 1s infinite;
    }
    @keyframes blink {
      0% { opacity: 1; }
      50% { opacity: 0; }
      100% { opacity: 1; }
    }

    /* Commands Section */
    .commands {
      margin-top: 25px;
      border-top: 1px solid var(--border);
      padding-top: 15px;
    }
    .commands h2 {
      font-size: 1rem;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .commands ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .commands li {
      font-size: 0.85rem;
      padding: 3px 0;
      opacity: 0.8;
    }

    /* Tablet */
    @media (max-width: 768px) {
      h1 {
        font-size: 1.3rem;
      }
      .card .value {
        font-size: 1.1rem;
      }
    }
    /* Mobile */
    @media (max-width: 480px) {
      body {
        padding: 10px;
      }
      .container {
        padding: 12px;
        border-width: 1px;
      }
      h1 {
        font-size: 1.1rem;
        letter-spacing: 1px;
      }
      header p {
        font-size: 0.8rem;
      }
      .status-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      .card {
        padding: 10px 6px;
      }
      .card h2 {
        font-size: 0.6rem;
        margin-bottom: 5px;
      }
      .card .value {
        font-size: 1rem;
      }
      .footer {
        font-size: 0.6rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>NINJA V2 SYSTEM <span class="blink">_</span></h1>
      <p>STATUS: ONLINE</p>
    </header>

    <div class="status-grid">
      <div class="card"><h2>Uptime</h2><div class="value">${uptime}</div></div>
      <div class="card"><h2>Ping</h2><div class="value">${ping} ms</div></div>
      <div class="card"><h2>Memory</h2><div class="value">${memUsage} MB</div></div>
      <div class="card"><h2>Servers</h2><div class="value">${guilds}</div></div>
      <div class="card"><h2>Users</h2><div class="value">${members}</div></div>
      <div class="card"><h2>Channels</h2><div class="value">${channels}</div></div>
      <div class="card"><h2>AFK Users</h2><div class="value">${afkCount}</div></div>
      <div class="card"><h2>Msg Trackers</h2><div class="value">${msgCount}</div></div>
      <div class="card"><h2>Blacklisted</h2><div class="value">${blacklistCount}</div></div>
    </div>

    <div class="commands">
      <h2>Available Commands</h2>
      <ul>
        ${commands.map(cmd => `<li>${cmd}</li>`).join('')}
      </ul>
    </div>

    <div class="footer">
      SYSTEM TIME: ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>
        `;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      } catch (error) {
        console.error(error);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    } else if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: client.uptime }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(PORT, () => {
    console.log(`🚀 Web server running on http://localhost:${PORT}`);
  });
}

function formatUptime(ms) {
  if (!ms || ms <= 0) return '0d 0h 0m';
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return `${days}d ${hours}h ${minutes}m`;
        }
