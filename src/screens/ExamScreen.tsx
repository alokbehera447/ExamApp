// ExamScreen.tsx - Updated with ViolationModal integration
import React, { useState, useEffect, useRef } from "react";
import { useProctoring } from '../hooks/useProctoring';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import ViolationModal from '../components/ViolationModal';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  BackHandler,
  TextInput,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import {
  getExamAttempt,
  ExamAttempt,
  getExamQuestions,
  Question,
  submitAnswer,
  submitExam as submitExamApi,
  SubmitExamPayload,
  AnswerWithTime,
} from "../api/examApi";
import {
  Clock,
  Flag,
  CheckCircle,
  AlertTriangle,
  Save,
  Send,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  User,
  ShieldCheck,
  Pause,
  Layout,
  Info as InfoIcon,
  CircleCheck,
  CircleAlert,
  Menu,
} from 'lucide-react-native';
import LaTeXRenderer from '../components/LaTeXRenderer';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');
const isSmallDevice = width < 375;

type ExamScreenRouteProp = RouteProp<{ Exam: { attemptId: number; examId: number } }, 'Exam'>;

interface UserAnswer {
  questionId: number;
  answer: string;
  isFlagged: boolean;
  timeSpent: number;
  startTime: number;
}

export default function ExamScreen() {
  const route = useRoute<ExamScreenRouteProp>();
  const navigation = useNavigation();
  const { attemptId, examId } = route.params;

  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, UserAnswer>>({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  // Section/Subject states
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [questionsBySubject, setQuestionsBySubject] = useState<Record<string, Question[]>>({});

  const scrollViewRef = useRef<ScrollView>(null);
  const timerRef = useRef<any>(null);
  const autoSaveTimeoutRef = useRef<any>(null);
  const cameraRef = useRef<Camera>(null);

  // Get front camera device
  const device = useCameraDevice('front');

  // Initialize proctoring hook - NOW INCLUDES violationModal and closeViolationModal
  const {
    snapshotCount,
    lastSnapshotTime,
    isTakingSnapshot,
    violationCount,
    cameraReady,
    hasPermission,
    violationModal,        // ← ADD THIS
    setCameraRef,
    closeViolationModal,   // ← ADD THIS
  } = useProctoring(
    attemptId,
    attempt?.proctoring_enabled || false
  );

  // Set camera ref when camera is ready
  useEffect(() => {
    if (cameraRef.current && attempt?.proctoring_enabled && device) {
      setCameraRef(cameraRef.current);
    }
  }, [cameraRef.current, attempt?.proctoring_enabled, device]);

  useEffect(() => {
    if (!examId) {
      Alert.alert("Error", "Exam ID is missing");
      navigation.goBack();
      return;
    }

    loadExamData();

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress
    );

    return () => {
      backHandler.remove();
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [examId]);

  useEffect(() => {
    if (attempt?.time_remaining) {
      setTimeRemaining(Math.floor(attempt.time_remaining));

      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 0) {
            clearInterval(timer);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [attempt]);

  // Track time spent on current question
  useEffect(() => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setQuestionStartTime(Date.now());

    return () => {
      const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
      updateQuestionTime(currentQuestion.id, timeSpent);
    };
  }, [currentQuestionIndex, questions]);

  const updateQuestionTime = (questionId: number, additionalTime: number) => {
    setUserAnswers(prev => {
      const existing = prev[questionId];
      if (existing) {
        return {
          ...prev,
          [questionId]: {
            ...existing,
            timeSpent: existing.timeSpent + additionalTime,
          }
        };
      }
      return prev;
    });
  };

  const loadExamData = async () => {
    try {
      setLoading(true);

      const attemptData = await getExamAttempt(attemptId);
      setAttempt(attemptData);

      const questionsData = await getExamQuestions(attemptId, examId);

      // Robust sorting: Subject -> Section -> Question Number
      const sortedQuestions = questionsData.results.sort((a, b) => {
        // 1. Sort by subject (normalized)
        const subA = (a.subject || "General").toLowerCase();
        const subB = (b.subject || "General").toLowerCase();
        if (subA !== subB) return subA.localeCompare(subB);

        // 2. Sort by section ID if available
        if (a.pattern_section_id !== b.pattern_section_id) {
          return (a.pattern_section_id || 0) - (b.pattern_section_id || 0);
        }

        // 3. Sort by question number within the exam or pattern
        const numA = a.question_number || a.question_number_in_pattern || 0;
        const numB = b.question_number || b.question_number_in_pattern || 0;
        return numA - numB;
      });

      setQuestions(sortedQuestions);

      // Group questions by subject and extract unique subjects (normalized)
      const grouped: Record<string, Question[]> = {};
      const uniqueSubjects: string[] = [];
      const examSections = attemptData.exam.pattern?.sections || [];
      setSections(examSections);

      sortedQuestions.forEach(q => {
        // Normalize subject to Title Case for consistent display
        const rawSubject = q.subject || "General";
        const subject = rawSubject.charAt(0).toUpperCase() + rawSubject.slice(1).toLowerCase();

        if (!grouped[subject]) {
          grouped[subject] = [];
          uniqueSubjects.push(subject);
        }
        grouped[subject].push(q);
      });

      setQuestionsBySubject(grouped);
      setSubjects(uniqueSubjects);

      if (uniqueSubjects.length > 0) {
        setSelectedSubject(uniqueSubjects[0]);
      }

      console.log(`Loaded ${sortedQuestions.length} questions across ${uniqueSubjects.length} subjects for exam ${examId}`);

    } catch (error: any) {
      console.error("Error loading exam data:", error);
      Alert.alert("Error", "Failed to load exam data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    Alert.alert(
      "Leave Exam",
      "Are you sure you want to leave the exam? All unsaved progress will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => navigation.goBack()
        }
      ]
    );
    return true;
  };

  const handleAutoSubmit = async () => {
    Alert.alert("Time's Up!", "The exam time has ended. Auto-submitting your answers...");
    await submitExam();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const autoSaveAnswer = async (questionId: number, answer: string, isFlagged: boolean = false) => {
    try {
      setAutoSaving(true);

      const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);

      setUserAnswers(prev => {
        const existing = prev[questionId];
        return {
          ...prev,
          [questionId]: {
            questionId,
            answer,
            isFlagged,
            timeSpent: existing ? existing.timeSpent + timeSpent : timeSpent,
            startTime: existing ? existing.startTime : questionStartTime,
          }
        };
      });

      setQuestionStartTime(Date.now());

      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setTimeout(async () => {
        try {
          await submitAnswer(attemptId, questionId, answer, isFlagged);
          const now = new Date();
          setLastSaved(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          console.log(`Auto-saved answer for question ${questionId}`);
        } catch (error) {
          console.error("Error auto-saving answer:", error);
          Alert.alert("Save Error", "Failed to auto-save your answer. Please check your connection.");
        } finally {
          setAutoSaving(false);
        }
      }, 1000);

    } catch (error) {
      console.error("Error in auto-save:", error);
      setAutoSaving(false);
    }
  };

  const submitExam = async () => {
    try {
      setSubmitting(true);

      const currentQuestion = questions[currentQuestionIndex];
      if (currentQuestion) {
        const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
        updateQuestionTime(currentQuestion.id, timeSpent);
      }

      const answersForSubmit: Record<string, AnswerWithTime> = {};

      Object.values(userAnswers).forEach((userAnswer) => {
        answersForSubmit[userAnswer.questionId.toString()] = {
          question_id: userAnswer.questionId,
          answer: userAnswer.answer,
          is_flagged: userAnswer.isFlagged,
          time_spent: userAnswer.timeSpent,
        };
      });

      const payload: SubmitExamPayload = {
        attempt_id: attemptId,
        answers: answersForSubmit,
      };

      console.log('Submitting exam with payload:', payload);

      const response = await submitExamApi(payload);

      console.log('Exam submitted successfully:', response);

      Alert.alert(
        "Exam Submitted",
        response.message || "Your exam has been submitted. You can view your results in the dashboard.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      console.error("Error submitting exam:", error);
      Alert.alert("Submission Error", error.response?.data?.message || "Failed to submit exam. Please try again.");
    } finally {
      setSubmitting(false);
      setShowSubmitModal(false);
    }
  };

  const navigateToQuestion = (index: number) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (currentQuestion) {
      const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
      updateQuestionTime(currentQuestion.id, timeSpent);
    }

    const targetQuestion = questions[index];
    if (targetQuestion && targetQuestion.subject !== selectedSubject) {
      setSelectedSubject(targetQuestion.subject);
    }

    setCurrentQuestionIndex(index);
    setQuestionStartTime(Date.now());
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const getQuestionStatus = (questionId: number) => {
    const answer = userAnswers[questionId];
    if (!answer) return "unanswered";
    if (answer.isFlagged) return "flagged";
    if (answer.answer.trim() !== "") return "answered";
    return "unanswered";
  };

  const getQuestionStatusColor = (status: string) => {
    switch (status) {
      case "answered": return "#10B981";
      case "flagged": return "#EF4444";
      case "unanswered": return "#64748B";
      default: return "#64748B";
    }
  };

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case "single_mcq": return <CircleCheck size={14} color="#2563EB" />;
      case "multiple_mcq": return <Layout size={14} color="#2563EB" />;
      case "numerical": return <InfoIcon size={14} color="#2563EB" />;
      case "subjective": return <Layout size={14} color="#2563EB" />;
      default: return <InfoIcon size={14} color="#2563EB" />;
    }
  };

  const renderQuestion = (question: Question, index: number) => {
    const currentAnswer = userAnswers[question.id]?.answer || "";
    const isFlagged = userAnswers[question.id]?.isFlagged || false;

    return (
      <View style={styles.questionMainWrapper}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.flex1}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Question Board */}
          <View style={styles.questionBoard}>
            {/* Question Header */}
            <View style={styles.questionHeader}>
              <View style={styles.questionHeaderTop}>
                <View style={styles.questionLabelWrapper}>
                  <View style={styles.questionIndexBadge}>
                    <Text style={styles.questionIndexText}>Q{index + 1}</Text>
                  </View>
                  <Text style={styles.questionHeaderText}>Question {index + 1}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => autoSaveAnswer(question.id, currentAnswer, !isFlagged)}
                  style={[styles.flagBtn, isFlagged ? styles.flagBtnActive : styles.flagBtnInactive]}
                >
                  <Flag size={14} color={isFlagged ? "#D97706" : "#64748B"} fill={isFlagged ? "#D97706" : "none"} />
                  <Text style={[styles.flagBtnText, isFlagged ? styles.flagBtnTextActive : styles.flagBtnTextInactive]}>
                    {isFlagged ? 'Flagged' : 'Review'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.questionSubHeader}>
                <View style={styles.subjectBadge}>
                  <Text style={styles.subjectBadgeText}>{question.subject}</Text>
                </View>
                {question.pattern_section_name && (
                  <Text style={styles.sectionInfoText}>
                    • {question.pattern_section_name}
                  </Text>
                )}
                <View style={styles.flex1} />
                <View style={styles.marksLabelBadge}>
                  <Text style={styles.marksLabelText}>+{question.marks} Marks</Text>
                </View>
              </View>
            </View>

            {/* Question Content */}
            <View style={styles.questionContentBody}>
              <View style={styles.questionTextContainer}>
                <LaTeXRenderer content={question.question_text} />
              </View>

              {/* Nested Structure (Parts/Choices) */}
              {question.structure?.is_nested && (
                <View style={styles.nestedStructureContainer}>
                  {question.structure.parts?.map((part: any, pIdx: number) => (
                    <View key={pIdx} style={styles.nestedPart}>
                      <View style={styles.nestedPartHeader}>
                        <Text style={styles.nestedPartTitle}>Part {part.label || String.fromCharCode(65 + pIdx)}</Text>
                        {part.marks && <Text style={styles.nestedPartMarks}>+{part.marks} Marks</Text>}
                      </View>
                      <LaTeXRenderer content={part.question_text} />
                    </View>
                  ))}
                </View>
              )}

              {/* Options for MCQ */}
              {['single_mcq', 'multiple_mcq'].includes(question.question_type) && (
                <View style={styles.optionsList}>
                  {question.options.map((option, optionIndex) => {
                    const isSelected = question.question_type === 'single_mcq'
                      ? currentAnswer === option
                      : currentAnswer.split('|').includes(option);

                    return (
                      <TouchableOpacity
                        key={optionIndex}
                        onPress={() => {
                          let newAnswer = "";
                          if (question.question_type === 'single_mcq') {
                            newAnswer = option;
                          } else {
                            const answers = currentAnswer ? currentAnswer.split('|') : [];
                            if (answers.includes(option)) {
                              newAnswer = answers.filter(a => a !== option).join('|');
                            } else {
                              newAnswer = [...answers, option].join('|');
                            }
                          }
                          autoSaveAnswer(question.id, newAnswer, isFlagged);
                        }}
                        style={[styles.optionItem, isSelected ? styles.optionItemActive : styles.optionItemInactive]}
                      >
                        <View style={[styles.optionCircle, isSelected ? styles.optionCircleActive : styles.optionCircleInactive]}>
                          <Text style={[styles.optionLabelText, isSelected && styles.whiteText]}>
                            {String.fromCharCode(65 + optionIndex)}
                          </Text>
                        </View>
                        <View style={styles.flex1}>
                          <LaTeXRenderer content={option} />
                        </View>
                        {isSelected && <CircleCheck size={20} color="#2563EB" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Input for Numerical/Subjective */}
              {['numerical', 'subjective'].includes(question.question_type) && (
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputTitle}>Your Response</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      question.question_type === 'subjective' ? styles.textArea : null
                    ]}
                    value={currentAnswer}
                    onChangeText={(text) => autoSaveAnswer(question.id, text, isFlagged)}
                    placeholder={`Type your ${question.question_type === 'numerical' ? 'numerical' : 'detailed'} answer...`}
                    placeholderTextColor="#94A3B8"
                    multiline={question.question_type === 'subjective'}
                    keyboardType={question.question_type === 'numerical' ? 'decimal-pad' : 'default'}
                  />
                  {question.question_type === 'numerical' && (
                    <Text style={styles.inputNote}>Note: Only numerical values are allowed.</Text>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Question Footer Info */}
          <View style={styles.questionFooterInfo}>
            <View style={styles.saveStatusRow}>
              {autoSaving ? (
                <View style={styles.saveStatusRow}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.syncingText}>Syncing...</Text>
                </View>
              ) : lastSaved ? (
                <View style={styles.saveStatusRow}>
                  <Save size={14} color="#10B981" />
                  <Text style={styles.savedTextDraft}>Draft Saved {lastSaved}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrapper}>
        <View style={styles.loadingInner}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingTitle}>PREPARING EXAM</Text>
          <Text style={styles.loadingSubtext}>
            Securing your connection and syncing assessment data...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.errorFullWrapper}>
        <View style={styles.errorIconBox}>
          <CircleAlert size={40} color="#EF4444" />
        </View>
        <Text style={styles.errorFullTitle}>ACCESS RESTRICTED</Text>
        <Text style={styles.errorFullText}>
          Questions could not be loaded. Please ensure you have an active connection and proper authorization.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.errorBackBtn}
        >
          <ChevronLeft size={20} color="white" />
          <Text style={styles.errorBackBtnText}>Back to Portal</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const answeredCount = Object.keys(userAnswers).filter(id =>
    userAnswers[parseInt(id)]?.answer?.trim() !== ""
  ).length;
  const flaggedCount = Object.keys(userAnswers).filter(id =>
    userAnswers[parseInt(id)]?.isFlagged
  ).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />

      {/* Premium Header */}
      <LinearGradient
        colors={['#1e293b', '#0f172a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.premiumHeader}
      >
        <View style={styles.headerTitleContainer}>
          <View style={styles.headerIconWrapper}>
            <ShieldCheck size={16} color="#38bdf8" />
          </View>
          <View>
            <Text style={styles.headerTextMain}>SECURE ASSESSMENT</Text>
            <View style={styles.headerStatusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Live & Encrypted</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRightControls}>
          <View style={[styles.timerBadge, timeRemaining < 300 && styles.timerBadgeLow]}>
            <Clock size={14} color={timeRemaining < 300 ? "#ffffff" : "#38bdf8"} />
            <Text style={[styles.timerValue, timeRemaining < 300 && styles.timerLow]}>
              {formatTime(timeRemaining)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowSubmitModal(true)}
            style={styles.submitButtonHeader}
          >
            <Send size={14} color="white" />
            <Text style={styles.submitButtonText}>Finish</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Subject Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          {subjects.map((subject) => {
            const isSelected = selectedSubject === subject;
            const subjectQuestions = questionsBySubject[subject] || [];
            const answeredInSubject = subjectQuestions.filter(q =>
              userAnswers[q.id]?.answer?.trim() !== ""
            ).length;

            return (
              <TouchableOpacity
                key={subject}
                onPress={() => setSelectedSubject(subject)}
                style={[styles.tabButton, isSelected && styles.tabButtonActive]}
              >
                <Text style={[styles.tabButtonText, isSelected && styles.tabButtonTextActive]}>
                  {subject}
                </Text>
                <View style={[styles.countBadge, isSelected ? styles.countBadgeActive : styles.countBadgeInactive]}>
                  <Text style={[styles.countText, isSelected && styles.countTextActive]}>
                    {answeredInSubject}/{subjectQuestions.length}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Violation Status Bar (if proctoring enabled) */}
      {attempt?.proctoring_enabled && (
        <TouchableOpacity
          onPress={violationModal.visible ? undefined : () => { }}
          style={[styles.violationBar, violationCount > 3 ? styles.violationBarCritical : styles.violationBarSafe]}
        >
          <View style={styles.violationBarLeft}>
            <AlertTriangle size={12} color={violationCount > 3 ? "#ef4444" : "#10b981"} />
            <Text style={[styles.violationBarText, violationCount > 3 ? styles.violationBarTextCritical : styles.violationBarTextSafe]}>
              SECURE MONITORING {violationCount > 3 ? '(CRITICAL)' : '(ACTIVE)'}
            </Text>
          </View>
          <View style={styles.violationCounterBadge}>
            <Text style={[styles.violationBarCount, violationCount > 3 ? styles.violationBarCountCritical : styles.violationBarCountSafe]}>
              {violationCount} {violationCount === 1 ? 'Violation' : 'Violations'}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Question Palette / Horizontal Navigator */}
      <View style={styles.paletteContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.paletteScroll}>
          {(selectedSubject ? (questionsBySubject[selectedSubject] || []) : questions).map((q, idx) => {
            const index = questions.indexOf(q);
            const isCurrent = index === currentQuestionIndex;
            const answer = userAnswers[q.id];
            const isAnswered = answer?.answer?.trim() !== "";
            const isFlagged = answer?.isFlagged;

            return (
              <TouchableOpacity
                key={q.id}
                onPress={() => navigateToQuestion(index)}
                style={[
                  styles.paletteItem,
                  isCurrent ? styles.paletteItemCurrent :
                    isAnswered ? styles.paletteItemAnswered :
                      isFlagged ? styles.paletteItemFlagged :
                        styles.paletteItemDefault
                ]}
              >
                <Text style={[
                  styles.paletteText,
                  isCurrent ? styles.paletteTextCurrent :
                    isAnswered ? styles.paletteTextAnswered :
                      isFlagged ? styles.paletteTextFlagged :
                        styles.paletteTextDefault
                ]}>
                  {index + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content */}
      <View style={styles.flex1}>
        {questions[currentQuestionIndex] && renderQuestion(questions[currentQuestionIndex], currentQuestionIndex)}
      </View>

      {/* Persistent Footer Navigation */}
      <View style={styles.footerNav}>
        <TouchableOpacity
          onPress={() => currentQuestionIndex > 0 && navigateToQuestion(currentQuestionIndex - 1)}
          disabled={currentQuestionIndex === 0}
          style={[styles.footerBtn, styles.footerBtnPrev, currentQuestionIndex === 0 && styles.disabledOpacity]}
        >
          <ChevronLeft size={16} color={currentQuestionIndex === 0 ? "#cbd5e1" : "#64748b"} />
          <Text style={styles.footerBtnText}>Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { }} // Could open a question map/grid modal
          style={styles.footerMenuBtn}
        >
          <Layout size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => currentQuestionIndex < questions.length - 1 && navigateToQuestion(currentQuestionIndex + 1)}
          disabled={currentQuestionIndex === questions.length - 1}
          style={[
            styles.footerBtn,
            styles.footerBtnNext,
            currentQuestionIndex === questions.length - 1 && styles.disabledOpacity
          ]}
        >
          <Text style={styles.footerBtnTextNext}>
            {currentQuestionIndex === questions.length - 1 ? 'Complete' : 'Save & Next'}
          </Text>
          <ChevronRight size={16} color="white" />
        </TouchableOpacity>
      </View>

      {/* Submit Modal */}
      <Modal visible={showSubmitModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.submitModalContainer}>
            <View style={styles.submitModalHeader}>
              <View style={styles.submitModalIconWrapper}>
                <Send size={32} color="#2563EB" />
              </View>
              <Text style={styles.submitModalTitle}>Finish Assessment?</Text>
              <Text style={styles.submitModalSubtext}>
                You are about to submit your exam. Please review your attempt summary below.
              </Text>
            </View>

            <View style={styles.submitModalStats}>
              {subjects.map(subj => {
                const subjQuestions = questionsBySubject[subj] || [];
                const answered = subjQuestions.filter(q => userAnswers[q.id]?.answer?.trim() !== "").length;
                return (
                  <View key={subj} style={styles.submitStatRow}>
                    <Text style={styles.submitStatLabel}>{subj}</Text>
                    <Text style={styles.submitStatValue}>{answered} / {subjQuestions.length}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.submitModalButtons}>
              <TouchableOpacity
                onPress={() => setShowSubmitModal(false)}
                style={styles.submitCancelBtn}
              >
                <Text style={styles.submitCancelBtnText}>Review</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitExam}
                style={styles.submitConfirmBtn}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitConfirmBtnText}>Submit Exam</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Violation Modal */}
      <ViolationModal
        visible={violationModal.visible}
        onClose={closeViolationModal}
        violationType={violationModal.violationType}
        violationTitle={violationModal.violationTitle}
        violationMessage={violationModal.violationMessage}
        totalViolations={violationCount}
        isDisqualified={violationModal.isDisqualified}
      />

      {/* Hidden Camera for Proctoring */}
      {attempt?.proctoring_enabled && device && (
        <View style={styles.hiddenCameraContainer}>
          <Camera
            ref={cameraRef}
            style={styles.hiddenCamera}
            device={device}
            isActive={true}
            photo={true}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  flex1: {
    flex: 1,
  },
  whiteText: {
    color: '#FFFFFF',
  },
  disabledOpacity: {
    opacity: 0.3,
  },
  // Header Styles
  premiumHeader: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTextMain: {
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
    marginRight: 5,
  },
  statusText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  timerBadgeLow: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  timerValue: {
    marginLeft: 6,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    color: '#f1f5f9',
  },
  timerLow: {
    color: '#ffffff',
  },
  submitButtonHeader: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  // Subject Tabs
  tabsContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tabsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  tabButtonText: {
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: '#1d4ed8',
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  countBadgeActive: {
    backgroundColor: '#3b82f6',
  },
  countBadgeInactive: {
    backgroundColor: '#e2e8f0',
  },
  countText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  countTextActive: {
    color: '#ffffff',
  },
  // Violation Bar
  violationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  violationBarSafe: {
    backgroundColor: '#f0fdf4',
    borderBottomColor: '#dcfce7',
  },
  violationBarCritical: {
    backgroundColor: '#fef2f2',
    borderBottomColor: '#fee2e2',
  },
  violationBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  violationBarText: {
    marginLeft: 6,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  violationBarTextSafe: {
    color: '#166534',
  },
  violationBarTextCritical: {
    color: '#991b1b',
  },
  violationCounterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  violationBarCount: {
    fontSize: 9,
    fontWeight: '800',
  },
  violationBarCountSafe: {
    color: '#166534',
  },
  violationBarCountCritical: {
    color: '#991b1b',
  },
  // Palette Styles
  paletteContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 10,
  },
  paletteScroll: {
    paddingHorizontal: 16,
  },
  paletteItem: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1.5,
  },
  paletteItemDefault: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  paletteItemCurrent: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
    transform: [{ scale: 1.05 }],
    elevation: 4,
  },
  paletteItemAnswered: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  paletteItemFlagged: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  paletteText: {
    fontWeight: '800',
    fontSize: 12,
  },
  paletteTextDefault: {
    color: '#94a3b8',
  },
  paletteTextCurrent: {
    color: '#ffffff',
  },
  paletteTextAnswered: {
    color: '#166534',
  },
  paletteTextFlagged: {
    color: '#92400e',
  },
  // Question Board
  questionMainWrapper: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  questionBoard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  questionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fafafa',
  },
  questionHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  questionLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionIndexBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  questionIndexText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 10,
  },
  questionHeaderText: {
    color: '#1e293b',
    fontWeight: '800',
    fontSize: 13,
  },
  flagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  flagBtnInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  flagBtnActive: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  flagBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  flagBtnTextInactive: {
    color: '#64748b',
  },
  flagBtnTextActive: {
    color: '#92400e',
  },
  questionSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    marginRight: 10,
  },
  subjectBadgeText: {
    color: '#1d4ed8',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionInfoText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  marksLabelBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  marksLabelText: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  questionContentBody: {
    padding: 20,
  },
  questionTextContainer: {
    marginBottom: 24,
  },
  nestedStructureContainer: {
    marginTop: 12,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  nestedPart: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  nestedPartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nestedPartTitle: {
    fontWeight: '800',
    color: '#334155',
    fontSize: 12,
  },
  nestedPartMarks: {
    fontSize: 9,
    fontWeight: '800',
    color: '#3b82f6',
  },
  optionsList: {
    gap: 10,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  optionItemInactive: {
    borderColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  optionItemActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  optionCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionCircleInactive: {
    borderColor: '#e2e8f0',
  },
  optionCircleActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  optionLabelText: {
    fontWeight: '800',
    fontSize: 11,
    color: '#94a3b8',
  },
  inputWrapper: {
    marginTop: 12,
  },
  inputTitle: {
    color: '#64748b',
    fontWeight: '800',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 2,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: '#1e293b',
    fontWeight: '700',
    fontSize: 15,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  inputNote: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 6,
    marginLeft: 2,
    fontStyle: 'italic',
  },
  questionFooterInfo: {
    paddingBottom: 40,
  },
  saveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncingText: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '600',
  },
  savedTextDraft: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
  },
  // Footer Nav
  footerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  footerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  footerBtnPrev: {
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  footerBtnNext: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
    paddingHorizontal: 24,
  },
  footerBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  footerBtnTextNext: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
    marginRight: 6,
  },
  footerMenuBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  // Loading & Error States
  loadingWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingInner: {
    alignItems: 'center',
  },
  loadingTitle: {
    color: '#1e293b',
    fontWeight: '900',
    fontSize: 18,
    marginTop: 20,
    letterSpacing: 2,
  },
  loadingSubtext: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  errorFullWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorIconBox: {
    width: 70,
    height: 70,
    backgroundColor: '#fef2f2',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  errorFullTitle: {
    color: '#b91c1c',
    fontWeight: '900',
    fontSize: 20,
    textAlign: 'center',
  },
  errorFullText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    fontSize: 14,
  },
  errorBackBtn: {
    marginTop: 32,
    backgroundColor: '#1e293b',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorBackBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  // Submit Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  submitModalContainer: {
    backgroundColor: '#ffffff',
    width: '100%',
    borderRadius: 30,
    padding: 24,
  },
  submitModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  submitModalIconWrapper: {
    width: 56,
    height: 56,
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  submitModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1e293b',
  },
  submitModalSubtext: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    fontSize: 13,
  },
  submitModalStats: {
    gap: 8,
    marginBottom: 24,
  },
  submitStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  submitStatLabel: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  submitStatValue: {
    color: '#1e293b',
    fontWeight: '900',
    fontSize: 13,
  },
  submitModalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  submitCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    alignItems: 'center',
  },
  submitCancelBtnText: {
    color: '#64748b',
    fontWeight: '700',
  },
  submitConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    alignItems: 'center',
  },
  submitConfirmBtnText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  hiddenCameraContainer: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  hiddenCamera: {
    width: 1,
    height: 1,
  },
});