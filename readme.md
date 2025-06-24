# OBS Remote Control Web Interface

![OBS Remote Control Screenshot](/example.png)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/AntiParty/obs-dashboard-websocket?utm_source=oss&utm_medium=github&utm_campaign=AntiParty%2Fobs-dashboard-websocket&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

A responsive web application for remotely controlling OBS Studio via its WebSocket API.

---

## ✨ Features

- **Scene Management**
  - View all scenes with preview thumbnails
  - Switch between scenes with one click
  - Visual indicator of current scene

- **Source Control**
  - Toggle visibility of sources
  - Control audio sources (mute/unmute, volume adjustment)
  - Nested group support
  - Real-time updates

- **Stream/Recording Controls**
  - Start/stop streaming
  - Start/stop recording
  - Status indicators

- **Connection Management**
  - Automatic reconnection
  - Status monitoring
  - Connection health checks

---

## 🚀 Installation

### Prerequisites

- Node.js v14+
- OBS Studio v28+
- OBS WebSocket plugin v5+

### Setup Steps

1. **Configure OBS WebSocket**
   - Open OBS → `Tools` → `WebSocket Server Settings`
   - Enable the WebSocket server
   - Set the port (default: `4455`) and password if desired

2. **Clone and install**
   ```bash
   git clone https://github.com/antiparty/obs-dashboard-websocket.git
   cd obs-dashboard-websocket
   npm install
   cp .env.example .env

3. **Configure your .env file **
  ```ini
  OBS_HOST=localhost
  OBS_PORT=4455
  OBS_PASSWORD=yourpassword
  SERVER_PORT=2000
  ```

4. ** Start the server**
  ```bash
  node server.js
  ```

5. **Access the app**
  -Visit http://localhost:2000 in your browser.

## API Endpoints
Endpoint	Method	Description	Example Payload
- `/api/obs-status`	`GET`	Get OBS status	`{}`
- `/api/scenes`	`GET`	List scenes	`{}`
- `/api/sources/:scene`	`GET` Get scene sources	```{"sceneName":"Main"}```
- `/api/switch_scene`	`POST`	Change scene	```{"sceneName":"Main"}```
- `/api/toggle_source`	`POST`	Toggle source	```{"sceneName":"Main","sourceId":1,"visible":true}```
