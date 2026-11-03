import * as XLSX from 'xlsx';

// Category-specific high-resolution default hardware images
export const DEFAULT_CATEGORY_IMAGES = {
  // Wi-Fi / AP
  'wireless access points & wi-fi': 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
  'نۆدی وایفای و پەیوەندی بێتەل': 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
  'wifi': 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
  'ap': 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',

  // CCTV / Surveillance
  'cctv & surveillance system': 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600',
  'سیستەمی کامێرای چاودێری': 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600',
  'cctv': 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600',
  'camera': 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600',

  // Server Racks & Switches
  'server racks & structured cabling': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600',
  'ڕاکەکانی سێرڤەر و کێبڵی پێکهاتەیی': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600',
  'rack': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600',
  'switch': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600',

  // Automation & Control (Crestron / Smart Home)
  'automation & av control': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600',
  'ئۆتۆمەیشن و کۆنترۆڵی زیرەک': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600',
  'automation': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600',
  'crestron': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600',

  // IPTV Headend & Distribution
  'iptv headend & distribution': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600',
  'سەنتەری iptv سەرەکی': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600',
  'iptv': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600',
  'televes': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600',

  // Speakers & Audio
  'speakers & sound systems': 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600',
  'بڵندگۆ و سیستەمی دەنگ': 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600',
  'audio': 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600',
  'speakers': 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600',

  // Intercom & Video Door Stations
  'intercom & video door stations': 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600',
  'ئینتەرکۆم و زەنگی بینراو': 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600',
  'intercom': 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600',

  // TV & Commercial Displays
  'tv & commercial displays': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600',
  'تەلەفزیۆن و شاشەکان': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600',
  'tv': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600',
  'display': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600',

  // Projectors & Home Cinema
  'projectors & projection screens': 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600',
  'پرۆجێکتەر و پەردەی سینەما': 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600',
  'home cinema & reference audio': 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600',
  'سینەمای ماڵەوە و دەنگی های-ئێند': 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600',

  // Intrusion & Alarm
  'intrusion detection & perimeter alarm': 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600',
  'سیستەمی هۆشداری و زەنگی دژەبڕین': 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600',
  'alarm': 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600',

  // IP Telephony & PBX
  'ip telephony & pbx': 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=600',
  'تەلەفۆن و پەیوەندی ناوخۆیی': 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=600',

  // Default Fallback
  default: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
};

// Helper to find default image based on category name or brand
export function getDefaultDeviceImage(categoryName = '', brand = '') {
  const normCat = (categoryName || '').toLowerCase().trim();
  const normBrand = (brand || '').toLowerCase().trim();

  // Check exact category matches
  for (const [key, url] of Object.entries(DEFAULT_CATEGORY_IMAGES)) {
    if (normCat.includes(key) || key.includes(normCat)) {
      return url;
    }
  }

  // Check brand keywords
  if (normBrand.includes('ubiquiti') || normBrand.includes('unifi')) {
    return DEFAULT_CATEGORY_IMAGES['wireless access points & wi-fi'];
  }
  if (normBrand.includes('crestron')) {
    return DEFAULT_CATEGORY_IMAGES['automation & av control'];
  }
  if (normBrand.includes('televes')) {
    return DEFAULT_CATEGORY_IMAGES['iptv headend & distribution'];
  }
  if (normBrand.includes('axis') || normBrand.includes('hikvision') || normBrand.includes('dahua')) {
    return DEFAULT_CATEGORY_IMAGES['cctv & surveillance system'];
  }
  if (normBrand.includes('cisco') || normBrand.includes('aruba') || normBrand.includes('dell')) {
    return DEFAULT_CATEGORY_IMAGES['server racks & structured cabling'];
  }
  if (normBrand.includes('sonos') || normBrand.includes('bose') || normBrand.includes('kef')) {
    return DEFAULT_CATEGORY_IMAGES['speakers & sound systems'];
  }

  return DEFAULT_CATEGORY_IMAGES.default;
}

/**
 * Generates and downloads a clean, professional BOQ Excel Template
 */
export function downloadBoqExcelTemplate(categories = []) {
  // Sample demonstration rows
  const sampleData = [
    {
      Brand: 'Ubiquiti',
      Model: 'U7-Pro',
      Category: 'Wireless Access Points & Wi-Fi',
      Description: 'Tri-Band Wi-Fi 7 Ceiling Access Point with 2.5GbE PoE uplink',
      Total_Qty: 14,
      Unit_Cost: 189.0,
      Placement_Zone: 'indoor',
      Is_Rack_Mounted: 'No',
      Rack_Unit_Size: 0,
      Product_Image_URL: '',
    },
    {
      Brand: 'Crestron',
      Model: 'CP4N',
      Category: 'Automation & AV Control',
      Description: '4-Series Automation Control System with dedicated isolated Control Subnet',
      Total_Qty: 1,
      Unit_Cost: 2450.0,
      Placement_Zone: 'rack',
      Is_Rack_Mounted: 'Yes',
      Rack_Unit_Size: 1,
      Product_Image_URL: '',
    },
    {
      Brand: 'Televes',
      Model: 'Avant X Pro',
      Category: 'IPTV Headend & Distribution',
      Description: 'Multi-band programmable terrestrial amplifier with 32 digital filters and auto-gain',
      Total_Qty: 2,
      Unit_Cost: 480.0,
      Placement_Zone: 'rack',
      Is_Rack_Mounted: 'Yes',
      Rack_Unit_Size: 1,
      Product_Image_URL: '',
    },
    {
      Brand: 'Axis',
      Model: 'P3245-LVE',
      Category: 'CCTV & Surveillance System',
      Description: 'Outdoor vandal-resistant HDTV 1080p fixed dome camera with Forensic WDR',
      Total_Qty: 18,
      Unit_Cost: 420.0,
      Placement_Zone: 'outdoor',
      Is_Rack_Mounted: 'No',
      Rack_Unit_Size: 0,
      Product_Image_URL: '',
    },
    {
      Brand: 'Sonos',
      Model: 'Amp',
      Category: 'Speakers & Sound Systems',
      Description: 'High-fidelity audio amplifier 125W/channel powering architectural multi-room speakers',
      Total_Qty: 6,
      Unit_Cost: 699.0,
      Placement_Zone: 'indoor',
      Is_Rack_Mounted: 'No',
      Rack_Unit_Size: 0,
      Product_Image_URL: '',
    },
  ];

  const wb = XLSX.utils.book_new();

  // Sheet 1: BOQ Items
  const wsItems = XLSX.utils.json_to_sheet(sampleData, {
    header: [
      'Brand',
      'Model',
      'Category',
      'Description',
      'Total_Qty',
      'Unit_Cost',
      'Placement_Zone',
      'Is_Rack_Mounted',
      'Rack_Unit_Size',
      'Product_Image_URL',
    ],
  });

  // Set column widths
  wsItems['!cols'] = [
    { wch: 16 }, // Brand
    { wch: 18 }, // Model
    { wch: 32 }, // Category
    { wch: 45 }, // Description
    { wch: 12 }, // Total_Qty
    { wch: 12 }, // Unit_Cost
    { wch: 16 }, // Placement_Zone
    { wch: 16 }, // Is_Rack_Mounted
    { wch: 15 }, // Rack_Unit_Size
    { wch: 25 }, // Product_Image_URL
  ];

  XLSX.utils.book_append_sheet(wb, wsItems, 'BOQ_Items');

  // Sheet 2: Guidelines & Available Categories
  const categoryRows = (categories.length > 0 ? categories : [
    { name: 'Wireless Access Points & Wi-Fi', name_ku: 'نۆدی وایفای و پەیوەندی بێتەل' },
    { name: 'CCTV & Surveillance System', name_ku: 'سیستەمی کامێرای چاودێری' },
    { name: 'Automation & AV Control', name_ku: 'ئۆتۆمەیشن و کۆنترۆڵی زیرەک' },
    { name: 'Server Racks & Structured Cabling', name_ku: 'ڕاکەکانی سێرڤەر و کێبڵی پێکهاتەیی' },
    { name: 'IPTV Headend & Distribution', name_ku: 'سەنتەری IPTV سەرەکی' },
    { name: 'Speakers & Sound Systems', name_ku: 'بڵندگۆ و سیستەمی دەنگ' },
    { name: 'Intercom & Video Door Stations', name_ku: 'ئینتەرکۆم و زەنگی بینراو' },
    { name: 'TV & Commercial Displays', name_ku: 'تەلەفزیۆن و شاشەکان' },
    { name: 'IP Telephony & PBX', name_ku: 'تەلەفۆن و پەیوەندی ناوخۆیی' },
    { name: 'Intrusion Detection & Perimeter Alarm', name_ku: 'سیستەمی هۆشداری و زەنگی دژەبڕین' },
    { name: 'Projectors & Projection Screens', name_ku: 'پرۆجێکتەر و پەردەی سینەما' },
  ]).map((c) => ({
    'Category Name (English)': c.name,
    'ناوی بەش (Kurdish)': c.name_ku || '',
    'Allowed Placement Zones': 'indoor, outdoor, rack, safe_room',
  }));

  const wsGuide = XLSX.utils.json_to_sheet(categoryRows);
  wsGuide['!cols'] = [{ wch: 36 }, { wch: 36 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Categories_Reference');

  // Trigger browser download
  XLSX.writeFile(wb, 'BOQ_Template_Sitak_Villa.xlsx');
}

/**
 * Parses an uploaded Excel file (.xlsx, .xls, .csv) into validated BOQ models
 */
export async function parseBoqExcelFile(file, existingCategories = []) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected'));

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
          throw new Error('Excel sheet is empty');
        }

        // Convert to JSON
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          throw new Error('No data rows found in Excel sheet');
        }

        const parsedItems = [];

        rawRows.forEach((row, index) => {
          // Normalize column headers
          const normalized = {};
          for (const key of Object.keys(row)) {
            const cleanKey = key.trim().toLowerCase().replace(/[\s_-]+/g, '');
            normalized[cleanKey] = row[key];
          }

          const brand = String(normalized.brand || normalized.make || normalized.manufacturer || '').trim();
          const model = String(normalized.model || normalized.modelnumber || normalized.partnumber || normalized.item || '').trim();

          // Skip completely empty rows
          if (!brand && !model) return;

          const categoryStr = String(normalized.category || normalized.discipline || normalized.categoryname || '').trim();
          const description = String(normalized.description || normalized.desc || normalized.specification || '').trim();
          const qty = Math.max(1, parseInt(normalized.totalqty || normalized.qty || normalized.quantity || 1, 10));
          const unitCost = parseFloat(normalized.unitcost || normalized.cost || normalized.price || 0) || 0;

          const zoneStr = String(normalized.placementzone || normalized.zone || 'indoor').toLowerCase().trim();
          const isRack = String(normalized.israckmounted || normalized.rackmounted || normalized.rack || '').toLowerCase().includes('y') ||
            String(normalized.israckmounted || normalized.rackmounted || normalized.rack || '') === '1' ||
            String(normalized.israckmounted || normalized.rackmounted || normalized.rack || '') === 'true';

          const rackSize = parseInt(normalized.rackunitsize || normalized.rackunit || normalized.u || 0, 10) || (isRack ? 1 : 0);

          let imageUrl = String(normalized.productimageurl || normalized.imageurl || normalized.image || '').trim();
          if (!imageUrl) {
            // Assign category-specific high-resolution default image
            imageUrl = getDefaultDeviceImage(categoryStr, brand);
          }

          // Match category ID
          let matchedCategory = existingCategories.find(
            (c) =>
              c.name.toLowerCase() === categoryStr.toLowerCase() ||
              (c.name_ku && c.name_ku.toLowerCase() === categoryStr.toLowerCase())
          );

          if (!matchedCategory && existingCategories.length > 0) {
            // Fuzzy match or fallback to first category
            matchedCategory =
              existingCategories.find(
                (c) =>
                  categoryStr &&
                  (c.name.toLowerCase().includes(categoryStr.toLowerCase()) ||
                    categoryStr.toLowerCase().includes(c.name.toLowerCase()))
              ) || existingCategories[0];
          }

          parsedItems.push({
            id: `import-${index}-${Date.now()}`,
            brand: brand || 'Generic',
            model: model || `MOD-${index + 1}`,
            category_id: matchedCategory?.id || existingCategories[0]?.id || '',
            category_name: matchedCategory ? matchedCategory.name : (categoryStr || 'ELV System'),
            category_name_ku: matchedCategory ? matchedCategory.name_ku : '',
            description,
            total_qty: qty,
            unit_cost: unitCost,
            placement_zone: ['indoor', 'outdoor', 'rack', 'safe_room'].includes(zoneStr) ? zoneStr : 'indoor',
            allowed_zones: [zoneStr || 'indoor'],
            is_rack_mounted: isRack,
            rack_unit_size: rackSize,
            product_image_url: imageUrl,
          });
        });

        resolve(parsedItems);
      } catch (err) {
        reject(err);
      }
    };

    reader.readAsArrayBuffer(file);
  });
}
