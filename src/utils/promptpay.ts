/**
 * Thai PromptPay EMVCo QR Code Payload Generator
 * Fully offline, standards compliant (EMVCo Tag-Length-Value + CRC-16/CCITT-FALSE).
 */

function formatTag(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    crc ^= code << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generatePromptPayPayload(target: string, amount?: number): string {
  // Normalize target: remove hyphens, spaces
  const cleanTarget = target.replace(/[^0-9]/g, '');

  let recipientTag = '';
  if (cleanTarget.length === 10) {
    // Mobile number: international format e.g. 0812345678 -> 0066812345678 (13 digits)
    const formattedMobile = '0066' + cleanTarget.substring(1);
    recipientTag = formatTag('01', formattedMobile);
  } else if (cleanTarget.length === 13) {
    // National ID or Tax ID (13 digits)
    recipientTag = formatTag('02', cleanTarget);
  } else if (cleanTarget.length === 15) {
    // E-Wallet ID (15 digits)
    recipientTag = formatTag('03', cleanTarget);
  } else {
    // Default fallback to tag 01
    recipientTag = formatTag('01', cleanTarget.padStart(13, '0'));
  }

  // Merchant Account Information: PromptPay AID = A000000677010111
  const aidTag = formatTag('00', 'A000000677010111');
  const merchantAccountInfo = formatTag('29', `${aidTag}${recipientTag}`);

  // Point of Initiation Method: 11 for static (no amount), 12 for dynamic (has amount)
  const isDynamic = typeof amount === 'number' && amount > 0;
  const pointOfInitiation = formatTag('01', isDynamic ? '12' : '11');

  // Payload format indicator
  const payloadFormat = formatTag('00', '01');

  // Country code: TH
  const countryCode = formatTag('58', 'TH');

  // Currency: 764 (THB)
  const currency = formatTag('53', '764');

  let payload = `${payloadFormat}${pointOfInitiation}${merchantAccountInfo}${countryCode}${currency}`;

  if (isDynamic) {
    const formattedAmount = amount.toFixed(2);
    payload += formatTag('54', formattedAmount);
  }

  // Checksum tag setup (Tag 63 length 04)
  const checksumPrefix = '6304';
  const fullPayloadBeforeCrc = `${payload}${checksumPrefix}`;
  const checksum = crc16(fullPayloadBeforeCrc);

  return `${fullPayloadBeforeCrc}${checksum}`;
}
