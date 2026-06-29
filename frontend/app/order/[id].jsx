import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  TextInput,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowLeft,
  MapPin,
  Phone,
  User,
  Package,
  Clock,
  Banknote,
  CreditCard,
  MessageSquare,
  CheckCircle,
  XCircle,
  Truck,
  ThumbsUp,
} from 'lucide-react-native';
import {
  fetchOrderDetail,
  acceptOrderThunk,
  declineOrderThunk,
  pickupOrderThunk,
  deliverOrderThunk,
} from '../../src/store/ordersSlice';
import { Colors, StatusColors } from '../../src/constants/colors';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { currentOrder: order, loading, actionLoading, error } = useSelector(
    (state) => state.orders
  );

  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [cashCollected, setCashCollected] = useState(false);

  useEffect(() => {
    dispatch(fetchOrderDetail(id));
  }, [id, dispatch]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
    }
  }, [error]);

  const handleAccept = () => {
    Alert.alert('Accept Order', 'Are you sure you want to accept this order?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: () => dispatch(acceptOrderThunk(id)) },
    ]);
  };

  const handleDecline = () => {
    if (!showDeclineInput) {
      setShowDeclineInput(true);
      return;
    }
    if (!declineReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for declining.');
      return;
    }
    dispatch(declineOrderThunk({ id, reason: declineReason.trim() })).then((result) => {
      if (!result.error) router.back();
    });
  };

  const handlePickup = () => {
    Alert.alert('Mark as Picked Up', 'Confirm you have picked up the order?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => dispatch(pickupOrderThunk(id)) },
    ]);
  };

  const handleDeliver = () => {
    if (order.paymentMethod === 'cod' && !cashCollected) {
      Alert.alert('Cash Required', 'Please confirm you have collected the cash payment.');
      return;
    }
    Alert.alert('Mark as Delivered', 'Confirm delivery to the customer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () =>
          dispatch(
            deliverOrderThunk({
              id,
              cashCollected: order.paymentMethod === 'cod' ? true : undefined,
            })
          ),
      },
    ]);
  };

  const openMaps = () => {
    if (!order?.customerAddress) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      order.customerAddress
    )}`;
    Linking.openURL(url);
  };

  const callCustomer = () => {
    if (!order?.customerPhone) return;
    Linking.openURL(`tel:${order.customerPhone}`);
  };

  if (loading || !order) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const status = StatusColors[order.status] || StatusColors.pending_assignment;
  const isCod = order.paymentMethod === 'cod';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={22} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{order.orderId}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Customer Info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Customer</Text>
            <View style={styles.infoRow}>
              <User size={16} color={Colors.gray500} />
              <Text style={styles.infoText}>{order.customerName}</Text>
            </View>
            <TouchableOpacity style={styles.infoRow} onPress={callCustomer}>
              <Phone size={16} color={Colors.primary} />
              <Text style={[styles.infoText, styles.linkText]}>{order.customerPhone}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.infoRow} onPress={openMaps}>
              <MapPin size={16} color={Colors.primary} />
              <Text style={[styles.infoText, styles.linkText]}>{order.customerAddress}</Text>
            </TouchableOpacity>
            {order.deliveryNotes && (
              <View style={styles.infoRow}>
                <MessageSquare size={16} color={Colors.gray500} />
                <Text style={styles.infoText}>{order.deliveryNotes}</Text>
              </View>
            )}
          </View>

          {/* Items */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Items</Text>
            {order.items?.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemQty}>{item.quantity}x</Text>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>Rs. {item.price * item.quantity}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>Rs. {order.totalAmount}</Text>
            </View>
          </View>

          {/* Payment */}
          <View style={styles.card}>
            <View style={styles.paymentRow}>
              {isCod ? (
                <Banknote size={20} color={Colors.orange} />
              ) : (
                <CreditCard size={20} color={Colors.green} />
              )}
              <View>
                <Text style={styles.paymentMethod}>
                  {isCod ? 'Cash on Delivery' : 'Prepaid'}
                </Text>
                {isCod && order.status === 'picked_up' && (
                  <Text style={styles.paymentNote}>
                    Collect Rs. {order.totalAmount} from customer
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* COD Cash Toggle -- only when delivering */}
          {isCod && order.status === 'picked_up' && (
            <View style={styles.card}>
              <View style={styles.cashRow}>
                <Text style={styles.cashLabel}>Cash Collected?</Text>
                <Switch
                  value={cashCollected}
                  onValueChange={setCashCollected}
                  trackColor={{ false: Colors.gray200, true: Colors.greenLight }}
                  thumbColor={cashCollected ? Colors.green : Colors.gray400}
                />
              </View>
            </View>
          )}

          {/* Decline Reason Input */}
          {showDeclineInput && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Decline Reason</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Why are you declining this order?"
                placeholderTextColor={Colors.gray400}
                value={declineReason}
                onChangeText={setDeclineReason}
                multiline
                numberOfLines={3}
              />
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
          {order.status === 'assigned' && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.declineButton]}
                onPress={handleDecline}
                disabled={actionLoading}
              >
                <XCircle size={18} color={Colors.red} />
                <Text style={styles.declineText}>
                  {showDeclineInput ? 'Submit' : 'Decline'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={handleAccept}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <CheckCircle size={18} color={Colors.white} />
                    <Text style={styles.acceptText}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {order.status === 'accepted' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.pickupButton, styles.fullWidth]}
              onPress={handlePickup}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Truck size={18} color={Colors.white} />
                  <Text style={styles.acceptText}>Mark Picked Up</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {order.status === 'picked_up' && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.deliverButton,
                styles.fullWidth,
                isCod && !cashCollected && styles.buttonDisabled,
              ]}
              onPress={handleDeliver}
              disabled={actionLoading || (isCod && !cashCollected)}
            >
              {actionLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <ThumbsUp size={18} color={Colors.white} />
                  <Text style={styles.acceptText}>Mark Delivered</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  topTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray900,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray800,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.gray700,
    flex: 1,
  },
  linkText: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray50,
  },
  itemQty: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    width: 30,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: Colors.gray700,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.gray800,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gray900,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gray900,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentMethod: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray800,
  },
  paymentNote: {
    fontSize: 12,
    color: Colors.orange,
    marginTop: 2,
  },
  cashRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cashLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray800,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.gray800,
    textAlignVertical: 'top',
    minHeight: 60,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  fullWidth: {
    flex: 1,
  },
  acceptButton: {
    backgroundColor: Colors.primary,
  },
  declineButton: {
    backgroundColor: Colors.redLight,
    borderWidth: 1,
    borderColor: Colors.red,
  },
  pickupButton: {
    backgroundColor: Colors.orange,
  },
  deliverButton: {
    backgroundColor: Colors.green,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  acceptText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  declineText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.red,
  },
});
