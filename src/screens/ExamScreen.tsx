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
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const { width, height } = Dimensions.get('window');

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

  const scrollViewRef = useRef<ScrollView>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

      const questionsData = await getExamQuestions(examId);
      const sortedQuestions = questionsData.results.sort((a, b) => a.question_number - b.question_number);
      setQuestions(sortedQuestions);

      console.log(`Loaded ${sortedQuestions.length} questions for exam ${examId}`);

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
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
      case "single_mcq": return "radiobox-marked";
      case "multiple_mcq": return "checkbox-multiple-marked";
      case "numerical": return "numeric";
      case "subjective": return "text-box";
      default: return "help-circle";
    }
  };

  const renderQuestion = (question: Question, index: number) => {
    const currentAnswer = userAnswers[question.id]?.answer || "";
    const isFlagged = userAnswers[question.id]?.isFlagged || false;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.questionScrollView}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.questionContainer}>
            {/* Question Header */}
            <View style={styles.questionHeader}>
              <View style={styles.questionNumberContainer}>
                <Text style={styles.questionNumberText}>
                  Question {index + 1}
                </Text>
                <View style={styles.questionMetaContainer}>
                  <View style={styles.questionTypeBadge}>
                    <Icon
                      name={getQuestionTypeIcon(question.question_type)}
                      size={16}
                      color="#3B82F6"
                    />
                    <Text style={styles.questionTypeText}>
                      {question.question_type.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.marksBadge}>
                    <Text style={styles.marksText}>{question.marks} marks</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Question Text */}
            <View style={styles.questionTextContainer}>
              <Text style={styles.questionText}>
                {question.question_text}
              </Text>
            </View>

            {/* Options for MCQ */}
            {['single_mcq', 'multiple_mcq'].includes(question.question_type) && (
              <View style={styles.optionsContainer}>
                {question.options.map((option, optionIndex) => {
                  const isSelected = question.question_type === 'single_mcq'
                    ? currentAnswer === option
                    : currentAnswer.split('|').includes(option);

                  return (
                    <TouchableOpacity
                      key={optionIndex}
                      style={[
                        styles.optionButton,
                        isSelected && styles.optionSelected
                      ]}
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
                    >
                      <View style={styles.optionContent}>
                        <View style={[
                          styles.optionIndicator,
                          isSelected && styles.optionIndicatorSelected
                        ]}>
                          {question.question_type === 'single_mcq' ? (
                            isSelected && <View style={styles.optionIndicatorInner} />
                          ) : (
                            isSelected && <Icon name="check" size={16} color="#FFFFFF" />
                          )}
                        </View>
                        <View style={styles.optionTextContainer}>
                          <Text style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelSelected
                          ]}>
                            {String.fromCharCode(65 + optionIndex)}.
                          </Text>
                          <Text style={[
                            styles.optionText,
                            isSelected && styles.optionTextSelected
                          ]}>
                            {option}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Input for Numerical/Subjective */}
            {['numerical', 'subjective'].includes(question.question_type) && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Your Answer:
                </Text>
                <TextInput
                  style={[
                    styles.answerInput,
                    question.question_type === 'subjective' && styles.answerInputSubjective
                  ]}
                  value={currentAnswer}
                  onChangeText={(text) => autoSaveAnswer(question.id, text, isFlagged)}
                  placeholder={`Type your ${question.question_type === 'numerical' ? 'numerical answer' : 'detailed answer'} here...`}
                  placeholderTextColor="#94A3B8"
                  multiline={question.question_type === 'subjective'}
                  numberOfLines={question.question_type === 'subjective' ? 8 : 1}
                  keyboardType={question.question_type === 'numerical' ? 'numeric' : 'default'}
                  textAlignVertical="top"
                />
                {question.question_type === 'numerical' && (
                  <Text style={styles.inputHint}>
                    Enter only numbers
                  </Text>
                )}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.questionActions}>
              <TouchableOpacity
                style={[styles.flagButton, isFlagged && styles.flagButtonActive]}
                onPress={() => autoSaveAnswer(question.id, currentAnswer, !isFlagged)}
              >
                <Icon
                  name={isFlagged ? "flag" : "flag-outline"}
                  size={20}
                  color={isFlagged ? "#EF4444" : "#64748B"}
                />
                <Text style={[styles.flagButtonText, isFlagged && styles.flagButtonTextActive]}>
                  {isFlagged ? "Flagged" : "Flag for Review"}
                </Text>
              </TouchableOpacity>

              <View style={styles.navigationButtons}>
                {index > 0 && (
                  <TouchableOpacity
                    style={styles.navButton}
                    onPress={() => navigateToQuestion(index - 1)}
                  >
                    <Icon name="chevron-left" size={24} color="#3B82F6" />
                    <Text style={styles.navButtonText}>Previous</Text>
                  </TouchableOpacity>
                )}

                {index < questions.length - 1 && (
                  <TouchableOpacity
                    style={[styles.navButton, styles.navButtonNext]}
                    onPress={() => navigateToQuestion(index + 1)}
                  >
                    <Text style={styles.navButtonTextNext}>Next Question</Text>
                    <Icon name="chevron-right" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Auto-save status */}
            <View style={styles.saveStatusContainer}>
              {autoSaving ? (
                <View style={styles.savingIndicator}>
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text style={styles.savingText}>Saving...</Text>
                </View>
              ) : lastSaved && (
                <View style={styles.savedIndicator}>
                  <Icon name="check-circle" size={16} color="#10B981" />
                  <Text style={styles.savedText}>Saved at {lastSaved}</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading Exam...</Text>
          <Text style={styles.loadingSubtext}>Please wait while we prepare your questions</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Icon name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Exam Not Found</Text>
          <Text style={styles.errorText}>
            Unable to load exam questions. This might be due to:
            {"\n"}- Network issues
            {"\n"}- Exam has been removed
            {"\n"}- Invalid exam access
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={20} color="#FFFFFF" />
            <Text style={styles.backButtonText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const answeredCount = Object.keys(userAnswers).filter(id =>
    userAnswers[parseInt(id)]?.answer?.trim() !== ""
  ).length;
  const flaggedCount = Object.keys(userAnswers).filter(id =>
    userAnswers[parseInt(id)]?.isFlagged
  ).length;

  const renderProctoringStatus = () => {
    if (!attempt?.proctoring_enabled) return null;
    
    return (
      <View style={styles.proctoringStatusContainer}>
        <View style={styles.proctoringStatus}>
          <Icon 
            name={isTakingSnapshot ? "camera" : "camera-outline"} 
            size={16} 
            color={isTakingSnapshot ? "#3B82F6" : hasPermission ? "#10B981" : "#EF4444"} 
          />
          <Text style={[
            styles.proctoringStatusText,
            isTakingSnapshot && styles.proctoringStatusTextActive
          ]}>
            {isTakingSnapshot ? 'Taking Snapshot...' : hasPermission ? 'Proctoring Active' : 'Camera Permission Denied'}
          </Text>
          {lastSnapshotTime && (
            <Text style={styles.proctoringTime}>
              Last: {lastSnapshotTime}
            </Text>
          )}
          <Text style={styles.proctoringCount}>
            #{snapshotCount}
          </Text>
          {violationCount > 0 && (
            <View style={styles.violationBadge}>
              <Text style={styles.violationText}>{violationCount}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Hidden Camera View for Proctoring */}
      {attempt?.proctoring_enabled && hasPermission && device && (
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

      {/* ⭐ PROFESSIONAL VIOLATION MODAL - ADD THIS ⭐ */}
      <ViolationModal
        visible={violationModal.visible}
        onClose={closeViolationModal}
        violationType={violationModal.violationType}
        violationTitle={violationModal.violationTitle}
        violationMessage={violationModal.violationMessage}
        totalViolations={violationModal.totalViolations}
        isDisqualified={violationModal.isDisqualified}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButtonHeader}>
            <Icon name="arrow-left" size={24} color="#1E293B" />
          </TouchableOpacity>
          <View style={styles.examInfo}>
            <Text style={styles.examTitle} numberOfLines={1}>
              {attempt.exam_title}
            </Text>
            <Text style={styles.examSubtitle}>
              Attempt #{attempt.attempt_number}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.timerContainer}>
            <Icon name="timer-outline" size={20} color="#EF4444" />
            <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
          </View>
        </View>
      </View>

      {/* Proctoring Status */}
      {renderProctoringStatus()}

      {/* Questions Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {currentQuestionIndex + 1} of {questions.length}
        </Text>
      </View>

      {/* Questions Navigator */}
      <View style={styles.questionsNavContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.questionsNavContent}
        >
          {questions.map((question, index) => {
            const status = getQuestionStatus(question.id);
            const isCurrent = currentQuestionIndex === index;

            return (
              <TouchableOpacity
                key={question.id}
                style={[
                  styles.questionNavItem,
                  isCurrent && styles.questionNavItemActive,
                  status === "answered" && styles.questionNavItemAnswered,
                  status === "flagged" && styles.questionNavItemFlagged,
                ]}
                onPress={() => navigateToQuestion(index)}
              >
                <Text style={[
                  styles.questionNavNumber,
                  isCurrent && styles.questionNavNumberActive,
                  status === "answered" && styles.questionNavNumberAnswered,
                  status === "flagged" && styles.questionNavNumberFlagged,
                ]}>
                  {index + 1}
                </Text>
                <View style={[
                  styles.questionNavIndicator,
                  { backgroundColor: getQuestionStatusColor(status) }
                ]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content */}
      {questions.length > 0 && renderQuestion(questions[currentQuestionIndex], currentQuestionIndex)}

      {/* Quick Stats Footer */}
      <View style={styles.footer}>
        <View style={styles.footerStats}>
          <View style={styles.footerStat}>
            <Text style={styles.footerStatValue}>{answeredCount}</Text>
            <Text style={styles.footerStatLabel}>Answered</Text>
          </View>
          <View style={styles.footerStat}>
            <Text style={[styles.footerStatValue, { color: "#EF4444" }]}>{flaggedCount}</Text>
            <Text style={styles.footerStatLabel}>Flagged</Text>
          </View>
          <View style={styles.footerStat}>
            <Text style={[styles.footerStatValue, { color: "#64748B" }]}>{questions.length - answeredCount}</Text>
            <Text style={styles.footerStatLabel}>Left</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.quickSubmitButton}
          onPress={() => setShowSubmitModal(true)}
        >
          <Icon name="send" size={20} color="#FFFFFF" />
          <Text style={styles.quickSubmitText}>Submit</Text>
        </TouchableOpacity>
      </View>

      {/* Submit Modal */}
      <Modal
        visible={showSubmitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSubmitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIcon}>
              <Icon name="send-check" size={48} color="#3B82F6" />
            </View>
            <Text style={styles.modalTitle}>Submit Exam?</Text>
            <Text style={styles.modalText}>
              Are you sure you want to submit your exam? Once submitted, you cannot make any changes.
            </Text>

            <View style={styles.modalStats}>
              <View style={styles.modalStatItem}>
                <Text style={styles.modalStatLabel}>Questions Answered</Text>
                <Text style={[styles.modalStatValue, { color: "#10B981" }]}>
                  {answeredCount}/{questions.length}
                </Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={styles.modalStatLabel}>Questions Flagged</Text>
                <Text style={[styles.modalStatValue, { color: "#EF4444" }]}>
                  {flaggedCount}
                </Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={styles.modalStatLabel}>Time Remaining</Text>
                <Text style={styles.modalStatValue}>
                  {formatTime(timeRemaining)}
                </Text>
              </View>
              {attempt?.proctoring_enabled && (
                <View style={styles.modalStatItem}>
                  <Text style={styles.modalStatLabel}>Snapshots Taken</Text>
                  <Text style={styles.modalStatValue}>
                    {snapshotCount}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowSubmitModal(false)}
                disabled={submitting}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={submitExam}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Icon name="check-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.modalButtonSubmitText}>Submit Now</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Styles (keep all your existing styles exactly the same)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 300,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 20,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonHeader: {
    padding: 4,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  examInfo: {
    marginLeft: 12,
    flex: 1,
  },
  examTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  examSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  headerRight: {
    marginLeft: 12,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  proctoringStatusContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  proctoringStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  proctoringStatusText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  proctoringStatusTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  proctoringTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 4,
  },
  proctoringCount: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  violationBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  violationText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  progressBarContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  questionsNavContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  questionsNavContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  questionNavItem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  questionNavItemActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  questionNavItemAnswered: {
    backgroundColor: '#D1FAE5',
  },
  questionNavItemFlagged: {
    backgroundColor: '#FEE2E2',
  },
  questionNavNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  questionNavNumberActive: {
    color: '#3B82F6',
  },
  questionNavNumberAnswered: {
    color: '#059669',
  },
  questionNavNumberFlagged: {
    color: '#EF4444',
  },
  questionNavIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  questionScrollView: {
    flex: 1,
  },
  questionContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  questionHeader: {
    marginBottom: 16,
  },
  questionNumberContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  questionNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  questionMetaContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  questionTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  questionTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
  },
  marksBadge: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  marksText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0EA5E9',
  },
  questionTextContainer: {
    marginBottom: 24,
  },
  questionText: {
    fontSize: 16,
    color: '#1E293B',
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  optionsContainer: {
    marginBottom: 24,
    gap: 8,
  },
  optionButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  optionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  optionIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionIndicatorSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#3B82F6',
  },
  optionIndicatorInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  optionTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  optionLabelSelected: {
    color: '#3B82F6',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  optionTextSelected: {
    color: '#1E293B',
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  answerInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1E293B',
    minHeight: 56,
  },
  answerInputSubjective: {
    minHeight: 200,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    marginLeft: 4,
  },
  questionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  flagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  flagButtonActive: {
    backgroundColor: '#FEF2F2',
  },
  flagButtonText: {
    fontSize: 14,
    color: '#64748B',
  },
  flagButtonTextActive: {
    color: '#EF4444',
    fontWeight: '600',
  },
  navigationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  navButtonNext: {
    backgroundColor: '#3B82F6',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  navButtonTextNext: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveStatusContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingText: {
    fontSize: 12,
    color: '#3B82F6',
  },
  savedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedText: {
    fontSize: 12,
    color: '#64748B',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerStats: {
    flexDirection: 'row',
    gap: 16,
  },
  footerStat: {
    alignItems: 'center',
  },
  footerStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  footerStatLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  quickSubmitButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  quickSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalStats: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  modalStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalStatLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  modalStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F1F5F9',
  },
  modalButtonSubmit: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    gap: 8,
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  modalButtonSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});