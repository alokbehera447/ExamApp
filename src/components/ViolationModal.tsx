// src/components/ViolationModal.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';

const { width, height } = Dimensions.get('window');

interface ViolationModalProps {
  visible: boolean;
  onClose: () => void;
  violationType: string;
  violationTitle: string;
  violationMessage: string;
  totalViolations: number;
  isDisqualified?: boolean;
}

const ViolationModal: React.FC<ViolationModalProps> = ({
  visible,
  onClose,
  violationType,
  violationTitle,
  violationMessage,
  totalViolations,
  isDisqualified = false,
}) => {
  const [scaleAnim] = React.useState(new Animated.Value(0));
  const [opacityAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getViolationColor = () => {
    if (isDisqualified) return '#DC2626'; // Red for disqualification
    if (totalViolations >= 5) return '#EA580C'; // Orange-red for high violations
    if (totalViolations >= 3) return '#F59E0B'; // Orange for medium violations
    return '#EAB308'; // Yellow for low violations
  };

  const getViolationIcon = () => {
    if (isDisqualified) return '🚫';
    switch (violationType) {
      case 'no_face':
        return '❌';
      case 'multiple_faces':
        return '👥';
      case 'looking_away':
        return '👀';
      case 'suspicious_gaze':
        return '👁️';
      case 'head_pose_violation':
        return '🔄';
      default:
        return '⚠️';
    }
  };

  const getSeverityLevel = () => {
    if (isDisqualified) return 'CRITICAL';
    if (totalViolations >= 5) return 'HIGH';
    if (totalViolations >= 3) return 'MEDIUM';
    return 'LOW';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={isDisqualified ? undefined : onClose}
    >
      <StatusBar backgroundColor="rgba(0, 0, 0, 0.7)" barStyle="light-content" />
      
      {/* Backdrop with blur effect */}
      <Animated.View
        style={[
          styles.backdrop,
          { opacity: opacityAnim },
        ]}
      >
        <View style={styles.blurContainer}>
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType="dark"
            blurAmount={10}
            reducedTransparencyFallbackColor="rgba(0, 0, 0, 0.8)"
          />
        </View>

        {/* Modal Content */}
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Header with colored accent */}
          <View style={[styles.header, { backgroundColor: getViolationColor() }]}>
            <Text style={styles.iconText}>{getViolationIcon()}</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Severity Badge */}
            <View style={[styles.severityBadge, { backgroundColor: `${getViolationColor()}20` }]}>
              <Text style={[styles.severityText, { color: getViolationColor() }]}>
                {getSeverityLevel()} SEVERITY
              </Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>{violationTitle}</Text>

            {/* Message */}
            <Text style={styles.message}>{violationMessage}</Text>

            {/* Violation Counter */}
            <View style={styles.violationCounter}>
              <View style={styles.counterRow}>
                <Text style={styles.counterLabel}>Total Violations</Text>
                <View style={[styles.counterBadge, { backgroundColor: getViolationColor() }]}>
                  <Text style={styles.counterValue}>{totalViolations}</Text>
                </View>
              </View>
              
              {/* Progress Bar */}
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min((totalViolations / 10) * 100, 100)}%`,
                        backgroundColor: getViolationColor(),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {10 - totalViolations > 0
                    ? `${10 - totalViolations} violations until disqualification`
                    : 'Disqualification threshold reached'}
                </Text>
              </View>
            </View>

            {/* Warning Message */}
            {!isDisqualified && (
              <View style={styles.warningBox}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>
                  Continued violations may result in automatic exam disqualification
                </Text>
              </View>
            )}

            {isDisqualified && (
              <View style={[styles.warningBox, styles.disqualifiedBox]}>
                <Text style={styles.warningIcon}>🚫</Text>
                <Text style={[styles.warningText, styles.disqualifiedText]}>
                  Your exam attempt has been terminated due to multiple violations
                </Text>
              </View>
            )}

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: getViolationColor() }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {isDisqualified ? 'Close' : 'I Understand'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  header: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 64,
  },
  content: {
    padding: 24,
  },
  severityBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  violationCounter: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  counterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  counterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  disqualifiedBox: {
    backgroundColor: '#FEE2E2',
    borderLeftColor: '#DC2626',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  disqualifiedText: {
    color: '#991B1B',
    fontWeight: '600',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ViolationModal;