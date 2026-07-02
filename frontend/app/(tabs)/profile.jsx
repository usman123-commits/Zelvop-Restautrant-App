import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Camera, ChevronRight, LogOut } from 'lucide-react-native';
import { logout, updateProfileThunk } from '../../src/store/authSlice';
import * as api from '../../src/services/api';
import { Colors } from '../../src/constants/colors';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [isOnline, setIsOnline] = useState(user?.isOnline || false);
  const [toggling, setToggling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editPhone, setEditPhone] = useState(user?.contactNumber || '');

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

  const handleEdit = () => {
    setEditName(user?.name || '');
    setEditEmail(user?.email || '');
    setEditPhone(user?.contactNumber || '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      await dispatch(updateProfileThunk({
        name: editName.trim(),
        email: editEmail.trim(),
        contactNumber: editPhone.trim(),
      })).unwrap();
      setEditing(false);
    } catch (err) {
      Alert.alert('Error', err || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'June 2026';

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      {/* Profile Header */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.cameraIcon}>
            <Camera size={14} color={Colors.gray500} />
          </View>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {user?.contactNumber && (
          <Text style={styles.phone}>{user.contactNumber}</Text>
        )}
      </View>

      {/* Account Details Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Account Details</Text>
          {editing ? (
            <View style={styles.editActions}>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text style={styles.editLink}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={handleEdit}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {editing ? (
          <>
            <View style={styles.editRow}>
              <Text style={styles.detailLabel}>Name</Text>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.editRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <TextInput
                style={styles.editInput}
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.editRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <TextInput
                style={styles.editInput}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder="Add phone number"
                placeholderTextColor={Colors.gray400}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.detailValue}>{user?.name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{user?.email}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{user?.contactNumber || '--'}</Text>
            </View>
          </>
        )}
      </View>

      {/* Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Availability</Text>
          <View style={styles.statusRight}>
            <Text style={[
              styles.statusText,
              { color: isOnline ? Colors.green : Colors.gray400 },
            ]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              disabled={toggling}
              trackColor={{ false: Colors.gray200, true: Colors.green }}
              thumbColor={Colors.white}
            />
          </View>
        </View>
        <View style={styles.memberRow}>
          <Text style={styles.statusLabel}>Member since</Text>
          <Text style={styles.memberDate}>{memberSince}</Text>
        </View>
      </View>

      {/* App Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>App Info</Text>
        <View style={styles.infoRow}>
          <Text style={styles.statusLabel}>App Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        <TouchableOpacity style={styles.infoRow}>
          <Text style={styles.statusLabel}>Terms of Service</Text>
          <ChevronRight size={16} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.infoRow}>
          <Text style={styles.statusLabel}>Privacy Policy</Text>
          <ChevronRight size={16} color={Colors.primary} />
        </TouchableOpacity>
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
    backgroundColor: Colors.white,
    alignItems: 'center',
    paddingVertical: 24,
    paddingTop: 16,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.white,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.gray100,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.gray800,
  },
  email: {
    fontSize: 14,
    color: Colors.gray500,
    marginTop: 2,
  },
  phone: {
    fontSize: 13,
    color: Colors.gray400,
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 16,
    paddingHorizontal: 20,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gray800,
    marginBottom: 14,
  },
  editLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  cancelLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray500,
  },
  editActions: {
    flexDirection: 'row',
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.gray500,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.gray800,
  },
  editRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  editInput: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.gray800,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  statusLabel: {
    fontSize: 14,
    color: Colors.gray800,
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  memberDate: {
    fontSize: 13,
    color: Colors.gray500,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  infoValue: {
    fontSize: 13,
    color: Colors.gray500,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.red,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.red,
  },
});
