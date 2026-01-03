import http from 'http';
import os from 'os';
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
        const channels = client.channels.cache.size;

        const afkData = await getAllAfkData();
        const msgCounts = await getAllMsgCounts();
        const blacklist = await getAllBlacklist();

        const afkCount = afkData.size;
        const msgCount = msgCounts.size;
        const blacklistCount = blacklist.size;

        const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

        // ⭐ YOUR COMMAND CATEGORIES
        const commandCategories = {
          general: {
            emoji: "📌",
            title: "General Commands",
            commands: [
              { name: "serverinfo", desc: "shows everything about the server" },
              { name: ",ping", desc: "Check bot latency" },
              { name: ",info", desc: "Bot info" },
              { name: ",avatar", desc: "User avatar" },
              { name: ",userinfo", desc: "User details" },
              { name: ",translate", desc: "Translate a message" },
              { name: ",ownerinfo", desc: "show the owners info" },
              { name: ",memberdm", desc: "DM any user with the command" },
              { name: ",servericon", desc: "show the servers icon" },
              { name: ",uptime", desc: "Bot uptime" }
            ]
          },

          afk: {
            emoji: "🕒",
            title: "AFK Commands",
            commands: [
              { name: ",afk", desc: "Set AFK status" },
              { name: ",afklb", desc: "AFK leaderboard" }
            ]
          },

          leaderboard: {
            emoji: "🏆",
            title: "Leaderboard Commands",
            commands: [
              { name: ",msglb", desc: "Message leaderboard" },
              { name: ",afklb", desc: "AFK leaderboard" }
            ]
          },

          animals: {
            emoji: "🦊",
            title: "Fun Animals",
            commands: [
              { name: ",cat", desc: "Sends a random cat image" },
              { name: ",dog", desc: "Sends a random dog image" },
              { name: ",bird", desc: "Sends a random bird image" },
              { name: ",fox", desc: "Sends a random fox image" }
            ]
          },

          fun: {
            emoji: "🎉",
            title: "Fun Commands",
            commands: [
              { name: ",roast", desc: "Roast a user" },
              { name: ",lore", desc: "Generate chaotic lore" },
              { name: ",av", desc: "Strawberry spam" },
              { name: ",pokemon", desc: "Rolls a random pokemon" },
              { name: ",ship", desc: "ship 2 users" },
              { name: ",prophecy", desc: "show a users fate" },
              { name: ",aura", desc: "show a users aura" },
              { name: ",luck", desc: "check your luck" },
              { name: ",fact", desc: "Useless fact" }
            ]
          }
        };

        // ⭐ BUILD CATEGORY HTML
        const categoryButtons = Object.keys(commandCategories)
          .map(cat => `<button class="cat-btn" onclick="showCategory('${cat}')">${commandCategories[cat].emoji}</button>`)
          .join('');

        const categorySections = Object.keys(commandCategories)
          .map(cat => `
            <div class="command-category" id="${cat}" style="display:none;">
              <h3>${commandCategories[cat].emoji} ${commandCategories[cat].title}</h3>
              <ul>
                ${commandCategories[cat].commands
                  .map(cmd => `<li><strong>${cmd.name}</strong> — ${cmd.desc}</li>`)
                  .join('')}
              </ul>
            </div>
          `)
          .join('');

        // ⭐ FULL HTML PAGE
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="refresh" content="5">
  <title>NINJA BOT STATUS</title>
  <style>
    * { box-sizing: border-box; }
    :root {
      --bg: #000000;
      --fg: #ffffff;
      --accent: #444444;
      --border: #ffffff;
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
    }
    .footer {
      margin-top: 20px;
      font-size: 0.7rem;
      opacity: 0.4;
      text-align: center;
    }

    /* COMMANDS */
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
    .cat-btn {
      background: #111;
      color: white;
      border: 1px solid white;
      padding: 5px 10px;
      margin-right: 5px;
      cursor: pointer;
    }
    .cat-btn:hover {
      background: #333;
    }
    .command-category ul {
      list-style: none;
      padding: 0;
      margin: 10px 0 0 0;
    }
    .command-category li {
      padding: 3px 0;
      font-size: 0.85rem;
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

    <!-- ⭐ CATEGORY SWITCHER -->
    <div class="commands">
      <h2>Commands</h2>
      <div>${categoryButtons}</div>
      ${categorySections}
    </div>

    <div class="footer">
      SYSTEM TIME: ${new Date().toISOString()}
    </div>
  </div>

  <script>
    function showCategory(cat) {
      document.querySelectorAll('.command-category').forEach(div => div.style.display = 'none');
      document.getElementById(cat).style.display = 'block';
    }
    showCategory('general');
  </script>

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
  const minutes = Math.floor((ms / 1000 / 60) % 60);
  const hours = Math.floor((ms / 1000 / 60 / 60) % 24);
  const days = Math.floor(ms / 1000 / 60 / 60 / 24);
  return `${days}d ${hours}h ${minutes}m`;
        }
