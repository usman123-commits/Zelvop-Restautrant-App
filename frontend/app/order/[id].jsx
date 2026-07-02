import { useEffect, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Navigation,
  CheckCircle,
  XCircle,
  Truck,
  ThumbsUp,
  FileText,
} from 'lucide-react-native';
import {
  fetchOrderDetail,
  acceptOrderThunk,
  declineOrderThunk,
  pickupOrderThunk,
} from '../../src/store/ordersSlice';
import { Colors, StatusColors } from '../../src/constants/colors';

const TIMELINE_STEPS = [
  { key: 'received', label: 'Order Received' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'delivered', label: 'Delivered' },
];

function getTimelineState(status) {
  const map = {
    pending_assignment: 0,
    assigned: 0,
    accepted: 1,
    picked_up: 2,
    delivered: 4,
    cancelled: -1,
  };
  return map[status] ?? 0;
}

function TimelineStep({ label, stepIndex, currentStep, isLast }) {
  const completed = stepIndex < currentStep;
  const active = stepIndex === currentStep;
  const pending = stepIndex > currentStep;

  return (
    <View style={tlStyles.row}>
      <View style={tlStyles.dotCol}>
        <View
          style={[
            tlStyles.dot,
            completed && tlStyles.dotDone,
            active && tlStyles.dotActive,
            pending && tlStyles.dotPending,
          ]}
        >
          {completed && (
            <Text style={tlStyles.checkmark}>&#10003;</Text>
          )}
          {active && <View style={tlStyles.innerDot} />}
        </View>
        {!isLast && (
          <View
            style={[
              tlStyles.line,
              completed && tlStyles.lineDone,
            ]}
          />
        )}
      </View>
      <View style={tlStyles.textCol}>
        <Text
          style={[
            tlStyles.stepLabel,
            pending && tlStyles.stepPending,
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            tlStyles.stepSub,
            active && tlStyles.stepSubActive,
          ]}
        >
          {completed
            ? 'Completed'
            : active
              ? 'In progress...'
              : 'Pending'}
        </Text>
      </View>
    </View>
  );
}

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

  useEffect(() => {
    dispatch(fetchOrderDetail(id));
  }, [id, dispatch]);

  useEffect(() => {
    if (error) Alert.alert('Error', error);
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
    dispatch(declineOrderThunk({ id, reason: declineReason.trim() })).then(
      (result) => {
        if (!result.error) router.back();
      }
    );
  };

  const handlePickup = () => {
    Alert.alert('Mark as Picked Up', 'Confirm you have picked up the order?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => dispatch(pickupOrderThunk(id)) },
    ]);
  };

  const handleDeliver = () => {
    router.push({
      pathname: '/order/confirm-delivery',
      params: {
        id: order._id,
        orderId: order.orderId,
        customerName: order.customerName,
        totalAmount: String(order.totalAmount),
        paymentMethod: order.paymentMethod,
      },
    });
  };

  const openMaps = () => {
    if (!order?.deliveryAddress) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      order.deliveryAddress
    )}`;
    Linking.openURL(url);
  };

  const callCustomer = () => {
    if (!order?.customerPhone) return;
    Linking.openURL(`tel:${order.customerPhone}`);
  };

  const openWhatsApp = () => {
    if (!order?.customerPhone) return;
    const phone = order.customerPhone.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${phone}`);
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
  const timelineStep = getTimelineState(order.status);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>#{order.orderId}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>
              {status.label}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Status Timeline */}
          {order.status !== 'cancelled' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Status Timeline</Text>
              {TIMELINE_STEPS.map((step, idx) => (
                <TimelineStep
                  key={step.key}
                  label={step.label}
                  stepIndex={idx}
                  currentStep={timelineStep}
                  isLast={idx === TIMELINE_STEPS.length - 1}
                />
              ))}
            </View>
          )}

          {/* Customer */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Customer</Text>
            <Text style={styles.customerName}>{order.customerName}</Text>
            <Text style={styles.customerPhone}>{order.customerPhone}</Text>

            <View style={styles.contactRow}>
              <TouchableOpacity style={styles.contactBtn} onPress={callCustomer}>
                <Phone size={16} color={Colors.primary} />
                <Text style={styles.contactBtnText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactBtn, styles.whatsappBtn]}
                onPress={openWhatsApp}
              >
                <Text style={styles.whatsappBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.addressRow}>
              <MapPin size={16} color={Colors.gray500} style={{ marginTop: 2 }} />
              <Text style={styles.addressText}>{order.deliveryAddress}</Text>
            </View>

            <TouchableOpacity style={styles.mapsBtn} onPress={openMaps}>
              <Navigation size={16} color={Colors.primary} />
              <Text style={styles.mapsBtnText}>Open in Maps</Text>
            </TouchableOpacity>

            {order.deliveryNotes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>{order.deliveryNotes}</Text>
              </View>
            )}
          </View>

          {/* Order Items */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order Items</Text>
            {order.items?.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemName}>
                  {item.quantity}x {item.name}
                </Text>
                <Text style={styles.itemPrice}>
                  Rs. {(item.price * item.quantity).toLocaleString()}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                Rs. {order.totalAmount?.toLocaleString()}
              </Text>
            </View>
            <View style={styles.paymentBadge}>
              <Text
                style={[
                  styles.paymentBadgeText,
                  isCod ? styles.codBadge : styles.prepaidBadge,
                ]}
              >
                {isCod ? 'Cash on Delivery' : 'Prepaid'}
              </Text>
            </View>
          </View>

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
                textAlignVertical="top"
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
              style={[styles.actionButton, styles.deliverButton, styles.fullWidth]}
              onPress={handleDeliver}
              disabled={actionLoading}
            >
              <ThumbsUp size={18} color={Colors.white} />
              <Text style={styles.acceptText}>Mark Delivered</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );
}

const tlStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  dotCol: {
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: '#10B981',
  },
  dotActive: {
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: '#BFDBFE',
  },
  dotPending: {
    backgroundColor: Colors.gray200,
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  line: {
    width: 2,
    height: 28,
    backgroundColor: Colors.gray200,
    marginVertical: 2,
  },
  lineDone: {
    backgroundColor: '#10B981',
  },
  textCol: {
    paddingBottom: 12,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray900,
  },
  stepPending: {
    color: Colors.gray400,
  },
  stepSub: {
    fontSize: 12,
    color: Colors.gray400,
  },
  stepSubActive: {
    color: Colors.primary,
    fontWeight: '500',
  },
});

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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  topTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray900,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
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
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray900,
    marginBottom: 16,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray900,
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 13,
    color: Colors.gray500,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  contactBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  contactBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  whatsappBtn: {
    borderColor: '#25D366',
  },
  whatsappBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#25D366',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: Colors.gray900,
    lineHeight: 20,
  },
  mapsBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  notesBox: {
    marginTop: 12,
    backgroundColor: Colors.gray50,
    padding: 12,
    borderRadius: 8,
  },
  notesText: {
    fontSize: 13,
    color: Colors.gray500,
    fontStyle: 'italic',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  itemName: {
    fontSize: 14,
    color: Colors.gray900,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray900,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 2,
    borderTopColor: Colors.gray100,
    marginTop: 8,
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
  paymentBadge: {
    marginTop: 8,
  },
  paymentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  codBadge: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  prepaidBadge: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.gray800,
    minHeight: 60,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
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
    height: 52,
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
    backgroundColor: '#10B981',
  },
  acceptText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  declineText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.red,
  },
});
