# 🏰 Iraq Sitak Villa Project - IT & ELV Infrastructure Asset Management Web Application

> **High-Performance Infrastructure Management Engine built with React (Vite + Tailwind CSS + Lucide Icons), Node.js (Express), Supabase (PostgreSQL + Storage + pgvector), and Google Gemini Vision & RAG AI.**

Designed specifically for the luxury mountainous estate **"Iraq Sitak Villa Project"** in Sulaymaniyah, Kurdistan Region of Iraq (KRI).

---

## 🌟 Key Features Implemented

### 1. 📋 BOQ Manager & Auto-Categorization
- Pre-configured with the **11 core ELV project disciplines**:
  1. **IPTV Headend** (Televes Avant X Pro, Multicast streaming)
  2. **Automation & AV** (Crestron CP4N, TSW-770 touchscreens, lighting gateways)
  3. **Speakers** (Bowers & Wilkins CCM663 architectural speakers)
  4. **TV & Projectors** (Sony Bravia 4K Displays, drop screens)
  5. **Home Cinema** (Trinnov Altitude 16 reference audio processor)
  6. **Wi-Fi** (Ubiquiti UniFi U7-Pro Wi-Fi 7, U6-Mesh-Pro Outdoor)
  7. **CCTV** (Hikvision 4K ColorVu AI Bullet Cameras)
  8. **LPR** (Hikvision DeepinView ANPR + Automatic vehicle barrier relays)
  9. **Access Control** (Biometric facial recognition terminals & maglocks)
  10. **Intrusion Alarm** (Paradox EVO192 security control panels)
  11. **IP PBX/Intercom** (Akuvox R29C SIP master entrance station)
- Stores: Brand, Model, Description, Total BOQ Qty, Product Image (Supabase Storage), PDF Manual/Catalog URL, Rack-mount specs, and dynamic JSON schema properties.
- **Bulk Provisioning Engine**: Spin up N individual device instances in 1-click with custom prefixing, automatic MAC address synthesis, and starting VLAN IDs.

### 2. 🏷️ Individual Device Provisioning & Labeling
- Generates and tracks individual hardware instances with:
  - **Custom Label ID** (e.g. `AP-GF-01`, `TV-HEADEND-01`, `TSW-GF-LIVING`)
  - **Serial Number** & **MAC Address**
  - **IP Address**, **Subnet Mask**, **Default Gateway**, and **VLAN ID**
  - **Switch Name & Port** (e.g. `SW-CORE-RACK-48P [Port 14]`)
  - **Rack Unit** (e.g. `Main 42U Rack A [U38-U39]`)
  - **Installation Status Lifecycle**: `Pending` ➔ `Installed` ➔ `Configured` ➔ `Verified`
  - **Configuration Backup File** upload and engineering field notes.

### 3. 🗺️ Interactive Infrastructure Map (Click-to-Pin Topology)
- Switchable blueprint floor plans and elevations:
  - **Ground Floor Main Living & Terraces** (Indoor Zone)
  - **First Floor Bedrooms & Master Suites** (Indoor Zone)
  - **Basement, Spa & Private Cinema** (Indoor Zone)
  - **Main Server Room - 42U Rack Elevations** (Rack Zone)
  - **Villa Estate Grounds & Perimeter Gates** (Outdoor Zone)
- **Interactive Staging Canvas**:
  - Click on the blueprint to place unpinned hardware or drag pins to exact coordinates.
  - Color-coded status rings (Pending: Amber, Installed: Blue, Configured: Indigo, Verified: Emerald).
  - Pin click opens the **Inspection Drawer** displaying real-time IP config, MAC, switch port, rack unit, PDF manual, and live **ICMP Ping simulation**.
  - Direct "Launch AI Troubleshooter" action pre-loaded with the selected device.

### 4. 🤖 AI Camera Scanner (OCR + Barcode Auto-Provisioning)
- Mobile-friendly camera scanner supporting live video feed and photo upload.
- Integrated with **Gemini Vision API** to read hardware stickers and barcodes.
- Extracts: **Brand, Model Number, Serial Number, and MAC Address**.
- Automatically queries the BOQ catalog, matches the exact model, classifies the category, and opens the pre-filled registration card with **1-click instant provisioning**.

### 5. 🧠 AI Troubleshooting Assistant (RAG + pgvector)
- Context-aware RAG diagnostic assistant querying device parameters and technical manuals.
- When an engineer reports an issue (e.g. *"Crestron touch screen TSW-770 is offline"* or *"LPR barrier not opening"*), the engine:
  - Fetches the active device network state (IP, VLAN, switch name, switch port, rack unit).
  - Cross-references technical troubleshooting playbooks and PDF manuals.
  - Returns a structured diagnostic protocol:
    1. **Physical & PoE Layer 1** verification
    2. **Switch & VLAN Layer 2** configuration check
    3. **IP Routing Layer 3** conflict and ping checks
    4. **Application / Device-specific recovery** procedures
  - Formatted with a **Kurdish Engineering Brief (پوختەی کوردی)** and detailed technical steps.

### 6. 🛡️ Smart Placement Guardrails (Bilingual Kurdish / English Warnings)
- **Strict Physical & Logical Validation Rules**:
  - 🚫 **Indoor / Outdoor Zone Mismatch**: Indoor-rated equipment cannot be placed in outdoor zones.
  - 🚫 **Rack Unit Mismatch**: 19" rack-mounted units (Televes Avant, Crestron CP4N, Trinnov) cannot be placed outside the Server Rack zone.
  - 🚫 **Duplicate IP Detection**: Active IP addresses cannot conflict with another provisioned device in the project.
  - 🚫 **Duplicate Switch Port Collision**: Two devices cannot be assigned to the same physical switch port.
- When a violation occurs, a dedicated **Smart Guardrail Alert Modal** appears with dual-language explanations:
  - **Kurdish (کوردی سۆرانی)**:
    `[ئاگاداری شوێنی ئامێر]: ناتوانی ئامێری ناوماڵ لە نەخشەی دەرەوە دابنێیت!`
  - **English Technical**:
    `[Smart Guardrail Error]: Indoor-rated device cannot be placed in outdoor zone (Ingress/weather protection violation).`

### 7. ⚙️ Dynamic Category & Custom Field Builder
- Settings dashboard where administrators can:
  - Create unlimited new ELV categories and sub-categories.
  - Assign custom Lucide icons and badge colors.
  - Configure allowed installation zones (`indoor`, `outdoor`, `rack`, `safe_room`).
  - Add dynamic **JSON Schema fields** (e.g. `poe_standard`, `lux_rating`, `fiber_core_count`) without modifying code.

### 8. 🌐 Bilingual Interface (English & Central Kurdish Sorani)
- Instant language toggle in header (`English` | `کوردی`).
- All navigation tabs, dashboard KPIs, status badges, buttons, tooltips, and guardrail alerts are translated into Kurdish.
- Per user specification: **all form input fields, technical data values, IP addresses, and database fields remain in English**.

---

## 🗄️ Database Architecture (`database/schema.sql`)

The database is built on **Supabase PostgreSQL** with `pgvector`:

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Enums
CREATE TYPE installation_status AS ENUM ('Pending', 'Installed', 'Configured', 'Verified');
CREATE TYPE zone_type AS ENUM ('indoor', 'outdoor', 'rack', 'safe_room');

-- Tables
- project_settings (Villa metadata & VLAN defaults)
- categories (Dynamic ELV categories with allowed zones & custom schema)
- boq_models (Master catalog, photos, PDFs, rack specifications)
- floor_plans (Ground floor, 1st floor, Cinema, Server Room, Grounds)
- devices (Custom label ID, serial, MAC, IP, VLAN, switch, port, rack, coordinates)
- manual_embeddings (pgvector 768-dim embeddings for Gemini RAG)
- troubleshooting_logs (Audit history of AI diagnostic queries)

-- Triggers & Guardrail Functions
- check_device_placement_guardrail() (Enforces zone compatibility, rack unit rules, unique IP, unique switch ports)
- match_manual_sections() (HNSW cosine similarity search)
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js v18+ (Portable Node.js v20.18 is bundled in `tools/`)
- Modern web browser (Chrome, Edge, Safari, Firefox)

### Run the Unified Application

Double-click `start.bat` or run in terminal:

```bash
# Start unified server (Backend API + React Frontend)
npm start
```

The application will be accessible at:
👉 **`http://localhost:5000`**

### Running in Development Mode

```bash
# Terminal 1: Backend Express Server
cd server
npm start

# Terminal 2: Vite React Frontend (with Hot Reload)
cd client
npm run dev
```
Vite dev server runs at `http://localhost:3000` and proxies `/api` requests to `http://localhost:5000`.

---

## 🔑 Environment Variables (`server/.env`)

```env
PORT=5000
NODE_ENV=development

# Supabase Credentials (optional - application runs with rich pre-seeded Sitak Villa repository if omitted)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-key

# Google Gemini API Key (optional - intelligent heuristic analysis fallback active if omitted)
GEMINI_API_KEY=your-gemini-api-key
```

---

## 📂 Project Structure

```
├── database/
│   └── schema.sql                  # Complete Supabase PostgreSQL + pgvector schema & seeds
├── server/
│   ├── config/
│   │   └── supabase.js             # Supabase client initializer
│   ├── routes/
│   │   ├── boq.routes.js           # BOQ models CRUD & bulk device generator
│   │   ├── devices.routes.js       # Device provisioning & guardrail checks
│   │   ├── categories.routes.js    # Dynamic category & custom schema builder
│   │   ├── maps.routes.js          # Floor plans & coordinate positioning
│   │   └── ai.routes.js            # Gemini Vision OCR scanner & RAG troubleshooting
│   ├── services/
│   │   ├── gemini.service.js       # Gemini Vision & RAG troubleshooting engine
│   │   ├── guardrail.service.js    # Smart placement validation & bilingual alerts
│   │   └── mockData.js             # Sitak Villa seed catalog & devices
│   └── index.js                    # Express application entry point & static server
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx               # Header & language toggle (EN | کوردی)
│   │   │   ├── DashboardOverview.jsx    # Project metrics & 11 ELV category cards
│   │   │   ├── BOQManager.jsx           # Catalog manager & bulk provisioning modal
│   │   │   ├── DeviceProvisioning.jsx   # Individual hardware instances table & editor
│   │   │   ├── InteractiveMap.jsx       # Click-to-pin blueprint canvas & inspection drawer
│   │   │   ├── AiCameraScanner.jsx      # Gemini Vision sticker OCR auto-provisioner
│   │   │   ├── AiTroubleshooter.jsx     # RAG troubleshooting chat & diagnostic steps
│   │   │   ├── CategoryBuilder.jsx      # Dynamic category & JSON schema builder
│   │   │   └── GuardrailAlert.jsx       # Bilingual smart guardrail warning modal
│   │   ├── i18n/
│   │   │   └── translations.js          # Complete English and Kurdish dictionaries
│   │   ├── services/
│   │   │   └── api.js                   # Frontend API client
│   │   ├── App.jsx                      # Main application container
│   │   └── main.jsx                     # React entry point
│   └── vite.config.js                   # Vite configuration with /api proxy
├── start.bat                            # 1-click Windows startup script
├── package.json                         # Workspace root scripts
└── README.md                            # Comprehensive project documentation
```

---
*Created for Iraq Sitak Villa Project • Sulaymaniyah, Kurdistan Region of Iraq.*

