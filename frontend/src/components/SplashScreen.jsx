import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>Z</Text>
      </View>
      <Text style={styles.appName}>Zelvop</Text>
      <Text style={styles.tagline}>Deliver with speed</Text>
      <View style={styles.loadingBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: Colors.white,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  appName: {
    marginTop: 16,
    fontSize: 32,
    fontWeight: '800',
    color: Colors.gray800,
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 6,
    fontSize: 15,
    color: Colors.gray500,
    fontWeight: '500',
  },
  loadingBar: {
    marginTop: 40,
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    opacity: 0.6,
  },
});
