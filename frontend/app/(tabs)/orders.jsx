import { useState, useCallback } from 'react';
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
import { ClipboardList } from 'lucide-react-native';
import { fetchOrders } from '../../src/store/ordersSlice';
import OrderCard from '../../src/components/OrderCard';
import { Colors, StatusColors } from '../../src/constants/colors';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { items, loading } = useSelector((state) => state.orders);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadOrders = useCallback(() => {
    dispatch(fetchOrders());
  }, [dispatch]);

  const filtered = items.filter((order) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active')
      return !['delivered', 'cancelled'].includes(order.status);
    return order.status === activeFilter;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>My Orders</Text>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, activeFilter === f.key && styles.chipActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text
              style={[styles.chipText, activeFilter === f.key && styles.chipTextActive]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <OrderCard order={item} />}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadOrders} colors={[Colors.primary]} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ClipboardList size={48} color={Colors.gray300} />
              <Text style={styles.emptyText}>No orders found</Text>
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.gray900,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
  },
  chipActive: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.gray600,
  },
  chipTextActive: {
    color: Colors.white,
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
});
