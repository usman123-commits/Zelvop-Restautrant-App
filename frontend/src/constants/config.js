// Backend API base URL
// Android emulator uses 10.0.2.2 to reach host localhost
// Physical device: use your computer's local IP
// iOS simulator: localhost works

import { Platform } from 'react-native';

const getApiUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5000/api/v1';
    }
    return 'http://localhost:5000/api/v1';
  }
  return 'https://your-production-url.com/api/v1';
};

export const API_URL = getApiUrl();
export const ACCEPT_TIMEOUT_MS = 3 * 60 * 1000;
