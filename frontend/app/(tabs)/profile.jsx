import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { LogOut, User, Phone, Mail, Wifi, WifiOff } from 'lucide-react-native';
import { logout } from '../../src/store/authSlice';
import * as api from '../../src/services/api';
import { Colors } from '../../src/constants/colors';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [isOnline, setIsOnline] = useState(user?.isOnline || false);
  const [toggling, setToggling] = useState(false);

  const handleToggleOnline = async (value) => {
    setToggling(true);
    try {
      await api.updateOnlineStatus(value);
      setIsOnline(value);
    } catch {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => dispatch(logout()),
      },
    ]);
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.role}>{user?.role === 'rider' ? 'Delivery Rider' : 'Owner'}</Text>
      </View>

      {/* Online Toggle */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardRowLeft}>
            {isOnline ? (
              <Wifi size={20} color={Colors.green} />
            ) : (
              <WifiOff size={20} color={Colors.gray400} />
            )}
            <View>
              <Text style={styles.cardRowTitle}>Online Status</Text>
              <Text style={styles.cardRowSubtitle}>
                {isOnline ? 'You are available for orders' : 'You are offline'}
              </Text>
            </View>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            disabled={toggling}
            trackColor={{ false: Colors.gray200, true: Colors.primaryLight }}
            thumbColor={isOnline ? Colors.primary : Colors.gray400}
          />
        </View>
      </View>

      {/* Info */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardRowLeft}>
            <Mail size={20} color={Colors.gray500} />
            <View>
              <Text style={styles.cardRowTitle}>Email</Text>
              <Text style={styles.cardRowSubtitle}>{user?.email}</Text>
            </View>
          </View>
        </View>
        {user?.contactNumber && (
          <View style={[styles.cardRow, styles.cardRowBorder]}>
            <View style={styles.cardRowLeft}>
              <Phone size={20} color={Colors.gray500} />
              <View>
                <Text style={styles.cardRowTitle}>Phone</Text>
                <Text style={styles.cardRowSubtitle}>{user.contactNumber}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <LogOut size={18} color={Colors.red} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.white,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray900,
  },
  role: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  cardRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray800,
  },
  cardRowSubtitle: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.redLight,
    backgroundColor: Colors.white,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.red,
  },
});
