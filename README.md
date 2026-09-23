# 📞 Tata WebRTC SIP Dialer (Extension 406)

A modern, responsive, high-performance **WebRTC SIP WebSocket Dialer** pre-configured for Tata SIP lines with real-time SIP packet logging, DTMF tone synthesis, audio controls, and an integrated SIP UDP bridge.

---

## ⚡ Quick Start (तेज़ी से शुरू करें)

### 1. Requirements
- Node.js (v18 or higher)
- Google Chrome, Microsoft Edge, or Mozilla Firefox

### 2. Run Locally (लोकल कंप्यूटर पर चलाएं)
```bash
# Clone or navigate to the project directory
cd diler

# Install dependencies (only required once)
npm install

# Start the web dialer and bridge server
npm start
```

Now open your browser and navigate to:
👉 **`http://localhost:3000`**

---

## 🔑 Pre-Configured Tata Credentials

The dialer is pre-configured with the credentials you provided:
| Parameter | Value |
| :--- | :--- |
| **Extension / Username** | `406` |
| **SIP Server / Domain** | `103.9.14.223` |
| **SIP Password / Secret** | `GSM123ext` |
| **Default SIP Port** | `5060` (UDP / TCP) |
| **Default WebSocket URL** | `ws://localhost:3000/sip-bridge` |

---

## 🌐 How Browser SIP & WebSockets Work (ज़रूरी जानकारी)

### 1. Web Browsers vs Standard Softphones
- Zoiper, MicroSIP, and Yealink desk phones communicate directly over **raw UDP SIP on port 5060**.
- **Web browsers (Chrome, Edge, Firefox)** CANNOT send raw UDP packets for security reasons. They strictly communicate via **WebSocket (`ws://` or `wss://`)** and transmit audio using **WebRTC (SRTP)**.

### 2. Two Connection Modes Provided:
1. **Mode A: Direct WSS to PBX**
   - If your server at `103.9.14.223` has WebRTC enabled (e.g. FreePBX / Asterisk on port 8089 or reverse proxy on port 443), set the WebSocket URL to:
     `wss://103.9.14.223:8089/ws` or `wss://103.9.14.223/ws`
   - *Note on SSL*: If the server uses a self-signed or expired SSL cert, open `https://103.9.14.223:8089/ws` once in your browser tab, click **Advanced → Proceed to 103.9.14.223 (unsafe)**, then reload the dialer.
2. **Mode B: Built-in Local Bridge (Recommended for pure SIP lines)**
   - If Tata only provided a standard UDP SIP line on port 5060, keep the default WebSocket URL:
     `ws://localhost:3000/sip-bridge`
   - The included Node.js server automatically bridges browser WebSockets to UDP port 5060 on `103.9.14.223`.

---

## 🚀 How to Upload to GitHub (Git Repo Setup)

Run these commands in your terminal to initialize Git and upload the dialer to your GitHub account:

```bash
# 1. Initialize git repository
git init

# 2. Stage all project files
git add .

# 3. Create your first commit
git commit -m "feat: initial Tata WebRTC SIP dialer setup with live diagnostics"

# 4. Rename default branch to main
git branch -M main

# 5. Link your GitHub remote repository (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 6. Push to GitHub
git push -u origin main
```

---

## 🛠️ Features Included

- **🎙️ WebRTC Voice Engine**: Full bidirectional audio with microphone input and remote speaker stream.
- **🔢 Authentic DTMF Keypad**: Audio tones synthesized dynamically using the Web Audio API with in-call DTMF dialing.
- **📡 Live SIP Packet Inspector**: Real-time log console showing all SIP transactions:
  - `REGISTER`
  - `200 OK` (Registration / Call Accepted)
  - `401 Unauthorized` (Authentication challenge)
  - `INVITE` & `BYE`
  - WebRTC ICE Candidate & SRTP status
- **🔍 Built-in Diagnostics**: 1-click port scanner to test TCP 5060, 80, 443, 8088, 8089, and SIP UDP response on `103.9.14.223`.
- **⚙️ Dynamic Configuration Drawer**: Change extension, password, server, or WebSocket endpoint anytime without touching the source code.
- **📦 Zero CDN Dependencies**: Bundled JsSIP library so everything works completely offline.

---

## 📁 Project Structure

```
diler/
├── public/
│   ├── index.html        # Main dialer interface
│   ├── style.css         # Modern dark glassmorphic styling
│   ├── app.js            # JsSIP engine, Web Audio, Call state machine
│   └── jssip.min.js      # Bundled JsSIP WebRTC library
├── server/
│   ├── server.js         # HTTP server, diagnostic API, and WebSocket bridge
│   └── bridge.js         # Standalone WebSocket-to-SIP bridge
├── .gitignore            # Ignored files (node_modules, logs)
├── package.json          # Node project manifest
└── README.md             # Documentation and instructions
```

---

## ❓ Troubleshooting (समस्या निवारण)

1. **"WebSocket connection failed" / "Registration Failed"**:
   - Check if you are using `wss://103.9.14.223:8089/ws` while the port is blocked by a firewall.
   - Switch to the built-in bridge: `ws://localhost:3000/sip-bridge`.
   - Click the **Diagnostics** button in the top navigation bar to test reachable ports on `103.9.14.223`.
2. **"401 Unauthorized"**:
   - Verify that Extension is `406` and Password is `GSM123ext`.
3. **No Audio on Call**:
   - Ensure you allow Microphone permission when prompted by Chrome/Firefox.
   - WebRTC requires STUN/TURN servers for audio traversal across NAT; Google STUN is configured by default.
