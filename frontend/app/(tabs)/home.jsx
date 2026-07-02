import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import {
  Bell,
  MapPin,
  ChevronRight,
  Package,
} from 'lucide-react-native';
import { fetchOrders } from '../../src/store/ordersSlice';
import * as api from '../../src/services/api';
import { Colors, StatusColors } from '../../src/constants/colors';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { items, loading } = useSelector((state) => state.orders);

  const [isOnline, setIsOnline] = useState(user?.isOnline || false);
  const [toggling, setToggling] = useState(false);
  const [stats, setStats] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const activeOrders = items.filter(
    (o) => !['delivered', 'cancelled'].includes(o.status)
  );
  const activeOrder = activeOrders.find(
    (o) => o.status === 'accepted' || o.status === 'picked_up'
  );
  const recentOrders = items
    .filter((o) => o.status === 'delivered')
    .sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt))
    .slice(0, 3);

  const loadData = useCallback(() => {
    dispatch(fetchOrders());
    api.getRiderStats().then(setStats).catch(() => {});
    api.getNotifications(1, 0).then((d) => setUnreadCount(d.unreadCount)).catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const firstName = user?.name?.split(' ')[0] || 'Rider';
  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning,';
    if (h < 17) return 'Good afternoon,';
    return 'Good evening,';
  };

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

  const timeAgo = (date) => {
    if (!date) return '';
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const activeStatus = activeOrder
    ? StatusColors[activeOrder.status]
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} colors={[Colors.primary]} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingLabel}>{getGreeting()}</Text>
            <Text style={styles.greetingName}>{firstName}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.bellContainer}
              onPress={() => router.push('/(tabs)/notifications')}
            >
              <Bell size={20} color={Colors.gray800} />
              {unreadCount > 0 && <View style={styles.bellDot} />}
            </TouchableOpacity>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{initials}</Text>
            </View>
          </View>
        </View>

        {/* Online Toggle Bar */}
        <View style={[
          styles.toggleBar,
          isOnline ? styles.toggleBarOnline : styles.toggleBarOffline,
        ]}>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            disabled={toggling}
            trackColor={{ false: Colors.gray300, true: Colors.green }}
            thumbColor={Colors.white}
            style={{ transform: [{ scale: 0.9 }] }}
          />
          <Text style={[
            styles.toggleText,
            isOnline ? styles.toggleTextOnline : styles.toggleTextOffline,
          ]}>
            {isOnline ? 'Online -- Accepting orders' : 'Offline -- Not accepting orders'}
          </Text>
          {isOnline && <View style={styles.toggleDot} />}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statStripe, { backgroundColor: Colors.primary }]} />
            <Text style={styles.statLabel}>Today's Deliveries</Text>
            <Text style={styles.statValue}>{stats?.todayDeliveries ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statStripe, { backgroundColor: Colors.green }]} />
            <Text style={styles.statLabel}>Active Order</Text>
            <Text style={styles.statValue}>
              {activeOrders.length > 0 ? `${activeOrders.length} active` : 'None'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statStripe, { backgroundColor: Colors.gray400 }]} />
            <Text style={styles.statLabel}>Earnings Today</Text>
            <Text style={[styles.statValue, { color: Colors.gray300 }]}>Rs. --</Text>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Coming soon</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statStripe, { backgroundColor: Colors.yellow }]} />
            <Text style={styles.statLabel}>Acceptance Rate</Text>
            <Text style={styles.statValue}>{stats?.acceptanceRate ?? 100}%</Text>
          </View>
        </View>

        {/* Active Delivery Banner */}
        {activeOrder && (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={() => router.push(`/order/${activeOrder._id}`)}
            activeOpacity={0.7}
          >
            <View style={styles.activeBannerStripe} />
            <View style={styles.activeBannerHeader}>
              <View style={styles.activeBannerLeft}>
                <View style={styles.activeDot} />
                <Text style={styles.activeBannerTitle}>ACTIVE DELIVERY</Text>
              </View>
              {activeStatus && (
                <View style={[styles.activeBadge, { backgroundColor: activeStatus.bg }]}>
                  <Text style={[styles.activeBadgeText, { color: activeStatus.text }]}>
                    {activeStatus.label}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.activeBannerOrder}>
              {activeOrder.orderId} -- {activeOrder.customerName}
            </Text>
            <View style={styles.activeBannerAddress}>
              <MapPin size={14} color={Colors.gray500} />
              <Text style={styles.activeBannerAddressText} numberOfLines={1}>
                {activeOrder.deliveryAddress}
              </Text>
            </View>
            <View style={styles.viewDetailsBtn}>
              <Text style={styles.viewDetailsBtnText}>View Details</Text>
              <ChevronRight size={16} color={Colors.white} />
            </View>
          </TouchableOpacity>
        )}

        {/* Recent Section */}
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>Recent</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {recentOrders.length === 0 ? (
          <View style={styles.emptyRecent}>
            <Package size={32} color={Colors.gray300} />
            <Text style={styles.emptyRecentText}>No recent deliveries</Text>
          </View>
        ) : (
          recentOrders.map((order) => (
            <TouchableOpacity
              key={order._id}
              style={styles.recentCard}
              onPress={() => router.push(`/order/${order._id}`)}
              activeOpacity={0.7}
            >
              <View>
                <Text style={styles.recentOrderId}>{order.orderId}</Text>
                <Text style={styles.recentCustomer}>{order.customerName}</Text>
              </View>
              <View style={styles.recentRight}>
                <View style={[styles.recentBadge, { backgroundColor: Colors.greenLight }]}>
                  <Text style={[styles.recentBadgeText, { color: Colors.greenDark }]}>Delivered</Text>
                </View>
                <Text style={styles.recentTime}>{timeAgo(order.deliveredAt)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    backgroundColor: Colors.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  greetingLabel: {
    fontSize: 14,
    color: Colors.gray500,
    fontWeight: '500',
  },
  greetingName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.gray800,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.red,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  toggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toggleBarOnline: {
    backgroundColor: '#ECFDF5',
  },
  toggleBarOffline: {
    backgroundColor: Colors.gray100,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  toggleTextOnline: {
    color: Colors.greenDark,
  },
  toggleTextOffline: {
    color: Colors.gray500,
  },
  toggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.green,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray100,
    overflow: 'hidden',
  },
  statStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '200%',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.gray500,
    fontWeight: '500',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.gray800,
  },
  comingSoonBadge: {
    marginTop: 4,
    backgroundColor: Colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.gray400,
  },
  activeBanner: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    overflow: 'hidden',
  },
  activeBannerStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 5,
    height: '200%',
    backgroundColor: Colors.primary,
  },
  activeBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  activeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  activeBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activeBannerOrder: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray800,
  },
  activeBannerAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  activeBannerAddressText: {
    fontSize: 13,
    color: Colors.gray500,
    flex: 1,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  viewDetailsBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.gray800,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  recentCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  recentOrderId: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray800,
  },
  recentCustomer: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
  },
  recentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  recentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  recentTime: {
    fontSize: 12,
    color: Colors.gray400,
  },
  emptyRecent: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyRecentText: {
    fontSize: 14,
    color: Colors.gray400,
    marginTop: 8,
  },
});
