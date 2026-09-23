# 📞 Tata WebRTC SIP Dialer (Extension 406)

A modern, responsive, high-performance **WebRTC SIP WebSocket Dialer** pre-configured for Tata SIP lines with real-time SIP packet logging, DTMF tone synthesis, audio controls, and an integrated SIP UDP bridge.

---

## ⚡ Quick Start

### 1. Requirements
- Node.js (v18 or higher)
- Google Chrome, Microsoft Edge, or Mozilla Firefox

### 2. Run Locally
```bash
# Clone or navigate to the project directory
git clone https://github.com/luckyneo12/sip_wss_calling.git
cd sip_wss_calling

# Install dependencies
npm install

# Start the web dialer and bridge server
npm start
```

Now open your browser and navigate to:
👉 **`http://localhost:3000`**

---

## 🔑 Pre-Configured Tata Credentials

The dialer is pre-configured with the following credentials:
| Parameter | Value |
| :--- | :--- |
| **Extension / Username** | `406` |
| **SIP Server / Domain** | `103.9.14.223` |
| **SIP Password / Secret** | `GSM123ext` |
| **Default SIP Port** | `5060` (UDP / TCP) |
| **Default WebSocket URL** | `ws://localhost:3000/sip-bridge` |

---

## 🌐 How Browser SIP & WebSockets Work

### 1. Web Browsers vs Standard Softphones
- Conventional softphones (Zoiper, MicroSIP, Yealink) communicate directly over **raw UDP SIP on port 5060**.
- **Web browsers (Chrome, Edge, Firefox)** cannot send raw UDP packets due to security sandbox policies. They strictly communicate via **WebSocket (`ws://` or `wss://`)** and transmit encrypted audio using **WebRTC (SRTP)**.

### 2. Supported Connection Modes:
1. **Mode A: Direct WSS to PBX**
   - If your PBX server at `103.9.14.223` has WebRTC enabled (e.g. FreePBX / Asterisk on port 8089 or reverse proxy on port 443), set the WebSocket URL to:
     `wss://103.9.14.223:8089/ws` or `wss://103.9.14.223/ws`
   - *SSL Certificate Note*: If the server uses a self-signed or untrusted SSL certificate, open `https://103.9.14.223:8089/ws` directly in a browser tab once, select **Advanced → Proceed to 103.9.14.223 (unsafe)**, and then return to the dialer.
2. **Mode B: Built-in Local Bridge (Recommended for pure SIP lines)**
   - If the SIP provider only supports standard UDP SIP on port 5060 without native WebSockets, keep the default WebSocket URL:
     `ws://localhost:3000/sip-bridge`
   - The included Node.js server automatically bridges browser WebSockets to UDP port 5060 on `103.9.14.223`.

---

## 🚀 Git Setup & Deployment

To push changes or deploy to your own server:

```bash
# Push updates to GitHub
git add .
git commit -m "update dialer configuration"
git push origin main
```

---

## 🛠️ Features

- **🎙️ WebRTC Voice Engine**: Full bidirectional audio with microphone capture and remote stream playback.
- **🔢 Authentic DTMF Keypad**: Dual-tone frequencies generated via the Web Audio API with in-call keypad dialing.
- **📡 Live SIP Packet Inspector**: Real-time log console displaying all SIP transactions:
  - `REGISTER`
  - `200 OK` (Registration / Call Accepted)
  - `401 Unauthorized` (Authentication Challenge)
  - `INVITE`, `RINGING`, and `BYE`
  - WebRTC ICE Candidate & SRTP connection status
- **🔍 Built-in Diagnostics**: 1-click port tester checking TCP 5060, 80, 443, 8088, 8089, and SIP UDP response on `103.9.14.223`.
- **⚙️ Dynamic Configuration Drawer**: Adjust extension, password, domain, or WebSocket endpoints on the fly without editing code.
- **📦 Zero External Dependencies at Runtime**: Bundled offline JsSIP library.

---

## 📁 Project Structure

```
sip_wss_calling/
├── public/
│   ├── index.html        # Main dialer interface
│   ├── style.css         # Modern dark glassmorphism styling
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

## ❓ Troubleshooting

1. **"WebSocket connection failed" / "Registration Failed"**:
   - Check if you are attempting `wss://103.9.14.223:8089/ws` while that port is filtered by a firewall.
   - Switch to the built-in bridge: `ws://localhost:3000/sip-bridge`.
   - Click the **Diagnostics** button in the top navigation bar to inspect accessible ports on `103.9.14.223`.
2. **"401 Unauthorized"**:
   - Confirm that the Extension is `406` and Password is `GSM123ext`.
3. **No Audio on Call**:
   - Ensure microphone permission is granted in your browser.
   - STUN servers (`stun.l.google.com:19302`) are pre-configured for NAT traversal.
