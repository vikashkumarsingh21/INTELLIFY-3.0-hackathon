# INTELLIFY-3.0-hackathon
Smart irrigation with AI crop protection and market insights. INTELLIFY 3.0 2nd Runner Up.

# Innovatrix - Smart Irrigation, AI Crop Protection & Market Insights

[![Hackathon](https://img.shields.io/badge/INTELLIFY%203.0-2nd%20Runner%20Up-blue)]()
[![Tech Stack](https://img.shields.io/badge/Tech-IoT%20%7C%20AI%20%7C%20YOLOv5%20%7C%20Firebase%20%7C%20Node.js-green)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)]()

Innovatrix is a smart irrigation and crop protection system that blends IoT sensors, real-time AI vision, and market data to help farmers save water, protect fields, and make price-smart decisions. Built at INTELLIFY 3.0, awarded 2nd Runner Up.

---

## Table of Contents
- [Features](#features)
- [Architecture](#architecture)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Run](#run)
- [Folder Structure](#folder-structure)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Team](#team)
- [Acknowledgements](#acknowledgements)

---

## Features

- **Automated irrigation** using soil moisture data and weather forecasts
- **AI animal detection** with a live camera feed (YOLOv5)
- **Safe repellent** using buzzer or ultrasonic sound on detection
- **Live crop market prices** with state and crop filters
- **Real-time dashboard** for moisture, weather, pump, battery, and camera status
- **Alerts and notifications** via web or mobile
- **Solar-friendly design**, works in off-grid setups

---

## Architecture

```
[Soil Moisture Sensor]      [Camera]
           |                    |
           v                    v
     [MCU / ESP]          [Raspberry Pi]
           |                    |
           +------->  [Backend API]  <---------+
                        |    ^                 |
                        v    |                 |
                   [Database/Firebase]   [Market & Weather APIs]
                        |                      (Crop Prices, OWM)
                        v
                   [Web Dashboard]
```

**APIs:** OpenWeatherMap for forecast, Crop Price API for market data  
**AI:** YOLOv5 for detection

> Add your system diagram to: `assets/architecture.png` and link it below.

---

## Screenshots

> Replace the placeholders with your real images or GIFs. Keep file names the same or update paths here.

| Preview | Path |
| --- | --- |
| Dashboard overview | `assets/dashboard.png` |
| Animal detection (GIF) | `assets/camera-detection.gif` |
| Market prices with filters | `assets/market-prices.png` |
| INTELLIFY 3.0 certificate | `assets/hackathon-certificate.jpg` |

```md
![Dashboard](assets/dashboard.png)
![Animal Detection](assets/camera-detection.gif)
![Market Prices](assets/market-prices.png)
![INTELLIFY Certificate](assets/hackathon-certificate.jpg)
```

---

## Tech Stack

- **Hardware:** Soil moisture sensor, ESP/Arduino, Raspberry Pi, Camera
- **Backend:** Node.js (Express) + Firebase
- **Frontend:** HTML, CSS, JavaScript
- **AI:** YOLOv5
- **APIs:** OpenWeatherMap, Crop Price API

---

## Getting Started

### 1) Clone

```bash
git clone https://github.com/<your-username>/innovatrix.git
cd innovatrix
```

### 2) Install

```bash
npm install
```

### 3) Environment

Create `.env` at the project root:

```env
# Weather
OWM_API_KEY=your_openweather_api_key

# Crop Market Prices
CROP_API_URL=https://your-crop-price-endpoint
CROP_API_KEY=your_crop_api_key

# Firebase / DB
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...

# Optional: Notifications
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

> Put your screenshots and diagrams in `assets/`.

---

## Run

```bash
# Dev
npm run dev

# Or start
npm start
```

Open http://localhost:3000 in your browser.

---

## Folder Structure

```
innovatrix/
├─ assets/                     # images, gifs, diagrams
├─ public/                     # static files
├─ src/
│  ├─ server/                  # Express routes, services
│  ├─ client/                  # JS, CSS, HTML
│  ├─ ai/                      # YOLOv5 integration hooks
│  └─ utils/                   # helpers
├─ .env.example                # sample env
├─ README.md
└─ package.json
```

---

## Roadmap

- [ ] Add OTA updates for ESP
- [ ] Improve detection model and add zones
- [ ] SMS alerts in local language
- [ ] PWA with offline caching
- [ ] Exportable reports for farmers

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit: `git commit -m "feat: add my feature"`
4. Push: `git push origin feat/my-feature`
5. Open a Pull Request

---

## License

MIT © 2025 Innovatrix Team

---

## Team

- **Vikash Kumar (Team Lead)**
- Rokhiya Khanam
- Kirtan Pal Singh
- Shashank Agarwal

---

## Acknowledgements

- INTELLIFY 3.0 Hackathon
- OpenWeatherMap
- YOLOv5
