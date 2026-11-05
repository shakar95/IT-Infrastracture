-- =====================================================================
-- IRAQ SITAK VILLA PROJECT - IT & ELV INFRASTRUCTURE MANAGEMENT
-- Comprehensive Supabase PostgreSQL Database Schema with pgvector
-- =====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. CUSTOM TYPES / ENUMS
DO $$ BEGIN
    CREATE TYPE installation_status AS ENUM ('Pending', 'Installed', 'Configured', 'Verified');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE zone_type AS ENUM ('indoor', 'outdoor', 'rack', 'safe_room');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROJECT SETTINGS TABLE
CREATE TABLE IF NOT EXISTS project_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_name TEXT NOT NULL DEFAULT 'Iraq Sitak Villa Project',
    location TEXT NOT NULL DEFAULT 'Sitak, Sulaymaniyah, Kurdistan Region of Iraq',
    client_name TEXT DEFAULT 'VIP Villa Estate',
    network_defaults JSONB DEFAULT '{
        "management_subnet": "192.168.10.0/24",
        "cctv_subnet": "192.168.20.0/24",
        "wifi_subnet": "192.168.30.0/24",
        "av_subnet": "192.168.40.0/24",
        "guest_subnet": "192.168.50.0/24",
        "dns_primary": "1.1.1.1",
        "gateway_default": "192.168.10.1"
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DYNAMIC CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    name_ku TEXT NOT NULL,
    description TEXT,
    icon_name TEXT DEFAULT 'Layers',
    color_code TEXT DEFAULT '#3B82F6',
    allowed_zones zone_type[] DEFAULT ARRAY['indoor'::zone_type],
    custom_schema JSONB DEFAULT '[]'::jsonb, -- Array of field definitions: [{ "key": "poe_w", "label": "PoE Wattage", "type": "number" }]
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BOQ MODELS CATALOG TABLE
CREATE TABLE IF NOT EXISTS boq_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id TEXT DEFAULT 'proj-sitak',
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    description TEXT,
    total_qty INTEGER NOT NULL DEFAULT 1 CHECK (total_qty >= 0),
    unit_cost NUMERIC(12,2) DEFAULT 0.00,
    product_image_url TEXT,
    manual_pdf_url TEXT,
    allowed_zones zone_type[] DEFAULT ARRAY['indoor'::zone_type],
    is_rack_mounted BOOLEAN DEFAULT FALSE,
    rack_unit_size INTEGER DEFAULT 0, -- e.g. 1U, 2U, 4U
    custom_specs JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(brand, model)
);

-- 6. FLOOR PLANS / TOPOLOGY MAPS TABLE
CREATE TABLE IF NOT EXISTS floor_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id TEXT DEFAULT 'proj-sitak',
    name TEXT NOT NULL,
    name_ku TEXT NOT NULL,
    zone_type zone_type NOT NULL DEFAULT 'indoor',
    floor_level INTEGER DEFAULT 0, -- -1 for basement, 0 for ground, 1 for 1st floor, etc.
    image_url TEXT NOT NULL,
    scale_meters_per_pixel FLOAT DEFAULT 0.05,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. INDIVIDUAL PROVISIONED DEVICES TABLE
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id TEXT DEFAULT 'proj-sitak',
    boq_model_id UUID NOT NULL REFERENCES boq_models(id) ON DELETE RESTRICT,
    custom_label_id TEXT NOT NULL UNIQUE, -- e.g. AP-GF-01, CCTV-GATE-01, CRESTRON-CINEMA-01
    serial_number TEXT UNIQUE,
    mac_address TEXT,
    ip_address INET,
    subnet_mask INET DEFAULT '255.255.255.0',
    gateway INET DEFAULT '192.168.10.1',
    vlan_id INTEGER DEFAULT 10,
    switch_name TEXT, -- e.g. SW-CORE-01, SW-EDGE-POOL-01
    switch_port TEXT, -- e.g. Port 14, Gi1/0/24
    rack_name TEXT, -- e.g. Server Rack 01 (42U)
    rack_unit TEXT, -- e.g. U14-U16
    placement_zone zone_type NOT NULL DEFAULT 'indoor',
    floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE SET NULL,
    pos_x FLOAT, -- Percentage or pixels on floor plan (0 to 100 or coordinate)
    pos_y FLOAT,
    installation_status installation_status DEFAULT 'Pending',
    config_backup_url TEXT,
    notes TEXT,
    custom_field_values JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. MANUAL EMBEDDINGS TABLE (FOR PGVECTOR RAG TROUBLESHOOTING)
CREATE TABLE IF NOT EXISTS manual_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    boq_model_id UUID REFERENCES boq_models(id) ON DELETE CASCADE,
    section_title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768), -- Dimension for Gemini text-embedding-004
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS manual_embeddings_hnsw_idx 
ON manual_embeddings USING hnsw (embedding vector_cosine_ops);

-- 9. AI TROUBLESHOOTING LOGS
CREATE TABLE IF NOT EXISTS troubleshooting_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    user_query TEXT NOT NULL,
    retrieved_context TEXT,
    ai_response TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 10. SMART PLACEMENT GUARDRAIL FUNCTIONS & TRIGGERS
-- =====================================================================

-- Guardrail 1: Enforce that device placement matches Floor Plan zone type
CREATE OR REPLACE FUNCTION check_device_placement_guardrail()
RETURNS TRIGGER AS $$
DECLARE
    fp_zone zone_type;
    model_is_rack BOOLEAN;
    model_allowed_zones zone_type[];
BEGIN
    -- Fetch BOQ Model constraints
    SELECT is_rack_mounted, allowed_zones INTO model_is_rack, model_allowed_zones
    FROM boq_models WHERE id = NEW.boq_model_id;

    -- Validate Rack Mounted requirement
    IF model_is_rack IS TRUE AND NEW.placement_zone != 'rack' THEN
        RAISE EXCEPTION '[Guardrail Error / هەڵەی شوێن]: Rack-mounted device cannot be placed outside a Server Rack zone! (ئەم ئامێرە مۆدی ڕاکە و پێویستە تەنها لە ڕاکدا دابنرێت)';
    END IF;

    -- Validate Floor Plan Zone (Informational: specifies physical location, does not block)
    IF NEW.floor_plan_id IS NOT NULL AND NEW.placement_zone IS NULL THEN
        SELECT zone_type INTO fp_zone FROM floor_plans WHERE id = NEW.floor_plan_id;
        IF fp_zone IS NOT NULL THEN
            NEW.placement_zone := fp_zone;
        END IF;
    END IF;

    -- Guardrail 2: Prevent Duplicate Active IP Address (if IP is specified)
    IF NEW.ip_address IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM devices 
            WHERE ip_address = NEW.ip_address 
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) THEN
            RAISE EXCEPTION '[IP Conflict / دژایەتی ئایپی]: IP Address % is already assigned to another device! (ئەم ئایپییە پێشتر بەکارهاتووە)', NEW.ip_address;
        END IF;
    END IF;

    -- Guardrail 3: Prevent Duplicate Switch Port on same switch
    IF NEW.switch_name IS NOT NULL AND NEW.switch_port IS NOT NULL AND NEW.switch_port != '' THEN
        IF EXISTS (
            SELECT 1 FROM devices 
            WHERE switch_name = NEW.switch_name 
              AND switch_port = NEW.switch_port 
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) THEN
            RAISE EXCEPTION '[Port Conflict / دژایەتی پۆرت]: Switch % Port % is already connected to another device! (ئەم پۆرتەی سویچ پێشتر پرکراوەتەوە)', 
                NEW.switch_name, NEW.switch_port;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_device_guardrail ON devices;
CREATE TRIGGER trg_device_guardrail
BEFORE INSERT OR UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION check_device_placement_guardrail();

-- =====================================================================
-- 11. PGVECTOR RAG SIMILARITY SEARCH FUNCTION
-- =====================================================================
CREATE OR REPLACE FUNCTION match_manual_sections(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.65,
    match_count INT DEFAULT 5,
    filter_model_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    boq_model_id UUID,
    section_title TEXT,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.boq_model_id,
        m.section_title,
        m.content,
        1 - (m.embedding <=> query_embedding) AS similarity
    FROM manual_embeddings m
    WHERE (filter_model_id IS NULL OR m.boq_model_id = filter_model_id)
      AND (1 - (m.embedding <=> query_embedding)) > match_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =====================================================================
-- 12. STORAGE BUCKETS SETUP (Supabase Storage)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('equipment-images', 'equipment-images', true),
    ('equipment-manuals', 'equipment-manuals', true),
    ('floor-plans', 'floor-plans', true),
    ('config-backups', 'config-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Public read access policies for images, manuals, and floor plans (idempotent)
DROP POLICY IF EXISTS "Public Read Access for Equipment Images" ON storage.objects;
CREATE POLICY "Public Read Access for Equipment Images" 
ON storage.objects FOR SELECT USING (bucket_id = 'equipment-images');

DROP POLICY IF EXISTS "Public Read Access for Equipment Manuals" ON storage.objects;
CREATE POLICY "Public Read Access for Equipment Manuals" 
ON storage.objects FOR SELECT USING (bucket_id = 'equipment-manuals');

DROP POLICY IF EXISTS "Public Read Access for Floor Plans" ON storage.objects;
CREATE POLICY "Public Read Access for Floor Plans" 
ON storage.objects FOR SELECT USING (bucket_id = 'floor-plans');

-- =====================================================================
-- 13. SEED DATA - IRAQ SITAK VILLA PROJECT
-- =====================================================================

-- Project Settings
INSERT INTO project_settings (project_name, location, client_name)
VALUES ('Iraq Sitak Villa Project', 'Sitak Luxury Mountain Estate, Sulaymaniyah, KRI', 'Sitak Villa Residence');

-- Categories (The 11 Core ELV categories requested)
INSERT INTO categories (id, name, name_ku, description, icon_name, color_code, allowed_zones, custom_schema) VALUES
('11111111-0000-0000-0000-000000000001', 'IPTV Headend', 'سەنتەری پەخشی تەلەڤزیۆن IPTV', 'Headend satellite modulators, DVB-S2 decoders, multicast streamers', 'Tv', '#8B5CF6', ARRAY['rack'::zone_type], '[{"key":"output_channels","label":"Output Multicast Channels","type":"number"},{"key":"input_sat_polarities","label":"Satellite Inputs","type":"text"}]'::jsonb),
('11111111-0000-0000-0000-000000000002', 'Automation & AV', 'سیستەمی کۆنترۆڵ و هۆشمەندسازی AV', 'Crestron central processors, touch panels, lighting gateways, shade controllers', 'Cpu', '#3B82F6', ARRAY['indoor'::zone_type, 'rack'::zone_type], '[{"key":"bus_type","label":"Control Bus (Cresnet/Ethernet)","type":"text"},{"key":"poe_class","label":"PoE Class","type":"text"}]'::jsonb),
('11111111-0000-0000-0000-000000000003', 'Speakers', 'بڵندگۆ و سیستەمی دەنگ', 'High-end architectural in-ceiling, landscape rock speakers, active subwoofers', 'Volume2', '#EC4899', ARRAY['indoor'::zone_type, 'outdoor'::zone_type], '[{"key":"impedance_ohms","label":"Impedance (Ohms / 70V)","type":"text"},{"key":"rms_wattage","label":"RMS Power Handling (W)","type":"number"}]'::jsonb),
('11111111-0000-0000-0000-000000000004', 'TV & Projectors', 'تەلەڤزیۆن و پرۆجێکتەرەکان', 'Ultra HD displays, laser projectors, motorized drop screens', 'Monitor', '#06B6D4', ARRAY['indoor'::zone_type, 'outdoor'::zone_type], '[{"key":"screen_size","label":"Screen Size (inches)","type":"number"},{"key":"resolution","label":"Native Resolution","type":"text"}]'::jsonb),
('11111111-0000-0000-0000-000000000005', 'Home Cinema', 'سینەمای ماڵەوەی تایبەت', 'Reference cinema audio processors, multi-channel power amplifiers, acoustic processors', 'Film', '#F59E0B', ARRAY['indoor'::zone_type, 'rack'::zone_type], '[{"key":"surround_channels","label":"Channel Configuration (e.g. 9.4.6)","type":"text"},{"key":"calibration_eq","label":"Acoustic EQ Engine","type":"text"}]'::jsonb),
('11111111-0000-0000-0000-000000000006', 'Wi-Fi', 'سیستەمی وایفای و پەیوەندی', 'Enterprise Wi-Fi 7 / Wi-Fi 6 access points, outdoor mesh beacons', 'Wifi', '#10B981', ARRAY['indoor'::zone_type, 'outdoor'::zone_type], '[{"key":"wifi_standard","label":"Wi-Fi Standard (Wi-Fi 6E/7)","type":"text"},{"key":"mimo_streams","label":"MIMO Spatial Streams","type":"text"}]'::jsonb),
('11111111-0000-0000-0000-000000000007', 'CCTV', 'کامێرای چاودێری ئاسایش', '4K AI PTZ, perimeter bullet cameras, thermal boundary detectors', 'Camera', '#EF4444', ARRAY['indoor'::zone_type, 'outdoor'::zone_type], '[{"key":"resolution_mp","label":"Resolution (Megapixels)","type":"number"},{"key":"ir_distance_m","label":"Night Vision IR Range (m)","type":"number"}]'::jsonb),
('11111111-0000-0000-0000-000000000008', 'LPR', 'خوێنەرەوەی تابلۆی ئۆتۆمبێل LPR', 'License plate recognition cameras, automatic vehicle gate barriers, loop detectors', 'ShieldCheck', '#84CC16', ARRAY['outdoor'::zone_type], '[{"key":"capture_speed_kmh","label":"Max Capture Speed (km/h)","type":"number"},{"key":"wiegand_output","label":"Wiegand / Relay Channels","type":"text"}]'::jsonb),
('11111111-0000-0000-0000-000000000009', 'Access Control', 'کۆنترۆڵی دەروازە و چوونەژوورەوە', 'Biometric facial recognition terminals, RFID keypads, high-security maglocks', 'Key', '#6366F1', ARRAY['indoor'::zone_type, 'outdoor'::zone_type, 'safe_room'::zone_type], '[{"key":"auth_methods","label":"Authentication (Face, Finger, PIN)","type":"text"},{"key":"door_relay_type","label":"Relay Contact Type","type":"text"}]'::jsonb),
('11111111-0000-0000-0000-000000000010', 'Intrusion Alarm', 'سیستەمی هۆشداری و زەنگی ئاگادارکردنەوە', 'Security control panels, dual-tech PIR, acoustic glass break detectors, outdoor laser curtains', 'Bell', '#D97706', ARRAY['indoor'::zone_type, 'outdoor'::zone_type, 'safe_room'::zone_type], '[{"key":"zones_count","label":"Total Hardware Zones","type":"number"},{"key":"backup_battery_ah","label":"Battery Capacity (Ah)","type":"number"}]'::jsonb),
('11111111-0000-0000-0000-000000000011', 'IP PBX/Intercom', 'سیستەمی پەیوەندی و ئینتەرکۆم IP', 'Villa master video intercom, SIP outdoor station, indoor monitors, IP PBX appliance', 'PhoneCall', '#14B8A6', ARRAY['indoor'::zone_type, 'outdoor'::zone_type, 'rack'::zone_type], '[{"key":"sip_accounts","label":"SIP Extensions Registered","type":"number"},{"key":"display_size","label":"Touchscreen Size","type":"text"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- BOQ Catalog Models
INSERT INTO boq_models (id, category_id, brand, model, description, total_qty, unit_cost, product_image_url, manual_pdf_url, allowed_zones, is_rack_mounted, rack_unit_size, custom_specs) VALUES
('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Televes', 'Avant X Pro', 'Programmable satellite and terrestrial amplifier headend with 32 digital filters and IP streaming module', 2, 1450.00, 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600', 'https://manuals.televes.com/avant-x.pdf', ARRAY['rack'::zone_type], TRUE, 1, '{"output_channels": 32, "input_sat_polarities": "4x SAT IF + 4x DVB-T2"}'::jsonb),
('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'Crestron', 'CP4N', '4-Series Automation Control System with dedicated isolated Subnet port for AV devices', 3, 2900.00, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600', 'https://manuals.crestron.com/cp4n.pdf', ARRAY['rack'::zone_type], TRUE, 1, '{"bus_type": "Cresnet + 2x GigE Subnet", "poe_class": "PoE+ Input"}'::jsonb),
('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000002', 'Crestron', 'TSW-770-B-S', '7-inch Wall Mount Touch Screen for smart lighting, climate, shades, and audio zone management', 12, 1150.00, 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600', 'https://manuals.crestron.com/tsw-770.pdf', ARRAY['indoor'::zone_type], FALSE, 0, '{"bus_type": "Ethernet PoE", "poe_class": "802.3af Class 3"}'::jsonb),
('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000006', 'Ubiquiti UniFi', 'U7-Pro', 'Ceiling Mount Wi-Fi 7 Tri-Band Access Point with 2.5 GbE uplink port and 6 GHz spectrum support', 18, 240.00, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600', 'https://dl.ui.com/ds/u7-pro-ds.pdf', ARRAY['indoor'::zone_type], FALSE, 0, '{"wifi_standard": "Wi-Fi 7 (802.11be)", "mimo_streams": "2x2 6GHz + 2x2 5GHz + 2x2 2.4GHz"}'::jsonb),
('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000006', 'Ubiquiti UniFi', 'U6-Mesh-Pro', 'Outdoor IP67 High-Capacity Wi-Fi 6 Access Point for Villa Gardens and Infinity Pool deck', 6, 280.00, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600', 'https://dl.ui.com/ds/u6-mesh-pro.pdf', ARRAY['outdoor'::zone_type], FALSE, 0, '{"wifi_standard": "Wi-Fi 6 (802.11ax)", "mimo_streams": "4x4 MIMO high gain"}'::jsonb),
('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000007', 'Hikvision', 'DS-2CD2087G2-LU', '8MP 4K ColorVu Fixed Bullet Network Camera with 24/7 Full Color and AcuSense Human/Vehicle Detection', 24, 210.00, 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600', 'https://www.hikvision.com/manuals/colorvu-8mp.pdf', ARRAY['indoor'::zone_type, 'outdoor'::zone_type], FALSE, 0, '{"resolution_mp": 8, "ir_distance_m": 40}'::jsonb),
('22222222-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000008', 'Hikvision', 'iDS-2CD7A46G0/P-IZHS', '4MP DeepinView ANPR / LPR Ultra-Low Light Bullet Camera with Integrated Automatic Vehicle Barrier Relay', 2, 890.00, 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600', 'https://www.hikvision.com/manuals/lpr-deepinview.pdf', ARRAY['outdoor'::zone_type], FALSE, 0, '{"capture_speed_kmh": 120, "wiegand_output": "1x Wiegand + 2x Alarm Out Relays"}'::jsonb),
('22222222-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000011', 'Akuvox', 'R29C', 'High-End Smart Video Intercom with 7-Inch IPS Screen, Dual Camera Facial Recognition & Keypad', 2, 1200.00, 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600', 'https://akuvox.com/manuals/r29c.pdf', ARRAY['outdoor'::zone_type], FALSE, 0, '{"sip_accounts": 2, "display_size": "7-inch capacitive IPS"}'::jsonb)
ON CONFLICT (brand, model) DO NOTHING;

-- Floor Plans for Sitak Villa
INSERT INTO floor_plans (id, name, name_ku, zone_type, floor_level, image_url, scale_meters_per_pixel) VALUES
('33333333-0000-0000-0000-000000000001', 'Ground Floor Main Living & Terraces', 'نهۆمی زەمینی - هۆڵی میوان و تەراسەکان', 'indoor', 0, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200', 0.05),
('33333333-0000-0000-0000-000000000002', 'First Floor Bedrooms & Master Suites', 'نهۆمی یەکەم - ژوورەکانی نوستن و ماستەر سوییت', 'indoor', 1, 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200', 0.05),
('33333333-0000-0000-0000-000000000003', 'Basement, Spa & Private Cinema', 'نهۆمی ژێرزەمین - سپا و سینەمای تایبەت', 'indoor', -1, 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200', 0.05),
('33333333-0000-0000-0000-000000000004', 'Main Server Room - 42U Rack Elevations', 'ژووری سێرڤەری سەرەکی - ڕاکەکانی کۆنتڕۆڵ', 'rack', 0, 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200', 0.02),
('33333333-0000-0000-0000-000000000005', 'Villa Estate Grounds & Perimeter Gates', 'حەوشەی ڤێلا، باخچە و دەروازەی سەرەکی', 'outdoor', 0, 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200', 0.1)
ON CONFLICT (id) DO NOTHING;

-- Initial Provisioned Devices for Iraq Sitak Villa
INSERT INTO devices (id, boq_model_id, custom_label_id, serial_number, mac_address, ip_address, vlan_id, switch_name, switch_port, rack_name, rack_unit, placement_zone, floor_plan_id, pos_x, pos_y, installation_status, notes) VALUES
('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'TV-HEADEND-01', 'TL-AVX-994821', '00:1E:C2:55:01:A1', '192.168.10.20', 10, 'SW-CORE-RACK-48P', 'Port 1', 'Main 42U Rack A', 'U41-U42', 'rack', '33333333-0000-0000-0000-000000000004', 35.0, 20.0, 'Configured', 'Multicast stream configured on 239.255.1.1 - 1.32'),
('44444444-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'CRESTRON-CP4N-01', 'CR-CP4-883910', '00:10:7F:48:B3:01', '192.168.10.15', 10, 'SW-CORE-RACK-48P', 'Port 2', 'Main 42U Rack A', 'U38-U39', 'rack', '33333333-0000-0000-0000-000000000004', 50.0, 25.0, 'Verified', 'Master processor with lighting SIMPL Windows program active'),
('44444444-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000003', 'TSW-GF-LIVING', 'CR-TSW-772911', '00:10:7F:B8:21:44', '192.168.40.10', 40, 'SW-EDGE-GF-24P', 'Port 8', NULL, NULL, 'indoor', '33333333-0000-0000-0000-000000000001', 45.0, 52.0, 'Verified', 'Near main marble foyer entrance'),
('44444444-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000004', 'AP-GF-01', 'UI-U7P-992182', '74:83:C2:10:4E:55', '192.168.30.11', 30, 'SW-EDGE-GF-24P', 'Port 14', NULL, NULL, 'indoor', '33333333-0000-0000-0000-000000000001', 32.5, 40.0, 'Configured', 'Ground floor central living hall ceiling mount'),
('44444444-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000005', 'AP-OUT-POOL-01', 'UI-U6M-881239', '74:83:C2:59:DF:11', '192.168.30.25', 30, 'SW-EDGE-GARDEN-16P', 'Port 4', NULL, NULL, 'outdoor', '33333333-0000-0000-0000-000000000005', 68.0, 75.0, 'Installed', 'Pergola pole near Sitak mountain view infinity pool'),
('44444444-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000007', 'LPR-MAIN-GATE', 'HK-LPR-449102', '4C:BD:8F:22:98:C1', '192.168.20.50', 20, 'SW-EDGE-GATE-8P', 'Port 3', NULL, NULL, 'outdoor', '33333333-0000-0000-0000-000000000005', 20.0, 85.0, 'Pending', 'Connected to hydraulic automatic gate barrier relay')
ON CONFLICT (custom_label_id) DO NOTHING;

-- Initial RAG manual knowledge for Troubleshooting Assistant
INSERT INTO manual_embeddings (boq_model_id, section_title, content) VALUES
('22222222-0000-0000-0000-000000000003', 'Crestron TSW-770 Offline Troubleshooting Guide', 
'Step 1: Check physical PoE LED on the back panel of TSW-770. If off, verify RJ-45 termination on Switch Port 8 (SW-EDGE-GF-24P) and ensure PoE IEEE 802.3af is enabled.
Step 2: Ping device IP 192.168.40.10 from management VLAN. If no reply, check VLAN 40 tag on the switch port.
Step 3: Open browser to https://192.168.40.10 and check Crestron Toolbox IP table. Ensure IP ID (default 03) matches CP4N central controller configuration at 192.168.10.15.
Step 4: If touchscreen display is unresponsive, perform hard reboot by holding reset pinhole for 15 seconds.'),

('22222222-0000-0000-0000-000000000007', 'Hikvision LPR Gate Barrier Not Opening Diagnostic Protocol',
'Step 1: Check LPR camera web interface at http://192.168.20.50 under Configuration > Road Traffic > Plate Recognition. Verify camera trigger mode is set to "License Plate Recognition" and capture area box covers the incoming Sitak driveway.
Step 2: Inspect Alarm Output 1 Relay terminals wired to the automatic barrier board. Test relay output manually using the "Manual Trigger Relay" button in the camera web UI.
Step 3: Check Allowlist database: Ensure the vehicle plate number is registered with "Valid" status and not expired.
Step 4: Verify Wiegand/Relay pulse duration: Should be set between 500ms to 1000ms for barrier activation.')
ON CONFLICT DO NOTHING;

