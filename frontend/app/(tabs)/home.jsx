import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Package, TrendingUp, CheckCircle, Clock } from 'lucide-react-native';
import { fetchOrders } from '../../src/store/ordersSlice';
import OrderCard from '../../src/components/OrderCard';
import { Colors } from '../../src/constants/colors';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { items, loading } = useSelector((state) => state.orders);

  const activeOrders = items.filter(
    (o) => !['delivered', 'cancelled'].includes(o.status)
  );
  const todayDelivered = items.filter(
    (o) =>
      o.status === 'delivered' &&
      new Date(o.deliveredAt).toDateString() === new Date().toDateString()
  ).length;
  const pendingAccept = items.filter((o) => o.status === 'assigned').length;

  const loadOrders = useCallback(() => {
    dispatch(fetchOrders());
  }, [dispatch]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const firstName = user?.name?.split(' ')[0] || 'Rider';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {firstName}</Text>
          <Text style={styles.subtitle}>
            {activeOrders.length > 0
              ? `You have ${activeOrders.length} active order${activeOrders.length > 1 ? 's' : ''}`
              : 'No active orders right now'}
          </Text>
        </View>
        <View style={[styles.onlineDot, user?.isOnline && styles.onlineDotActive]} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <CheckCircle size={20} color={Colors.green} />
          <Text style={styles.statValue}>{todayDelivered}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
        <View style={styles.statCard}>
          <Package size={20} color={Colors.primary} />
          <Text style={styles.statValue}>{activeOrders.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Clock size={20} color={Colors.orange} />
          <Text style={styles.statValue}>{pendingAccept}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Active Orders */}
      <Text style={styles.sectionTitle}>Active Orders</Text>

      {loading && items.length === 0 ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={activeOrders}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <OrderCard order={item} />}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadOrders} colors={[Colors.primary]} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Package size={48} color={Colors.gray300} />
              <Text style={styles.emptyText}>No active orders</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.gray900,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.gray300,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  onlineDotActive: {
    backgroundColor: Colors.green,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.gray900,
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.gray500,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray800,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
