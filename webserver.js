import http from 'http';
import { getAllAfkData, getAllMsgCounts, getAllBlacklist } from './database.js';

export function startWebserver(client) {
  const PORT = process.env.PORT || 3000;

  const server = http.createServer(async (req, res) => {
    if (req.url === '/') {
      try {
        // Gather Stats
        const uptime = formatUptime(client.uptime);
        const ping = Math.round(client.ws.ping);
        const guilds = client.guilds.cache.size;
        const members = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        
        const afkData = await getAllAfkData();
        const msgCounts = await getAllMsgCounts();
        const blacklist = await getAllBlacklist();

        const afkCount = afkData.size;
        const msgCount = msgCounts.size;
        const blacklistCount = blacklist.size;

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="5">
  <title>NINJA BOT STATUS</title>
  <style>
    :root {
      --bg: #000000;
      --fg: #ffffff;
      --accent: #333333;
      --border: #ffffff;
    }
    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: 'Courier New', Courier, monospace;
      margin: 0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      width: 100%;
      max-width: 800px;
      border: 2px solid var(--border);
      padding: 20px;
      box-sizing: border-box;
    }
    header {
      border-bottom: 2px solid var(--border);
      padding-bottom: 20px;
      margin-bottom: 20px;
      text-align: center;
    }
    h1 {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }
    .card {
      border: 1px solid var(--accent);
      padding: 15px;
      text-align: center;
    }
    .card h2 {
      font-size: 0.9rem;
      margin: 0 0 10px 0;
      opacity: 0.8;
      text-transform: uppercase;
    }
    .card .value {
      font-size: 1.5rem;
      font-weight: bold;
    }
    .footer {
      margin-top: 40px;
      font-size: 0.8rem;
      opacity: 0.5;
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
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>NINJA V2 SYSTEM <span class="blink">_</span></h1>
      <p>STATUS: ONLINE</p>
    </header>

    <div class="status-grid">
      <div class="card">
        <h2>Uptime</h2>
        <div class="value">${uptime}</div>
      </div>
      <div class="card">
        <h2>Ping</h2>
        <div class="value">${ping} ms</div>
      </div>
      <div class="card">
        <h2>Servers</h2>
        <div class="value">${guilds}</div>
      </div>
      <div class="card">
        <h2>Users</h2>
        <div class="value">${members}</div>
      </div>
      <div class="card">
        <h2>AFK Users</h2>
        <div class="value">${afkCount}</div>
      </div>
      <div class="card">
        <h2>Msg Trackers</h2>
        <div class="value">${msgCount}</div>
      </div>
      <div class="card">
        <h2>Blacklisted</h2>
        <div class="value">${blacklistCount}</div>
      </div>
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
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return `${days}d ${hours}h ${minutes}m`;
}
