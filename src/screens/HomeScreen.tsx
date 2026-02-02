// HomeScreen.tsx - Fixed Version with Auto-Refresh
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  Pressable,
  Animated,
  Platform,
} from "react-native";
import {
  clearTokens,
  getUserData,
  clearUserData,
  getAccessToken
} from "../utils/storage";
import {
  getStudentDashboard,
  getExamDetails,
  startExam,
  Exam,
  DashboardExam,
  StudentDashboardResponse
} from "../api/examApi";
import { getUserProfile, UserData, logoutCurrentDevice } from "../api/authApi";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import LinearGradient from "react-native-linear-gradient";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Types for better organization
type ExamCategory = 'available' | 'ongoing' | 'scheduled' | 'completed' | 'disqualified';

interface ExamStatusInfo {
  status: ExamCategory;
  text: string;
  color: string;
  icon: string;
  gradient: string[];
}

export default function HomeScreen({ navigation }: any) {
  // State Management
  const [user, setUser] = useState<UserData | null>(null);
  const [dashboardData, setDashboardData] = useState<StudentDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingExamId, setStartingExamId] = useState<number | null>(null);
  const [selectedExam, setSelectedExam] = useState<DashboardExam | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ExamCategory | 'all'>('all');
  const [showAllExams, setShowAllExams] = useState<Record<string, boolean>>({
    'all': false,
    'ongoing': false,
    'available': false,
    'scheduled': false,
    'completed': false,
    'disqualified': false
  });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Data
  const availableExams = dashboardData?.available_exams || [];
  const scheduledExams = dashboardData?.scheduled_exams || [];
  const ongoingExams = dashboardData?.ongoing_exams || [];
  const completedExams = dashboardData?.completed_exams || [];
  const disqualifiedExams = dashboardData?.disqualified_exams || [];
  const stats = dashboardData?.stats;

  // Load data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // ✅ AUTO-REFRESH when screen comes into focus (e.g., returning from exam)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('📱 Screen focused - refreshing dashboard...');
      // Refresh data when user returns to this screen
      loadUserProfile();
      loadDashboard();
    });

    return unsubscribe;
  }, [navigation]);

  const loadInitialData = async () => {
    await Promise.all([loadUserProfile(), loadDashboard()]);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadUserProfile = async () => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No access token found");
      const freshUserProfile = await getUserProfile(token);
      setUser(freshUserProfile);
    } catch (error: any) {
      console.error("Error loading profile:", error);
      const storedUserData = await getUserData();
      if (storedUserData) setUser(storedUserData);
    }
  };

  const loadDashboard = async () => {
    try {
      const dashboard = await getStudentDashboard();
      setDashboardData(dashboard);
    } catch (error: any) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUserProfile();
    loadDashboard();
  };

  // Formatting helpers
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return "Invalid date";
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} mins`;
    if (mins === 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
    return `${hours}h ${mins}m`;
  };

  const formatTimeRemaining = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m left`;
    if (minutes > 0) return `${minutes}m left`;
    return 'Time expired';
  };

  // Navigation handlers
  const handleViewResults = (exam: DashboardExam) => {
    if (exam.attempt_id) {
      navigation.navigate("Results", {
        attemptId: exam.attempt_id,
        examTitle: exam.title
      });
    }
  };

  const getExamStatusInfo = (exam: DashboardExam): ExamStatusInfo => {
    const status = exam.status.toLowerCase();

    // Check for completed exams first (multiple possible statuses)
    if (status === 'submitted' || status === 'completed' || 
        status === 'auto_submitted' || exam.submitted_at) {
      return {
        status: "completed",
        text: "Completed",
        color: "#10B981",
        icon: "check-circle",
        gradient: ["#D1FAE5", "#A7F3D0"]
      };
    }

    if (status === 'in_progress') {
      return {
        status: "ongoing",
        text: "In Progress",
        color: "#F59E0B",
        icon: "timer-sand",
        gradient: ["#FEF3C7", "#FDE68A"]
      };
    }

    if (status === 'disqualified') {
      return {
        status: "disqualified",
        text: "Disqualified",
        color: "#EF4444",
        icon: "alert-circle",
        gradient: ["#FEE2E2", "#FECACA"]
      };
    }

    // Available/Scheduled exams
    if (exam.start_date && new Date(exam.start_date) > new Date()) {
      return {
        status: "scheduled",
        text: "Scheduled",
        color: "#8B5CF6",
        icon: "calendar-clock",
        gradient: ["#EDE9FE", "#DDD6FE"]
      };
    }

    return {
      status: "available",
      text: "Available",
      color: "#3B82F6",
      icon: "play-circle",
      gradient: ["#DBEAFE", "#BFDBFE"]
    };
  };

  // Show exam details for scheduled exams
  const showExamDetails = async (exam: DashboardExam) => {
    try {
      setLoadingDetails(true);
      setSelectedExam(exam);
      console.log("Fetching details for exam ID:", exam);
      const detailedExam = await getExamDetails(exam.id);
      setExamDetails(detailedExam);
      setModalVisible(true);
    } catch (error) {
      console.error("Error loading exam details:", error);
      alert("Failed to load exam details. Please try again.");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Handle Start button click for available exams
  const handleStartButtonClick = async (exam: DashboardExam) => {
    setSelectedExam(exam);

    try {
      // Load exam details for confirmation modal
      const detailedExam = await getExamDetails(exam.id);
      setExamDetails(detailedExam);
      setModalVisible(true);
    } catch (error) {
      console.error("Error loading exam details:", error);
      alert("Failed to load exam details. Please try again.");
      setSelectedExam(null);
    }
  };

  // Final exam start after confirmation
  const handleStartExam = async () => {
    if (!selectedExam || !examDetails) return;

    setStartingExamId(selectedExam.id);
    try {
      const response = await startExam(selectedExam.id);
      // Close modal and clear state
      setModalVisible(false);
      setSelectedExam(null);
      setExamDetails(null);
      setStartingExamId(null);

      // Navigate to exam screen
      navigation.navigate("Exam", {
        attemptId: response.attempt.id,
        examId: selectedExam.id
      });
    } catch (error: any) {
      console.error("Error starting exam:", error);
      alert("Failed to start exam. Please try again.");
      setStartingExamId(null);
    }
  };

  const handleResumeExam = async (exam: DashboardExam) => {
    if (!exam.attempt_id) return;
    navigation.navigate("Exam", {
      attemptId: exam.attempt_id,
      examId: exam.id
    });
  };

  const handleLogout = async () => {
    setLogoutModalVisible(false);
    try {
      const token = await getAccessToken();
      if (token) await logoutCurrentDevice(token);
    } catch (error) {
      console.error("Server logout failed:", error);
    }

    await clearTokens();
    await clearUserData();
    navigation.replace("Login");
  };

  // Filter exams based on active category
  const getFilteredExams = () => {
    const categoryKey = activeCategory;
    const showAll = showAllExams[categoryKey];

    let exams: DashboardExam[] = [];

    switch (activeCategory) {
      case 'available':
        exams = availableExams;
        break;
      case 'ongoing':
        exams = ongoingExams;
        break;
      case 'scheduled':
        exams = scheduledExams;
        break;
      case 'completed':
        exams = completedExams;
        break;
      case 'disqualified':
        exams = disqualifiedExams;
        break;
      default:
        exams = [
          ...ongoingExams,
          ...availableExams,
          ...scheduledExams,
          ...completedExams,
          ...disqualifiedExams
        ];
        break;
    }
    console.log("Exams in selected category:", exams);
    // Return all or limited based on showAll state
    return showAll ? exams : exams.slice(0, 5);
  };

  // Toggle show all for current category
  const toggleShowAll = () => {
    setShowAllExams(prev => ({
      ...prev,
      [activeCategory]: !prev[activeCategory]
    }));
  };

  // Get category stats
  const getCategoryStats = (category: ExamCategory | 'all') => {
    switch (category) {
      case 'available': return availableExams.length;
      case 'ongoing': return ongoingExams.length;
      case 'scheduled': return scheduledExams.length;
      case 'completed': return completedExams.length;
      case 'disqualified': return disqualifiedExams.length;
      case 'all':
        return availableExams.length + ongoingExams.length + scheduledExams.length +
          completedExams.length + disqualifiedExams.length;
      default: return 0;
    }
  };

  // Exam Card Component
  const ExamCard = ({ exam, index }: { exam: DashboardExam; index: number }) => {
    const statusInfo = getExamStatusInfo(exam);
    const isStarting = startingExamId === exam.id;
    console.log("Rendering ExamCard for exam ID:", exam.id, "Status:", statusInfo.status);

    return (
      <Animated.View
        style={[
          styles.examCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <LinearGradient
            colors={statusInfo.gradient}
            style={styles.examIconContainer}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color={statusInfo.color} />
            ) : (
              <Icon name={statusInfo.icon} size={24} color={statusInfo.color} />
            )}
          </LinearGradient>

          <View style={styles.examInfo}>
            <Text style={styles.examTitle} numberOfLines={1}>
              {exam.title}
            </Text>
            <View style={styles.examMeta}>
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '15' }]}>
                <Text style={[styles.statusText, { color: statusInfo.color }]}>
                  {statusInfo.text}
                </Text>
              </View>
              <Text style={styles.examMarks}>
                • {exam.total_marks} marks
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {statusInfo.status === 'ongoing' && exam.can_resume && !isStarting && (
              <TouchableOpacity
                style={[styles.actionButton, styles.resumeButton]}
                onPress={() => handleResumeExam(exam)}
              >
                <Icon name="play" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {/* Available exams show START button */}
            {statusInfo.status === 'available' && !isStarting && (
              <TouchableOpacity
                style={[styles.actionButton, styles.startButton]}
                onPress={() => handleStartButtonClick(exam)}
              >
                <Icon name="play" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {/* Scheduled exams show info button */}
            {statusInfo.status === 'scheduled' && !isStarting && (
              <TouchableOpacity
                style={[styles.actionButton, styles.infoButton]}
                onPress={() => showExamDetails(exam)}
              >
                <Icon name="information" size={20} color="#3B82F6" />
              </TouchableOpacity>
            )}

            {statusInfo.status === 'completed' && !isStarting && (
              <TouchableOpacity
                style={[styles.actionButton, styles.resultsButton]}
                onPress={() => handleViewResults(exam)}
              >
                <Icon name="chart-bar" size={20} color="#10B981" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Card Body */}
        {!isStarting && (
          <>
            <View style={styles.cardBody}>
              {statusInfo.status === 'ongoing' && exam.time_remaining && (
                <View style={styles.timeRemaining}>
                  <Icon name="timer-sand" size={14} color="#F59E0B" />
                  <Text style={styles.timeRemainingText}>
                    {formatTimeRemaining(exam.time_remaining)}
                  </Text>
                </View>
              )}

              {statusInfo.status === 'completed' && exam.score !== undefined && (
                <TouchableOpacity
                  style={styles.scoreContainer}
                  onPress={() => handleViewResults(exam)}
                >
                  <Icon name="trophy" size={14} color="#10B981" />
                  <Text style={styles.scoreText}>
                    Score: {exam.score}/{exam.total_marks} ({exam.percentage}%)
                  </Text>
                  <Icon name="chevron-right" size={14} color="#10B981" />
                </TouchableOpacity>
              )}

              <View style={styles.examStats}>
                <View style={styles.statItem}>
                  <Icon name="help-circle-outline" size={14} color="#64748B" />
                  <Text style={styles.statText}>{exam.total_questions} Qs</Text>
                </View>
                <View style={styles.statItem}>
                  <Icon name="clock-outline" size={14} color="#64748B" />
                  <Text style={styles.statText}>{formatDuration(exam.duration_minutes || 60)}</Text>
                </View>
                {exam.violations_count !== undefined && exam.violations_count > 0 && (
                  <View style={styles.statItem}>
                    <Icon name="alert" size={14} color="#EF4444" />
                    <Text style={[styles.statText, { color: '#EF4444' }]}>
                      {exam.violations_count} violation{exam.violations_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Card Footer */}
            <View style={styles.cardFooter}>
              {exam.submitted_at && (
                <View style={styles.submittedInfo}>
                  <Icon name="check-circle" size={12} color="#94A3B8" />
                  <Text style={styles.submittedText}>
                    Submitted on {formatDate(exam.submitted_at)}
                  </Text>
                </View>
              )}
              {exam.started_at && !exam.submitted_at && (
                <View style={styles.submittedInfo}>
                  <Icon name="clock-start" size={12} color="#94A3B8" />
                  <Text style={styles.submittedText}>
                    Started on {formatDate(exam.started_at)}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Loading Overlay */}
        {isStarting && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={styles.loadingText}>Preparing exam...</Text>
          </View>
        )}
      </Animated.View>
    );
  };

  // Category Filter Tabs
  const CategoryTab = ({ category, label }: { category: ExamCategory | 'all', label: string }) => {
    const isActive = activeCategory === category;
    const count = getCategoryStats(category);

    return (
      <TouchableOpacity
        style={[styles.categoryTab, isActive && styles.activeCategoryTab]}
        onPress={() => setActiveCategory(category)}
      >
        <Text style={[styles.categoryText, isActive && styles.activeCategoryText]}>
          {label}
        </Text>
        <View style={[styles.categoryCount, isActive && styles.activeCategoryCount]}>
          <Text style={[styles.categoryCountText, isActive && styles.activeCategoryCountText]}>
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Loading State
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingTitle}>Loading Dashboard</Text>
          <Text style={styles.loadingSubtitle}>Preparing your exam overview...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate if we need show more button
  const totalExamsInCategory = getCategoryStats(activeCategory);
  const showingExamsCount = getFilteredExams().length;
  const needsShowMore = totalExamsInCategory > 5;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFC']}
        style={styles.header}
      >
        <View style={styles.userSection}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['#3B82F6', '#1D4ED8']}
              style={styles.avatar}
            >
              <Icon name="account" size={28} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>
              {dashboardData?.student_info?.name || user?.full_name || "Student"}
            </Text>
            <View style={styles.instituteBadge}>
              <Icon name="school" size={12} color="#64748B" />
              <Text style={styles.instituteText} numberOfLines={1}>
                {dashboardData?.student_info?.institute || user?.institute?.name || user?.institute_name || "Institute"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setLogoutModalVisible(true)}
            style={styles.logoutButton}
          >
            <Icon name="logout" size={22} color="#64748B" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Main Content */}
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
        {/* Welcome Card */}
        <LinearGradient
          colors={['#3B82F6', '#1D4ED8']}
          style={styles.welcomeCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.welcomeContent}>
            <Text style={styles.welcomeTitle}>Exam Dashboard</Text>
            <Text style={styles.welcomeSubtitle}>
              {ongoingExams.length > 0
                ? `You have ${ongoingExams.length} exam${ongoingExams.length !== 1 ? 's' : ''} in progress`
                : availableExams.length > 0
                  ? `${availableExams.length} exam${availableExams.length !== 1 ? 's' : ''} available to start`
                  : 'No active exams at the moment'
              }
            </Text>
          </View>
          <View style={styles.welcomeIcon}>
            <Icon name="book-education" size={40} color="#FFFFFF" />
          </View>
        </LinearGradient>

        {/* Compact Performance Stats */}
        {stats && (
          <View style={styles.compactStatsContainer}>
            <View style={styles.compactStatsHeader}>
              <Text style={styles.compactStatsTitle}>Performance Overview</Text>
              <Icon name="trending-up" size={20} color="#3B82F6" />
            </View>

            <View style={styles.compactStatsGrid}>
              <View style={styles.compactStatItem}>
                <View style={styles.compactStatIconContainer}>
                  <Icon name="book-open-page-variant" size={18} color="#1D4ED8" />
                </View>
                <View style={styles.compactStatContent}>
                  <Text style={styles.compactStatValue}>{stats.total_exams_attempted}</Text>
                  <Text style={styles.compactStatLabel}>Exams Taken</Text>
                </View>
              </View>

              <View style={styles.compactStatItem}>
                <View style={[styles.compactStatIconContainer, { backgroundColor: '#D1FAE5' }]}>
                  <Icon name="chart-line" size={18} color="#065F46" />
                </View>
                <View style={styles.compactStatContent}>
                  <Text style={styles.compactStatValue}>{stats.average_score.toFixed(1)}%</Text>
                  <Text style={styles.compactStatLabel}>Avg Score</Text>
                </View>
              </View>

              <View style={styles.compactStatItem}>
                <View style={[styles.compactStatIconContainer, { backgroundColor: '#FEF3C7' }]}>
                  <Icon name="trophy" size={18} color="#92400E" />
                </View>
                <View style={styles.compactStatContent}>
                  <Text style={styles.compactStatValue}>#{stats.current_rank}</Text>
                  <Text style={styles.compactStatLabel}>Rank</Text>
                </View>
              </View>

              <View style={styles.compactStatItem}>
                <View style={[
                  styles.compactStatIconContainer,
                  { backgroundColor: stats.total_violations > 0 ? '#FEE2E2' : '#D1FAE5' }
                ]}>
                  <Icon
                    name="shield-check"
                    size={18}
                    color={stats.total_violations > 0 ? "#DC2626" : "#065F46"}
                  />
                </View>
                <View style={styles.compactStatContent}>
                  <Text style={[
                    styles.compactStatValue,
                    stats.total_violations > 0 && { color: '#DC2626' }
                  ]}>
                    {stats.total_violations}
                  </Text>
                  <Text style={styles.compactStatLabel}>Violations</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryTabsContainer}
          contentContainerStyle={styles.categoryTabsContent}
        >
          <CategoryTab category="all" label="All Exams" />
          <CategoryTab category="ongoing" label="Ongoing" />
          <CategoryTab category="available" label="Available" />
          <CategoryTab category="scheduled" label="Scheduled" />
          <CategoryTab category="completed" label="Completed" />
          <CategoryTab category="disqualified" label="Disqualified" />
        </ScrollView>

        {/* Exams List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {activeCategory === 'all' ? 'All Exams' :
                activeCategory === 'completed' ? 'Completed Exams' :
                  activeCategory === 'ongoing' ? 'Ongoing Exams' :
                    activeCategory === 'available' ? 'Available Exams' :
                      activeCategory === 'scheduled' ? 'Scheduled Exams' : 'Disqualified Exams'}
            </Text>
            <View style={styles.sectionRightHeader}>
              <Text style={styles.sectionCount}>
                {totalExamsInCategory} exam{totalExamsInCategory !== 1 ? 's' : ''}
              </Text>
              {needsShowMore && (
                <TouchableOpacity onPress={toggleShowAll}>
                  <Text style={styles.viewToggleText}>
                    {showAllExams[activeCategory] ? 'Show Less' : 'View All'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {getFilteredExams().length > 0 ? (
            <>
              {getFilteredExams().map((exam, index) => (
                console.log("Displaying exam:", exam),
                <ExamCard
                  key={`${exam.id}-${exam.attempt_id || index}-${activeCategory}`}
                  exam={exam}
                  index={index}
                />
              ))}

              {/* Show More/Less Button */}
              {needsShowMore && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={toggleShowAll}
                >
                  <Text style={styles.showMoreText}>
                    {showAllExams[activeCategory]
                      ? `Show less (Showing ${showingExamsCount} of ${totalExamsInCategory})`
                      : `View all ${totalExamsInCategory} exams (Showing ${showingExamsCount} of ${totalExamsInCategory})`}
                  </Text>
                  <Icon
                    name={showAllExams[activeCategory] ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#3B82F6"
                  />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="book-open-blank-variant" size={80} color="#E2E8F0" />
              <Text style={styles.emptyTitle}>
                {activeCategory === 'all' ? 'No Exams Available' :
                  activeCategory === 'completed' ? 'No Completed Exams' :
                    activeCategory === 'ongoing' ? 'No Ongoing Exams' :
                      activeCategory === 'available' ? 'No Available Exams' :
                        activeCategory === 'scheduled' ? 'No Scheduled Exams' : 'No Disqualified Exams'}
              </Text>
              <Text style={styles.emptyText}>
                {activeCategory === 'all' ? 'Check back later for new exams' :
                  activeCategory === 'completed' ? 'Complete some exams to see them here' :
                    activeCategory === 'ongoing' ? 'Start an exam to see it here' :
                      activeCategory === 'available' ? 'All exams have been attempted' :
                        activeCategory === 'scheduled' ? 'No exams are scheduled yet' : 'No disqualifications'}
              </Text>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={onRefresh}
              >
                <Icon name="refresh" size={18} color="#3B82F6" />
                <Text style={styles.refreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.footerSpacer} />
      </Animated.ScrollView>

      {/* Rest of modals remain the same... */}
      {/* EXAM CONFIRMATION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          setSelectedExam(null);
          setExamDetails(null);
          setStartingExamId(null);
        }}
      >
        <View style={styles.modalContainer}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              setModalVisible(false);
              setSelectedExam(null);
              setExamDetails(null);
              setStartingExamId(null);
            }}
          />

          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            {loadingDetails ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.modalLoadingText}>Loading exam details...</Text>
              </View>
            ) : examDetails ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{examDetails.title}</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => {
                      setModalVisible(false);
                      setSelectedExam(null);
                      setExamDetails(null);
                      setStartingExamId(null);
                    }}
                  >
                    <Icon name="close" size={24} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  {examDetails.description && (
                    <Text style={styles.modalDesc}>{examDetails.description}</Text>
                  )}

                  <View style={styles.gridContainer}>
                    <DetailBox icon="help-circle-outline" label="Questions" value={examDetails.total_questions} />
                    <DetailBox icon="star-outline" label="Total Marks" value={examDetails.total_marks} />
                    <DetailBox icon="timer-sand" label="Duration" value={formatDuration(examDetails.duration_minutes)} />
                    <DetailBox icon="refresh" label="Attempts" value={examDetails.max_attempts} />
                    <DetailBox icon="shield-check-outline" label="Proctored" value={examDetails.enable_webcam_proctoring ? "Yes" : "No"} />
                    <DetailBox icon="format-list-checks" label="Pattern" value={examDetails.pattern?.name || "Standard"} />
                  </View>

                  {/* Rules Section */}
                  <View style={styles.rulesSection}>
                    <Text style={styles.rulesTitle}>Exam Rules</Text>
                    <View style={styles.rulesList}>
                      {examDetails.require_fullscreen && <RuleItem text="Fullscreen mode is required" icon="fullscreen" />}
                      {examDetails.disable_copy_paste && <RuleItem text="Copy/Paste is disabled" icon="content-copy" />}
                      {examDetails.enable_webcam_proctoring && <RuleItem text="Webcam proctoring is enabled" icon="webcam" />}
                      {examDetails.shuffle_questions && <RuleItem text="Questions are shuffled" icon="shuffle" />}
                      {examDetails.shuffle_options && <RuleItem text="Options are shuffled" icon="shuffle-variant" />}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      (!examDetails.is_question_complete || startingExamId === examDetails.id) && styles.disabledButton
                    ]}
                    disabled={!examDetails.is_question_complete || startingExamId === examDetails.id}
                    onPress={handleStartExam}
                  >
                    {startingExamId === examDetails.id ? (
                      <>
                        <ActivityIndicator color="#FFF" size="small" />
                        <Text style={[styles.primaryButtonText, { marginLeft: 10 }]}>
                          Starting Exam...
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.primaryButtonText}>Start Examination</Text>
                        <Icon name="arrow-right" size={20} color="#FFF" />
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      setModalVisible(false);
                      setSelectedExam(null);
                      setExamDetails(null);
                      setStartingExamId(null);
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <View style={{ height: 20 }} />
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
      
      {/* LOGOUT CONFIRMATION MODAL */}
      <Modal
        animationType="fade"
        transparent
        visible={logoutModalVisible}
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.logoutIconCircle}>
              <Icon name="logout-variant" size={32} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>Sign Out?</Text>
            <Text style={styles.confirmDesc}>
              You will need to enter your credentials again to access your exams.
            </Text>
            <View style={styles.confirmActionRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutBtnText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Detail Box Component
const DetailBox = ({ icon, label, value }: any) => (
  <View style={styles.detailBox}>
    <Icon name={icon} size={20} color="#3B82F6" />
    <View style={{ marginLeft: 10, flex: 1 }}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

// Rule Item Component
const RuleItem = ({ text, icon }: any) => (
  <View style={styles.ruleItem}>
    <Icon name={icon} size={16} color="#64748B" />
    <Text style={styles.ruleText}>{text}</Text>
  </View>
);

// Styles remain exactly the same... 
// (Copy all your existing styles here - they're unchanged)


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingTitle: {
    fontSize: 18,
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 20 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  instituteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: SCREEN_WIDTH - 160,
  },
  instituteText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginLeft: 4,
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginLeft: 'auto',
  },
  scrollView: {
    flex: 1,
  },
  welcomeCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  welcomeContent: {
    flex: 1,
    marginRight: 16,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#E0F2FE',
    fontWeight: '500',
    lineHeight: 22,
  },
  welcomeIcon: {
    opacity: 0.9,
  },
  // Compact Performance Stats
  compactStatsContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  compactStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  compactStatsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  compactStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  compactStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 12,
  },
  compactStatIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  compactStatContent: {
    flex: 1,
  },
  compactStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
  },
  compactStatLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionRightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  categoryTabsContainer: {
    marginTop: 20,
  },
  categoryTabsContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeCategoryTab: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 6,
  },
  activeCategoryText: {
    color: '#FFFFFF',
  },
  categoryCount: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  activeCategoryCount: {
    backgroundColor: '#1D4ED8',
  },
  categoryCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  activeCategoryCountText: {
    color: '#FFFFFF',
  },
  examCard: {
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
    position: 'relative',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  examIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  examInfo: {
    flex: 1,
  },
  examTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  examMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  examMarks: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  resumeButton: {
    backgroundColor: "#F59E0B",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  startButton: {
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  infoButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  resultsButton: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  cardBody: {
    marginBottom: 12,
  },
  timeRemaining: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  timeRemainingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B45309',
    marginLeft: 6,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
    marginHorizontal: 6,
  },
  examStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginLeft: 4,
  },
  cardFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  submittedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submittedText: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
    marginTop: 8,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  showMoreText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
    marginRight: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  refreshText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
    marginLeft: 8,
  },
  footerSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalOverlayPressable: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalBackdrop: {
    position: 'absolute', // ADD THIS
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    minHeight: SCREEN_HEIGHT * 0.8, // ADD THIS to ensure minimum height
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
    paddingBottom: 0, // ADD THIS
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  closeButton: {
    padding: 4,
  },
  modalLoading: {
    alignItems: 'center',
    padding: 40,
  },
  modalLoadingText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
  },
  modalError: {
    alignItems: 'center',
    padding: 40,
  },
  modalErrorText: {
    fontSize: 16,
    color: '#EF4444',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 24,
    paddingTop: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20, // ADD THIS for safe area
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    flex: 1,
    marginRight: 10,
  },
  modalDesc: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  detailBox: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  rulesSection: {
    marginTop: 20,
  },
  rulesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  rulesList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ruleText: {
    fontSize: 13,
    color: '#475569',
    marginLeft: 10,
    flex: 1,
    fontWeight: '500',
  },
  warningBox: {
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FEF3C7'
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    marginLeft: 12,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 10
  },
  secondaryButton: {
    backgroundColor: '#F8FAFC',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryButtonText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#CBD5E1',
    shadowColor: '#CBD5E1',
  },
  confirmBox: {
    backgroundColor: '#FFF',
    margin: 24,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  logoutIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FECACA',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  confirmDesc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 15,
  },
  logoutBtn: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#DC2626',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  }
});