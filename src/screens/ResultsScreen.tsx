// screens/ResultsScreen.tsx - Fixed Version
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Share,
  Alert,
  Animated,
  Platform,
} from "react-native";
import { RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { getExamResults, ExamResult } from "../api/examApi";
import Svg, { Circle, G, Text as SvgText } from "react-native-svg";

type RootStackParamList = {
  Results: { attemptId: number; examTitle: string };
};

type ResultsScreenNavigationProp = StackNavigationProp<RootStackParamList, "Results">;
type ResultsScreenRouteProp = RouteProp<RootStackParamList, "Results">;

interface Props {
  navigation: ResultsScreenNavigationProp;
  route: ResultsScreenRouteProp;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CIRCLE_SIZE = 120;
const CIRCLE_STROKE_WIDTH = 12;

export default function ResultsScreen({ navigation, route }: Props) {
  const { attemptId, examTitle } = route.params;
  const [results, setResults] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(20))[0];

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      setLoading(true);
      const data = await getExamResults(attemptId);
      setResults(data);

      // Start animations after data loads
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error: any) {
      console.error("Error loading results:", error);
      Alert.alert(
        "Error",
        "Failed to load results. Please try again.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadResults();
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "Invalid date";
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'submitted':
        return "#10B981";
      case 'in_progress':
        return "#F59E0B";
      case 'disqualified':
        return "#EF4444";
      default:
        return "#64748B";
    }
  };

  const getSectionStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'evaluated':
      case 'available':
        return "#10B981";
      case 'pending_review':
        return "#F59E0B";
      case 'manual_review':
        return "#8B5CF6";
      case 'ai_review':
        return "#3B82F6";
      default:
        return "#64748B";
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "#10B981";
    if (percentage >= 60) return "#3B82F6";
    if (percentage >= 40) return "#F59E0B";
    return "#EF4444";
  };

  // Calculate correct answers from detailed_answers
  const calculateCorrectAnswers = (detailedAnswers: Record<string, any>) => {
    return Object.values(detailedAnswers).filter((answer: any) => answer.is_correct === true).length;
  };

  // Calculate wrong answers
  const calculateWrongAnswers = (detailedAnswers: Record<string, any>, totalQuestions: number, attemptedQuestions: number) => {
    const correctAnswers = calculateCorrectAnswers(detailedAnswers);
    return attemptedQuestions - correctAnswers;
  };

  // Calculate unattempted questions
  const calculateUnattempted = (totalQuestions: number, attemptedQuestions: number) => {
    return totalQuestions - attemptedQuestions;
  };

  const handleShareResults = async () => {
    if (!results) return;

    try {
      const message = `📊 *${examTitle}*\n\n` +
        `🎯 Score: *${results.marks_obtained}/${results.total_marks}*\n` +
        `📈 Percentage: *${results.percentage.toFixed(1)}%*\n` +
        `⏱️ Time Spent: *${formatTime(results.time_spent)}*\n` +
        `📅 Submitted: *${formatDate(results.submitted_at)}*\n\n` +
        `_Results from Dasho Exam App_`;

      await Share.share({
        message,
        title: `My Results: ${examTitle}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleViewDetailedAnswers = () => {
    if (results?.detailed_answers && Object.keys(results.detailed_answers).length > 0) {
      Alert.alert(
        "Detailed Answers",
        "Detailed answer view will be implemented soon.",
        [{ text: "OK" }]
      );
    }
  };

  const handleDownloadPDF = () => {
    if (results?.answer_sheet_pdf?.url) {
      Alert.alert(
        "Download PDF",
        "PDF download feature will be implemented soon.",
        [{ text: "OK" }]
      );
    }
  };

  // Circular Progress Component
  const CircularProgress = ({
    percentage,
    size = CIRCLE_SIZE,
    strokeWidth = CIRCLE_STROKE_WIDTH,
    showLabel = true
  }: {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    showLabel?: boolean;
  }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const scoreColor = getScoreColor(percentage);

    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          {/* Background Circle */}
          <Circle
            stroke="#E5E7EB"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />

          {/* Progress Circle */}
          <Circle
            stroke={scoreColor}
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />

          {/* Percentage Text */}
          {showLabel && (
            <G>
              <SvgText
                x={size / 2}
                y={size / 2 - 10}
                textAnchor="middle"
                fontSize="28"
                fontWeight="800"
                fill={scoreColor}
              >
                {percentage.toFixed(1)}%
              </SvgText>
              <SvgText
                x={size / 2}
                y={size / 2 + 15}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="#64748B"
              >
                Score
              </SvgText>
            </G>
          )}
        </Svg>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingTitle}>Loading Results</Text>
          <Text style={styles.loadingSubtitle}>Analyzing your performance...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!results) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Results</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={80} color="#EF4444" />
          <Text style={styles.errorTitle}>Failed to Load Results</Text>
          <Text style={styles.errorDescription}>
            We couldn't retrieve your exam results. Please check your connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadResults}
          >
            <Icon name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate stats
  const correctAnswers = calculateCorrectAnswers(results.detailed_answers);
  const wrongAnswers = calculateWrongAnswers(results.detailed_answers, results.total_questions, results.attempted_questions);
  const unattemptedQuestions = calculateUnattempted(results.total_questions, results.attempted_questions);
  console.log("Results Data:", results.attempted_questions);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {examTitle}
        </Text>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareResults}
        >
          <Icon name="share-variant" size={22} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={[
          styles.scrollView,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6"]}
            tintColor="#3B82F6"
            progressBackgroundColor="#FFFFFF"
          />
        }
      >
        {/* Performance Overview Card */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>Performance Overview</Text>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreBadgeText}>
                {results.marks_obtained}/{results.total_marks}
              </Text>
            </View>
          </View>

          <View style={styles.performanceContainer}>
            {/* Circular Progress */}
            <CircularProgress percentage={results.percentage} />

            {/* Score Breakdown */}
            <View style={styles.scoreBreakdown}>
              <View style={styles.scoreItem}>
                <View style={[styles.scoreIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Icon name="check-circle" size={20} color="#1D4ED8" />
                </View>
                <View style={styles.scoreDetails}>
                  <Text style={styles.scoreLabel}>Correct Answers</Text>
                  <Text style={[styles.scoreValue, { color: '#1D4ED8' }]}>
                    {correctAnswers}
                  </Text>
                </View>
              </View>

              <View style={styles.scoreItem}>
                <View style={[styles.scoreIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Icon name="close-circle" size={20} color="#DC2626" />
                </View>
                <View style={styles.scoreDetails}>
                  <Text style={styles.scoreLabel}>Wrong Answers</Text>
                  <Text style={[styles.scoreValue, { color: '#DC2626' }]}>
                    {wrongAnswers}
                  </Text>
                </View>
              </View>

              <View style={styles.scoreItem}>
                <View style={[styles.scoreIcon, { backgroundColor: '#F1F5F9' }]}>
                  <Icon name="help-circle" size={20} color="#64748B" />
                </View>
                <View style={styles.scoreDetails}>
                  <Text style={styles.scoreLabel}>Unattempted</Text>
                  <Text style={[styles.scoreValue, { color: '#64748B' }]}>
                    {unattemptedQuestions}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Icon name="timer" size={18} color="#64748B" />
              <Text style={styles.quickStatValue}>{formatTime(results.time_spent)}</Text>
              <Text style={styles.quickStatLabel}>Time Spent</Text>
            </View>

            <View style={styles.quickStatItem}>
              <Icon name="calendar-check" size={18} color="#64748B" />
              <Text style={styles.quickStatValue}>{formatDate(results.submitted_at)}</Text>
              <Text style={styles.quickStatLabel}>Submitted</Text>
            </View>

            <View style={styles.quickStatItem}>
              <Icon name="shield-check" size={18} color={results.attempt.violations_count > 0 ? "#DC2626" : "#059669"} />
              <Text style={[styles.quickStatValue, results.attempt.violations_count > 0 && { color: '#DC2626' }]}>
                {results.attempt.violations_count}
              </Text>
              <Text style={styles.quickStatLabel}>Violations</Text>
            </View>
          </View>
        </View>

        {/* Section-wise Performance */}
        {results.section_results && Object.keys(results.section_results).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Section-wise Performance</Text>
              <Text style={styles.sectionSubtitle}>Detailed breakdown by sections</Text>
            </View>

            {Object.entries(results.section_results).map(([sectionId, section], index) => (
              <TouchableOpacity
                key={sectionId}
                style={styles.sectionCard}
                activeOpacity={0.9}
              >
                <View style={styles.sectionCardHeader}>
                  <View style={styles.sectionInfo}>
                    <Text style={styles.sectionName}>{section.section_name}</Text>
                    <View style={styles.sectionMeta}>
                      <View style={[styles.sectionTag, { backgroundColor: '#E0F2FE' }]}>
                        <Text style={[styles.sectionTagText, { color: '#0369A1' }]}>
                          {section.subject}
                        </Text>
                      </View>
                      <View style={[styles.sectionTag, { backgroundColor: '#F3E8FF' }]}>
                        <Text style={[styles.sectionTagText, { color: '#7C3AED' }]}>
                          {section.question_type.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.sectionScoreContainer}>
                    <Text style={[
                      styles.sectionScore,
                      { color: getSectionStatusColor(section.status) }
                    ]}>
                      {section.score}/{section.max_marks}
                    </Text>
                    <CircularProgress
                      percentage={(section.score / section.max_marks) * 100}
                      size={40}
                      strokeWidth={4}
                      showLabel={false}
                    />
                  </View>
                </View>

                <View style={styles.sectionCardFooter}>
                  <View style={styles.sectionStatus}>
                    <View style={[
                      styles.statusIndicator,
                      { backgroundColor: getSectionStatusColor(section.status) }
                    ]} />
                    <Text style={[
                      styles.statusText,
                      { color: getSectionStatusColor(section.status) }
                    ]}>
                      {section.status.replace('_', ' ')}
                    </Text>
                  </View>

                  {section.feedback && (
                    <Text style={styles.feedbackText} numberOfLines={2}>
                      {section.feedback}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Attempt Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Attempt Details</Text>
            <Text style={styles.sectionSubtitle}>Additional information about this attempt</Text>
          </View>

          <View style={styles.detailsCard}>
            <DetailRow
              icon="account"
              label="Student"
              value={results.attempt.student_name}
              color="#3B82F6"
            />
            <DetailRow
              icon="counter"
              label="Attempt Number"
              value={`#${results.attempt.attempt_number}`}
              color="#8B5CF6"
            />
            <DetailRow
              icon="clock-start"
              label="Started At"
              value={formatDate(results.attempt.started_at)}
              color="#F59E0B"
            />
            <DetailRow
              icon="flag-checkered"
              label="Status"
              value={
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(results.attempt.status) + '20' }
                ]}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: getStatusColor(results.attempt.status) }
                  ]} />
                  <Text style={[
                    styles.statusText,
                    { color: getStatusColor(results.attempt.status) }
                  ]}>
                    {results.attempt.status.replace('_', ' ')}
                  </Text>
                </View>
              }
              color={getStatusColor(results.attempt.status)}
            />
            <DetailRow
              icon="ip-network"
              label="IP Address"
              value={results.attempt.ip_address}
              color="#64748B"
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {Object.keys(results.detailed_answers).length > 0 && (
            <TouchableOpacity
              style={[styles.actionButton, styles.reviewButton]}
              onPress={handleViewDetailedAnswers}
            >
              <Icon name="file-document" size={20} color="#3B82F6" />
              <Text style={styles.reviewButtonText}>View Detailed Answers</Text>
              <Icon name="chevron-right" size={20} color="#3B82F6" />
            </TouchableOpacity>
          )}

          {results.answer_sheet_pdf?.url && (
            <TouchableOpacity
              style={[styles.actionButton, styles.pdfButton]}
              onPress={handleDownloadPDF}
            >
              <Icon name="file-pdf-box" size={24} color="#EF4444" />
              <View style={styles.pdfButtonContent}>
                <Text style={styles.pdfButtonTitle}>Download Answer Sheet</Text>
                <Text style={styles.pdfButtonSubtitle}>PDF Document</Text>
              </View>
              <Icon name="download" size={24} color="#3B82F6" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.shareResultsButton]}
            onPress={handleShareResults}
          >
            <Icon name="share-variant" size={20} color="#FFFFFF" />
            <Text style={styles.shareResultsText}>Share Results</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerSpacer} />

      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const DetailRow = ({ icon, label, value, color = "#3B82F6" }: any) => (
  <View style={styles.detailRow}>
    <View style={[styles.detailIcon, { backgroundColor: color + '20' }]}>
      <Icon name={icon} size={18} color={color} />
    </View>
    <Text style={styles.detailLabel}>{label}</Text>
    {typeof value === 'string' ? (
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    ) : (
      value
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 20,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  scrollView: {
    flex: 1,
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  scoreBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  scoreBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  performanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreBreakdown: {
    flex: 1,
    marginLeft: 24,
  },
  scoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scoreDetails: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
    marginBottom: 2,
  },
  quickStatLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionInfo: {
    flex: 1,
  },
  sectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  sectionMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionScoreContainer: {
    alignItems: 'center',
    marginLeft: 12,
  },
  sectionScore: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  sectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  feedbackText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    flex: 1,
    marginLeft: 12,
    textAlign: 'right',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748B',
    width: 100,
    fontWeight: '500',
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'right',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  actionButtonsContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  reviewButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    justifyContent: 'space-between',
  },
  reviewButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
    marginHorizontal: 12,
  },
  pdfButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    justifyContent: 'space-between',
  },
  pdfButtonContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  pdfButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  pdfButtonSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  shareResultsButton: {
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  shareResultsText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 20,
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  footerSpacer: {
    height: 40,
  },
});