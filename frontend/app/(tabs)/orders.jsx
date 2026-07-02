import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import {
  User as UserIcon,
  Phone,
  MapPin,
  Package as PackageIcon,
} from 'lucide-react-native';
import { fetchOrders, acceptOrderThunk, declineOrderThunk } from '../../src/store/ordersSlice';
import { Colors, StatusColors } from '../../src/constants/colors';

const FILTERS = [
  { key: 'active', label: 'Active', statuses: ['accepted', 'picked_up'] },
  { key: 'new', label: 'New', statuses: ['assigned'] },
  { key: 'completed', label: 'Completed', statuses: ['delivered'] },
  { key: 'all', label: 'All', statuses: null },
];

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector((state) => state.orders);
  const [filter, setFilter] = useState('active');

  const loadOrders = useCallback(() => {
    dispatch(fetchOrders());
  }, [dispatch]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filtered = items.filter((o) => {
    const f = FILTERS.find((fl) => fl.key === filter);
    if (!f || !f.statuses) return true;
    return f.statuses.includes(o.status);
  });

  const handleAccept = (id) => {
    dispatch(acceptOrderThunk(id));
  };

  const handleDecline = (id) => {
    Alert.alert('Decline Order', 'Are you sure you want to decline this order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: () => dispatch(declineOrderThunk({ id, reason: 'Rider declined' })),
      },
    ]);
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

  const renderOrderCard = ({ item: order }) => {
    const status = StatusColors[order.status] || StatusColors.pending_assignment;
    const isNew = order.status === 'assigned';
    const itemCount = order.items?.length || 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/order/${order._id}`)}
        activeOpacity={0.7}
      >
        {/* Header row */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardOrderId}>#{order.orderId}</Text>
          <View style={[styles.cardBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.cardBadgeText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>

        {/* Customer */}
        <View style={styles.cardRow}>
          <View style={styles.cardRowLeft}>
            <UserIcon size={16} color={Colors.gray500} />
            <Text style={styles.cardCustomerName}>{order.customerName}</Text>
          </View>
          <Phone size={18} color={Colors.primary} />
        </View>

        {/* Address */}
        <View style={styles.cardAddressRow}>
          <MapPin size={16} color={Colors.gray500} style={{ marginTop: 1 }} />
          <Text style={styles.cardAddress} numberOfLines={2}>
            {order.deliveryAddress}
          </Text>
        </View>

        {/* Items */}
        <View style={styles.cardItemsRow}>
          <PackageIcon size={14} color={Colors.gray500} />
          <Text style={styles.cardItemsText}>
            {itemCount} item{itemCount !== 1 ? 's' : ''} -- Rs. {order.totalAmount}
          </Text>
        </View>

        {/* Footer: payment, time */}
        <View style={styles.cardFooter}>
          <View style={[
            styles.paymentBadge,
            { backgroundColor: order.paymentMethod === 'cod' ? Colors.orangeLight : Colors.greenLight },
          ]}>
            <Text style={[
              styles.paymentBadgeText,
              { color: order.paymentMethod === 'cod' ? Colors.orangeDark : Colors.greenDark },
            ]}>
              {order.paymentMethod === 'cod' ? 'COD' : 'Prepaid'}
            </Text>
          </View>
          {isNew && (
            <Text style={styles.cardFooterMeta}>Ready in ~15 min</Text>
          )}
          <Text style={styles.cardTime}>{timeAgo(order.assignedAt || order.createdAt)}</Text>
        </View>

        {/* Accept / Decline for new orders */}
        {isNew && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => handleAccept(order._id)}
              disabled={actionLoading}
            >
              <Text style={styles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => handleDecline(order._id)}
              disabled={actionLoading}
            >
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text
                style={[styles.filterText, filter === f.key && styles.filterTextActive]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Orders List */}
      {loading && items.length === 0 ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderOrderCard}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadOrders} colors={[Colors.primary]} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <PackageIcon size={48} color={Colors.gray300} />
              <Text style={styles.emptyText}>No orders found</Text>
              <Text style={styles.emptySubtext}>Pull down to refresh</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.gray800,
    marginBottom: 16,
  },
  filters: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray500,
  },
  filterTextActive: {
    color: Colors.white,
  },
  listContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardOrderId: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gray800,
  },
  cardBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  cardBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardCustomerName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray800,
  },
  cardAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  cardAddress: {
    fontSize: 13,
    color: Colors.gray500,
    lineHeight: 18,
    flex: 1,
  },
  cardItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  cardItemsText: {
    fontSize: 13,
    color: Colors.gray500,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  paymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  paymentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooterMeta: {
    fontSize: 12,
    color: Colors.gray500,
  },
  cardTime: {
    fontSize: 12,
    color: Colors.gray400,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  acceptBtn: {
    flex: 1,
    height: 44,
    backgroundColor: Colors.green,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  declineBtn: {
    flex: 1,
    height: 44,
    borderWidth: 2,
    borderColor: Colors.red,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: {
    color: Colors.red,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray500,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.gray400,
    marginTop: 4,
  },
});
