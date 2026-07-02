import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, Check } from 'lucide-react-native';
import { deliverOrderThunk } from '../../src/store/ordersSlice';
import { uploadProofPhoto } from '../../src/services/api';
import { Colors } from '../../src/constants/colors';

export default function ConfirmDeliveryScreen() {
  const { id, orderId, customerName, totalAmount, paymentMethod } =
    useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { actionLoading } = useSelector((state) => state.orders);

  const [photo, setPhoto] = useState(null);
  const [notes, setNotes] = useState('');
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isCod = paymentMethod === 'cod';

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take delivery photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhoto(result.assets[0]);
    }
  };

  const handleConfirm = async () => {
    if (isCod && !cashConfirmed) {
      Alert.alert('Cash Required', 'Please confirm you have collected the cash payment.');
      return;
    }

    try {
      let proofPhotoUrl = null;

      if (photo) {
        setUploading(true);
        const uploadResult = await uploadProofPhoto(photo.uri);
        proofPhotoUrl = uploadResult.url;
        setUploading(false);
      }

      const result = await dispatch(
        deliverOrderThunk({
          id,
          proofPhotoUrl,
          riderDeliveryNotes: notes.trim() || undefined,
          cashCollected: isCod ? true : undefined,
        })
      );

      if (!result.error) {
        Alert.alert('Delivered!', `Order ${orderId} delivered successfully.`, [
          { text: 'OK', onPress: () => router.replace('/(tabs)/orders') },
        ]);
      }
    } catch (err) {
      setUploading(false);
      Alert.alert('Error', err.message || 'Failed to confirm delivery');
    }
  };

  const busy = actionLoading || uploading;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <ArrowLeft size={20} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Delivery</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.orderInfo}>
            Order #{orderId} -- {customerName}
          </Text>

          {/* Photo Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Photo</Text>
            <TouchableOpacity style={styles.photoArea} onPress={takePhoto}>
              {photo ? (
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.photoPreview}
                />
              ) : (
                <>
                  <View style={styles.cameraIcon}>
                    <Camera size={24} color={Colors.primary} />
                  </View>
                  <Text style={styles.photoText}>Take delivery photo</Text>
                  <Text style={styles.photoSubtext}>Tap to open camera</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.photoOptional}>Photo is optional</Text>
          </View>

          {/* Notes Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g., Left at door, handed to security guard"
              placeholderTextColor={Colors.gray400}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Cash Collection - only for COD */}
          {isCod && (
            <View style={styles.cashCard}>
              <Text style={styles.cashTitle}>Cash Collection</Text>
              <Text style={styles.cashAmount}>
                Rs. {Number(totalAmount).toLocaleString()}
              </Text>
              <TouchableOpacity
                style={styles.cashCheckRow}
                onPress={() => setCashConfirmed(!cashConfirmed)}
              >
                <View
                  style={[
                    styles.checkbox,
                    cashConfirmed && styles.checkboxChecked,
                  ]}
                >
                  {cashConfirmed && (
                    <Check size={14} color={Colors.white} />
                  )}
                </View>
                <Text style={styles.cashCheckText}>
                  I collected the payment
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom Bar */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              (busy || (isCod && !cashConfirmed)) && styles.confirmBtnDisabled,
            ]}
            onPress={handleConfirm}
            disabled={busy || (isCod && !cashConfirmed)}
          >
            {busy ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.confirmBtnText}>Confirm Delivery</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray900,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  orderInfo: {
    fontSize: 14,
    color: Colors.gray500,
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray900,
    marginBottom: 10,
  },
  photoArea: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.gray300,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  cameraIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  photoSubtext: {
    fontSize: 12,
    color: Colors.gray400,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  photoOptional: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 13,
    color: Colors.gray400,
  },
  notesInput: {
    width: '100%',
    minHeight: 80,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: Colors.gray800,
    backgroundColor: Colors.gray50,
  },
  cashCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  cashTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 10,
  },
  cashAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 12,
  },
  cashCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#D97706',
  },
  cashCheckText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
  },
  confirmBtn: {
    height: 52,
    backgroundColor: '#10B981',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
    color: Colors.gray500,
  },
});
