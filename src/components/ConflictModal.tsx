import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BlurView } from '@react-native-community/blur'; // Optional: for iOS glass effect

const { width } = Dimensions.get('window');

interface ConflictModalProps {
  visible: boolean;
  conflictInfo: {
    device_type?: string;
    os?: string;
    browser?: string;
    last_activity: string;
    login_timestamp: string;
  } | null;
  onCancel: () => void;
  onContinue: () => void;
  loading?: boolean;
}

export default function ConflictModal({
  visible,
  conflictInfo,
  onCancel,
  onContinue,
  loading = false,
}: ConflictModalProps) {
  if (!conflictInfo) return null;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return 'Unknown time';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        {/* Use a real BlurView here if available for a premium feel */}
        <View style={styles.modalContent}>
          
          <View style={styles.header}>
            <View style={styles.alertIconBg}>
              <Icon name="shield-alert-outline" size={32} color="#6366F1" />
            </View>
            <Text style={styles.title}>Security Notification</Text>
            <Text style={styles.subtitle}>
              An active session was detected on another device.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardHeader}>ACTIVE SESSION DETAILS</Text>
            
            <View style={styles.grid}>
              <DetailItem 
                icon="cellphone-link" 
                label="Device" 
                value={`${conflictInfo.device_type || 'Unknown'} (${conflictInfo.os || 'OS'})`} 
              />
              <DetailItem 
                icon="web" 
                label="Platform" 
                value={conflictInfo.browser || 'Native App'} 
              />
              <DetailItem 
                icon="clock-check-outline" 
                label="Last Activity" 
                value={formatDate(conflictInfo.last_activity)} 
              />
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={onContinue}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Terminate Other Session</Text>
                  <Icon name="arrow-right" size={18} color="#FFF" />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.footerNote}>
            Logging in here will securely sign you out of all other locations.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// Sub-component for cleaner code
const DetailItem = ({ icon, label, value }: { icon: string, label: string, value: string }) => (
  <View style={styles.detailRow}>
    <View style={styles.iconWrapper}>
      <Icon name={icon} size={18} color="#94A3B8" />
    </View>
    <View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)', // Deep slate overlay
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32, // Extra rounded for modern look
    padding: 32,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  alertIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 28,
  },
  cardHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 16,
  },
  grid: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  footer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#4F46E5', // Premium Indigo
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  footerNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
});