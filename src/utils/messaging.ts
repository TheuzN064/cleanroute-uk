import * as Linking from 'expo-linking';
import { InvoiceDetails, buildWhatsAppInvoiceMessage } from './invoiceFormat';

export { InvoiceDetails, buildWhatsAppInvoiceMessage };

/**
 * Dispatches the generated invoice directly to WhatsApp.
 * Cleans phone numbers (e.g., standard UK 07xxx to 447xxx) and encodes the text.
 */
export async function sendWhatsAppInvoice(details: InvoiceDetails): Promise<boolean> {
  const text = buildWhatsAppInvoiceMessage(details);
  const encodedText = encodeURIComponent(text);

  let phone = details.clientPhone ? details.clientPhone.replace(/[^0-9+]/g, '') : '';
  
  // Format UK local numbers: 07xxx -> 447xxx
  if (phone.startsWith('0')) {
    phone = '44' + phone.substring(1);
  } else if (phone.startsWith('+')) {
    phone = phone.substring(1);
  }

  const nativeUrl = phone
    ? `whatsapp://send?phone=${phone}&text=${encodedText}`
    : `whatsapp://send?text=${encodedText}`;

  const webUrl = phone
    ? `https://wa.me/${phone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  try {
    const canOpen = await Linking.canOpenURL(nativeUrl);
    if (canOpen) {
      await Linking.openURL(nativeUrl);
      return true;
    } else {
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (error) {
    console.warn('Failed to open native WhatsApp URL, attempting web fallback:', error);
    try {
      await Linking.openURL(webUrl);
      return true;
    } catch (fallbackError) {
      console.error('Could not open WhatsApp:', fallbackError);
      return false;
    }
  }
}
