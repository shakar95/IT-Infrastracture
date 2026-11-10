import {
  Camera,
  Wifi,
  Server,
  Network,
  Tv,
  Monitor,
  Volume2,
  Film,
  Key,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Bell,
  PhoneCall,
  Zap,
  HardDrive,
  Radio,
  Sliders,
  Video,
  Flame,
  Eye,
  Cpu,
  Layers,
  Router,
  Plug,
} from 'lucide-react';

export const ICT_ICON_MAP = {
  Camera,
  Wifi,
  Server,
  Network,
  Tv,
  Monitor,
  Volume2,
  Film,
  Key,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Bell,
  PhoneCall,
  Zap,
  HardDrive,
  Radio,
  Sliders,
  Video,
  Flame,
  Eye,
  Cpu,
  Layers,
  Plug,
};

/**
 * Intelligent ICT / ELV Icon Resolver
 * Inspects device custom labels, BOQ model specifications, and category definitions
 * to return the exact specialized icon for CCTV, Wi-Fi, Switches, Servers, Audio, etc.
 */
export function getIctDeviceIcon(dev = {}, boqModel = null, category = null) {
  // 1. If explicit category icon_name matches an ICT icon
  if (category?.icon_name && ICT_ICON_MAP[category.icon_name]) {
    return ICT_ICON_MAP[category.icon_name];
  }

  // 2. Synthesize all textual identifiers for heuristic matching
  const corpus = [
    dev?.custom_label_id,
    dev?.brand,
    dev?.model,
    dev?.notes,
    dev?.category_name,
    boqModel?.brand,
    boqModel?.model,
    boqModel?.description,
    category?.name,
    category?.name_ku,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // CCTV / Video Surveillance / Thermal Cameras
  if (
    corpus.includes('camera') ||
    corpus.includes('cctv') ||
    corpus.includes('ptz') ||
    corpus.includes('dome') ||
    corpus.includes('bullet') ||
    corpus.includes('cam') ||
    corpus.includes('surveillance') ||
    corpus.includes('hikvision') ||
    corpus.includes('dahua') ||
    corpus.includes('axis') ||
    corpus.includes('hanwha') ||
    corpus.includes('thermal') ||
    corpus.includes('nvr channel')
  ) {
    return Camera;
  }

  // Sockets / Data Outlets / Faceplates
  if (
    corpus.includes('socket') ||
    corpus.includes('outlet') ||
    corpus.includes('faceplate') ||
    corpus.includes('keystone') ||
    corpus.includes('سۆکێت') ||
    corpus.includes('plug')
  ) {
    return Plug;
  }

  // Wi-Fi Access Points / Outdoor Mesh / Wireless APs
  if (
    corpus.includes('wifi') ||
    corpus.includes('wi-fi') ||
    corpus.includes('access point') ||
    corpus.includes('ap-') ||
    corpus.includes('ap ') ||
    corpus.includes('wax6') ||
    corpus.includes('unifi') ||
    corpus.includes('u6-') ||
    corpus.includes('aruba') ||
    corpus.includes('ruckus') ||
    corpus.includes('meraki') ||
    corpus.includes('wireless') ||
    corpus.includes('beacon')
  ) {
    return Wifi;
  }

  // Network Switch / Router / Firewall / Gateway / Patch Panel
  if (
    corpus.includes('switch') ||
    corpus.includes('router') ||
    corpus.includes('firewall') ||
    corpus.includes('fortigate') ||
    corpus.includes('fortinet') ||
    corpus.includes('netgear') ||
    corpus.includes('cisco') ||
    corpus.includes('catalyst') ||
    corpus.includes('mikrotik') ||
    corpus.includes('gateway') ||
    corpus.includes('poe') ||
    corpus.includes('ethernet') ||
    corpus.includes('sw-') ||
    corpus.includes('sw ')
  ) {
    return Network;
  }

  // Main Servers / Data Storage / NAS / NVR Recorders
  if (
    corpus.includes('server') ||
    corpus.includes('nvr') ||
    corpus.includes('nas') ||
    corpus.includes('synology') ||
    corpus.includes('storage') ||
    corpus.includes('supermicro') ||
    corpus.includes('proliant') ||
    corpus.includes('poweredge') ||
    corpus.includes('harddrive')
  ) {
    return Server;
  }

  // Audio / In-Ceiling Speakers / Subwoofers / Amplifiers / PA System
  if (
    corpus.includes('speaker') ||
    corpus.includes('audio') ||
    corpus.includes('sound') ||
    corpus.includes('subwoofer') ||
    corpus.includes('sonance') ||
    corpus.includes('sonos') ||
    corpus.includes('amplifier') ||
    corpus.includes('amp') ||
    corpus.includes('bose') ||
    corpus.includes('jbl') ||
    corpus.includes('spk-') ||
    corpus.includes('pa system')
  ) {
    return Volume2;
  }

  // Television / IPTV Displays / Video Walls / 4K Monitors / Projectors
  if (
    corpus.includes('tv') ||
    corpus.includes('television') ||
    corpus.includes('monitor') ||
    corpus.includes('display') ||
    corpus.includes('screen') ||
    corpus.includes('projector') ||
    corpus.includes('oled') ||
    corpus.includes('qled') ||
    corpus.includes('samsung') ||
    corpus.includes('lg')
  ) {
    return Tv;
  }

  // Private Cinema / Dedicated Home Theater / Film Processors
  if (
    corpus.includes('cinema') ||
    corpus.includes('theater') ||
    corpus.includes('theatre') ||
    corpus.includes('surround') ||
    corpus.includes('film') ||
    corpus.includes('dolby') ||
    corpus.includes('atmos')
  ) {
    return Film;
  }

  // IP Intercom / SIP Door Phone / Video Doorbell / PBX
  if (
    corpus.includes('intercom') ||
    corpus.includes('doorbell') ||
    corpus.includes('doorphone') ||
    corpus.includes('sip') ||
    corpus.includes('phone') ||
    corpus.includes('pbx') ||
    corpus.includes('voip') ||
    corpus.includes('grandstream') ||
    corpus.includes('fanvil') ||
    corpus.includes('2n')
  ) {
    return PhoneCall;
  }

  // Access Control / Biometric / RFID / Maglock / Smart Lock / Turnstile
  if (
    corpus.includes('access') ||
    corpus.includes('lock') ||
    corpus.includes('maglock') ||
    corpus.includes('keypad') ||
    corpus.includes('biometric') ||
    corpus.includes('rfid') ||
    corpus.includes('reader') ||
    corpus.includes('turnstile')
  ) {
    return Key;
  }

  // LPR / Automatic Number Plate Recognition / Vehicle Gate Barriers
  if (
    corpus.includes('lpr') ||
    corpus.includes('anpr') ||
    corpus.includes('barrier') ||
    corpus.includes('gate') ||
    corpus.includes('vehicle') ||
    corpus.includes('boom barrier')
  ) {
    return ShieldCheck;
  }

  // Security Alarms / Motion Sensors (PIR) / Sirens / Smoke Detectors
  if (
    corpus.includes('alarm') ||
    corpus.includes('siren') ||
    corpus.includes('pir') ||
    corpus.includes('motion') ||
    corpus.includes('intrusion') ||
    corpus.includes('sensor') ||
    corpus.includes('detector') ||
    corpus.includes('smoke') ||
    corpus.includes('fire')
  ) {
    return Bell;
  }

  // Power / UPS Battery Backup / PDU
  if (
    corpus.includes('ups') ||
    corpus.includes('power') ||
    corpus.includes('battery') ||
    corpus.includes('pdu') ||
    corpus.includes('apc') ||
    corpus.includes('inverter')
  ) {
    return Zap;
  }

  // Smart Home Automation / Crestron Controllers / Processors
  if (
    corpus.includes('automation') ||
    corpus.includes('crestron') ||
    corpus.includes('control4') ||
    corpus.includes('knx') ||
    corpus.includes('lutron') ||
    corpus.includes('processor') ||
    corpus.includes('controller')
  ) {
    return Cpu;
  }

  // Fallback icon for generic infrastructure item
  return Layers;
}

