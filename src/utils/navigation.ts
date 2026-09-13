import * as Linking from 'expo-linking';
import { Platform, Alert } from 'react-native';

/**
 * Opens navigation directly to a UK Postcode or address using native Maps.
 * On iOS: defaults to Apple Maps (https://maps.apple.com/?daddr={postcode})
 * On Android / Fallback: Google Maps
 */
export async function openMapsRoute(postcodeOrAddress: string, destinationName?: string): Promise<boolean> {
  if (!postcodeOrAddress) {
    Alert.alert('Address Missing', 'No postcode or address available for navigation.');
    return false;
  }

  const encodedDestination = encodeURIComponent(postcodeOrAddress.trim());
  
  // iOS Apple Maps URL format
  const appleMapsUrl = `https://maps.apple.com/?daddr=${encodedDestination}&dirflg=d`;
  // Google Maps URL format
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`;
  // Waze URL format
  const wazeUrl = `https://waze.com/ul?q=${encodedDestination}&navigate=yes`;

  const targetUrl = Platform.OS === 'ios' ? appleMapsUrl : googleMapsUrl;

  try {
    const canOpen = await Linking.canOpenURL(targetUrl);
    if (canOpen) {
      await Linking.openURL(targetUrl);
      return true;
    } else {
      await Linking.openURL(googleMapsUrl);
      return true;
    }
  } catch (err) {
    console.warn('Error opening maps URL:', err);
    try {
      await Linking.openURL(googleMapsUrl);
      return true;
    } catch (e) {
      Alert.alert('Navigation Error', 'Could not open map application.');
      return false;
    }
  }
}
