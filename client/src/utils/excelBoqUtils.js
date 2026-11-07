import * as XLSX from 'xlsx';
import { DEFAULT_ICT_IMAGE } from './defaultIctImage';

export { DEFAULT_ICT_IMAGE };

/**
 * Intelligent AI / Semantic Categorizer for ELV & ICT Systems
 * Analyzes item description, manufacturer brand, and model to deduce the exact category
 */
export function autoClassifyCategory(description = '', brand = '', model = '', existingCategories = []) {
  if (!existingCategories || existingCategories.length === 0) return null;

  const text = `${description} ${brand} ${model}`.toLowerCase();

  // Domain definitions with weighted matching keywords
  const rules = [
    {
      categoryKey: 'wireless access points & wi-fi',
      altKeys: ['wifi', 'wi-fi', 'access point', 'ap', 'وایفای', 'بێتەل'],
      keywords: [
        'wifi', 'wi-fi', 'access point', ' ap ', 'ap-', 'wlan', 'unifi', 'u7', 'u6',
        'u7-pro', 'u6-pro', 'u6-mesh', 'u6-plus', 'tri-band', 'dual-band', 'ssid',
        '802.11', 'wireless', 'poe access point', 'aruba ap', 'ruckus', 'eap',
      ],
    },
    {
      categoryKey: 'cctv & surveillance system',
      altKeys: ['cctv', 'surveillance', 'camera', 'کامێرای چاودێری', 'کامێرا'],
      keywords: [
        'camera', 'cctv', 'surveillance', 'dome', 'bullet', 'ptz', 'turret', 'nvr',
        'dvr', 'hikvision', 'dahua', 'axis', 'hanwha', 'uniview', 'megapixel', ' 4mp',
        ' 8mp', '4k camera', 'ir night', 'varifocal', 'wdr', 'fisheye', 'video recorder',
      ],
    },
    {
      categoryKey: 'server racks & structured cabling',
      altKeys: ['rack', 'switch', 'cabling', 'ڕاک', 'سێرڤەر', 'سوویچ'],
      keywords: [
        'switch', 'poe switch', 'rack', 'cabinet', 'patch panel', 'keystone', 'cat6',
        'cat6a', 'cat7', 'fiber', 'fiber optic', 'sfp', 'sfp+', 'pdu', 'router',
        'gateway', 'firewall', 'fortigate', 'server', 'mdf', 'idf', 'ethernet cable',
        'rj45', '48-port', '24-port', 'core switch',
      ],
    },
    {
      categoryKey: 'automation & av control',
      altKeys: ['automation', 'crestron', 'control', 'ئۆتۆمەیشن', 'کۆنترۆڵی زیرەک'],
      keywords: [
        'automation', 'crestron', 'control4', 'knx', 'smart home', 'processor',
        'controller', 'touchscreen', 'touch panel', 'ts-770', 'ts-1070', 'cp4', 'cp4n',
        'din-ap4', 'lutron', 'lighting control', 'dimmer', 'relay', 'dm-nvx', 'keypad',
      ],
    },
    {
      categoryKey: 'iptv headend & distribution',
      altKeys: ['iptv', 'televes', 'headend', 'تەلەفزیۆن', 'سەنتەری iptv'],
      keywords: [
        'iptv', 'headend', 'televes', 'avant', 'modulator', 'transcoder', 'multiswitch',
        'amplifier', 'coaxial', 'splitter', 'dvb', 'satellite', 'dish', 'lbf',
        'rf distribution', 'terrestrial',
      ],
    },
    {
      categoryKey: 'speakers & sound systems',
      altKeys: ['speaker', 'audio', 'sound', 'بڵندگۆ', 'دەنگ'],
      keywords: [
        'speaker', 'sound', 'audio', 'amplifier', 'subwoofer', 'ceiling speaker',
        'in-wall', 'sonance', 'sonos', 'bose', 'kef', 'bowers', 'wilkins', 'b&w',
        'soundbar', 'matrix amp', 'multi-room audio', 'dsp', 'power amp', 'qsc',
      ],
    },
    {
      categoryKey: 'intercom & video door stations',
      altKeys: ['intercom', 'door station', 'doorbell', 'ئینتەرکۆم', 'دەروازە'],
      keywords: [
        'intercom', 'door station', 'doorbell', 'door phone', 'akuvox', 'entry panel',
        'video intercom', 'indoor monitor', 'access control', 'card reader', 'rfid',
        'door strike', 'magnetic lock',
      ],
    },
    {
      categoryKey: 'tv & commercial displays',
      altKeys: ['tv', 'display', 'screen', 'شاشە', 'تەلەفزیۆن'],
      keywords: [
        'tv', 'display', 'television', 'oled', 'qled', 'commercial display', 'signage',
        'screen', 'monitor', 'bracket', 'wall mount', 'video wall',
      ],
    },
    {
      categoryKey: 'projectors & projection screens',
      altKeys: ['projector', 'cinema', 'سینەما', 'پەردەی سینەما'],
      keywords: [
        'projector', 'projection screen', 'epson', 'laser projector', 'lumens',
        'home cinema', 'motorized screen', 'alr screen',
      ],
    },
    {
      categoryKey: 'intrusion detection & perimeter alarm',
      altKeys: ['alarm', 'intrusion', 'هۆشداری', 'زەنگی دژەبڕین'],
      keywords: [
        'alarm', 'intrusion', 'motion detector', 'pir', 'siren', 'perimeter',
        'beam detector', 'door contact', 'glass break', 'ajax',
      ],
    },
    {
      categoryKey: 'ip telephony & pbx',
      altKeys: ['telephone', 'phone', 'voip', 'pbx', 'تەلەفۆن'],
      keywords: [
        'phone', 'ip phone', 'voip', 'pbx', 'sip', 'yealink', 'grandstream',
        'desk phone', 'telephony', 'conference phone',
      ],
    },
  ];

  let bestCategory = null;
  let highestScore = 0;

  for (const rule of rules) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        score += kw.length > 5 ? 3 : 1;
      }
    }

    if (score > highestScore) {
      const targetCat = existingCategories.find((c) => {
        const nameNorm = c.name.toLowerCase();
        const kuNorm = (c.name_ku || '').toLowerCase();
        return (
          nameNorm.includes(rule.categoryKey) ||
          rule.categoryKey.includes(nameNorm) ||
          rule.altKeys.some((ak) => nameNorm.includes(ak) || kuNorm.includes(ak))
        );
      });

      if (targetCat) {
        highestScore = score;
        bestCategory = targetCat;
      }
    }
  }

  return bestCategory || existingCategories[0] || null;
}

/**
 * Returns default ICT badge image for BOQ devices
 */
export function getDefaultDeviceImage(categoryName = '', brand = '') {
  // Always return the standard ICT placeholder image as requested
  return DEFAULT_ICT_IMAGE;
}

/**
 * Generates and downloads a clean, professional BOQ Excel Template
 * Note: Category column is omitted as requested — AI categorizes items from descriptions automatically!
 */
export function downloadBoqExcelTemplate(categories = []) {
  // Sample demonstration rows (without Category column!)
  const sampleData = [
    {
      Brand: 'Ubiquiti',
      Model: 'U7-Pro',
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
      Description: 'High-fidelity audio amplifier 125W/channel powering architectural multi-room speakers',
      Total_Qty: 6,
      Unit_Cost: 699.0,
      Placement_Zone: 'indoor',
      Is_Rack_Mounted: 'No',
      Rack_Unit_Size: 0,
      Product_Image_URL: '',
    },
    {
      Brand: 'Fortinet',
      Model: 'FortiGate-100F',
      Description: 'Enterprise Security Firewall & Core Gateway with redundant power supply',
      Total_Qty: 1,
      Unit_Cost: 3100.0,
      Placement_Zone: 'rack',
      Is_Rack_Mounted: 'Yes',
      Rack_Unit_Size: 1,
      Product_Image_URL: '',
    },
  ];

  const wb = XLSX.utils.book_new();

  // Sheet 1: BOQ Items (No Category Column needed!)
  const wsItems = XLSX.utils.json_to_sheet(sampleData, {
    header: [
      'Brand',
      'Model',
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
    { wch: 55 }, // Description
    { wch: 12 }, // Total_Qty
    { wch: 12 }, // Unit_Cost
    { wch: 16 }, // Placement_Zone
    { wch: 16 }, // Is_Rack_Mounted
    { wch: 15 }, // Rack_Unit_Size
    { wch: 25 }, // Product_Image_URL
  ];

  XLSX.utils.book_append_sheet(wb, wsItems, 'BOQ_Items');

  // Sheet 2: Guidelines & AI Categorization Note
  const guidelineRows = [
    {
      'Field': 'Brand',
      'Description': 'Equipment manufacturer brand name (e.g. Ubiquiti, Axis, Crestron, Televes)',
      'Required': 'Yes',
    },
    {
      'Field': 'Model',
      'Description': 'Hardware model number or item code (e.g. U7-Pro, P3245-LVE, CP4N)',
      'Required': 'Yes',
    },
    {
      'Field': 'Description',
      'Description': 'Detailed item description. Antigravity AI uses this description to automatically detect and assign the exact ELV category (Wi-Fi, CCTV, Racks, Sound, etc.)!',
      'Required': 'Recommended',
    },
    {
      'Field': 'Total_Qty',
      'Description': 'Total bill-of-quantities count for this site',
      'Required': 'Yes',
    },
    {
      'Field': 'Unit_Cost',
      'Description': 'Hardware unit price in USD ($)',
      'Required': 'Optional',
    },
    {
      'Field': 'Placement_Zone',
      'Description': 'indoor, outdoor, rack, safe_room',
      'Required': 'Optional',
    },
    {
      'Field': 'Is_Rack_Mounted',
      'Description': 'Yes or No',
      'Required': 'Optional',
    },
    {
      'Field': 'Rack_Unit_Size',
      'Description': 'Number of rack units occupied (e.g. 1, 2, 4)',
      'Required': 'Optional',
    },
  ];

  const wsGuide = XLSX.utils.json_to_sheet(guidelineRows);
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 70 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Template_Guide');

  // Trigger browser download
  XLSX.writeFile(wb, 'BOQ_Template_Sitak_Villa.xlsx');
}

/**
 * Parses an uploaded Excel file (.xlsx, .xls, .csv) into validated BOQ models
 * Intelligently classifies categories from item descriptions and sets default ICT image
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
          const isRack =
            String(normalized.israckmounted || normalized.rackmounted || normalized.rack || '').toLowerCase().includes('y') ||
            String(normalized.israckmounted || normalized.rackmounted || normalized.rack || '') === '1' ||
            String(normalized.israckmounted || normalized.rackmounted || normalized.rack || '') === 'true';

          const rackSize = parseInt(normalized.rackunitsize || normalized.rackunit || normalized.u || 0, 10) || (isRack ? 1 : 0);

          let imageUrl = String(normalized.productimageurl || normalized.imageurl || normalized.image || '').trim();
          if (!imageUrl) {
            // Assign standard modern ICT image as requested
            imageUrl = DEFAULT_ICT_IMAGE;
          }

          // Category matching:
          // 1. If Category column existed and has a value, try to match it
          let matchedCategory = null;
          if (categoryStr) {
            matchedCategory = existingCategories.find(
              (c) =>
                c.name.toLowerCase() === categoryStr.toLowerCase() ||
                (c.name_ku && c.name_ku.toLowerCase() === categoryStr.toLowerCase()) ||
                c.name.toLowerCase().includes(categoryStr.toLowerCase())
            );
          }

          // 2. If no category provided or not matched, Antigravity AI automatically detects category from description, brand, and model!
          if (!matchedCategory) {
            matchedCategory = autoClassifyCategory(description, brand, model, existingCategories);
          }

          parsedItems.push({
            id: `import-${index}-${Date.now()}`,
            brand: brand || 'Generic',
            model: model || `MOD-${index + 1}`,
            category_id: matchedCategory?.id || existingCategories[0]?.id || '',
            category_name: matchedCategory ? matchedCategory.name : 'ELV System',
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
