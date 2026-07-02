import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Package,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Bell,
} from 'lucide-react-native';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../src/services/api';
import { Colors } from '../../src/constants/colors';

const ICON_CONFIG = {
  new_order: { icon: Package, bg: '#EFF6FF', color: '#3B82F6' },
  delivery_completed: { icon: CheckCircle, bg: '#ECFDF5', color: '#10B981' },
  order_cancelled: { icon: XCircle, bg: '#FEF2F2', color: '#EF4444' },
  timeout_decline: { icon: AlertTriangle, bg: '#FEF3C7', color: '#F59E0B' },
  stale_warning: { icon: AlertTriangle, bg: '#FEF3C7', color: '#F59E0B' },
  online_status: { icon: AlertTriangle, bg: '#FEF3C7', color: '#F59E0B' },
  order_reassigned: { icon: Package, bg: '#EFF6FF', color: '#3B82F6' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NotificationItem({ item, onPress }) {
  const config = ICON_CONFIG[item.type] || ICON_CONFIG.new_order;
  const Icon = config.icon;
  const unread = !item.read;

  return (
    <TouchableOpacity style={styles.notifRow} onPress={() => onPress(item)}>
      {unread && <View style={styles.unreadDot} />}
      <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
        <Icon size={18} color={config.color} />
      </View>
      <View style={styles.notifContent}>
        <Text style={[styles.notifTitle, unread && styles.notifTitleBold]}>
          {item.title}
        </Text>
        <Text style={styles.notifBody}>{item.body}</Text>
        <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getNotifications(100, 0);
      setNotifications(data.notifications);
    } catch (err) {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handlePress = async (notif) => {
    if (!notif.read) {
      try {
        await markNotificationRead(notif._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, read: true } : n))
        );
      } catch (err) {
        // silently fail
      }
    }
    if (notif.orderId) {
      router.push(`/order/${notif.orderId}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      // silently fail
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <NotificationItem item={item} onPress={handlePress} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Bell size={48} color={Colors.gray300} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.gray900,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  notifRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    left: -8,
    top: '50%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.gray900,
  },
  notifTitleBold: {
    fontWeight: '700',
  },
  notifBody: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
  },
  notifTime: {
    fontSize: 12,
    color: Colors.gray400,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.gray400,
  },
});
