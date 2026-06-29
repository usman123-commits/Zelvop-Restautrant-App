import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, Phone, Clock, CreditCard, Banknote } from 'lucide-react-native';
import { Colors, StatusColors } from '../constants/colors';

export default function OrderCard({ order }) {
  const router = useRouter();
  const status = StatusColors[order.status] || StatusColors.pending_assignment;

  const timeSinceAssigned = order.assignedAt
    ? Math.floor((Date.now() - new Date(order.assignedAt).getTime()) / 60000)
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/order/${order._id}`)}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.orderId}>{order.orderId}</Text>
          <Text style={styles.customerName}>{order.customerName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
        </View>
      </View>

      {/* Address */}
      <View style={styles.row}>
        <MapPin size={14} color={Colors.gray500} />
        <Text style={styles.rowText} numberOfLines={1}>
          {order.customerAddress}
        </Text>
      </View>

      {/* Phone */}
      <View style={styles.row}>
        <Phone size={14} color={Colors.gray500} />
        <Text style={styles.rowText}>{order.customerPhone}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.row}>
          {order.paymentMethod === 'cod' ? (
            <Banknote size={14} color={Colors.orange} />
          ) : (
            <CreditCard size={14} color={Colors.green} />
          )}
          <Text style={styles.amount}>
            Rs. {order.totalAmount} ({order.paymentMethod.toUpperCase()})
          </Text>
        </View>

        {timeSinceAssigned !== null && order.status === 'assigned' && (
          <View style={styles.row}>
            <Clock size={14} color={Colors.yellow} />
            <Text style={styles.timeText}>{timeSinceAssigned}m ago</Text>
          </View>
        )}

        <Text style={styles.itemCount}>{order.items?.length || 0} items</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray900,
  },
  customerName: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  rowText: {
    fontSize: 13,
    color: Colors.gray600,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  amount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray800,
  },
  timeText: {
    fontSize: 12,
    color: Colors.yellow,
    fontWeight: '500',
  },
  itemCount: {
    fontSize: 12,
    color: Colors.gray400,
  },
});
