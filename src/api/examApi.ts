// api/examApi.ts
import axios from "axios";
import { getAccessToken } from "../utils/storage";

const API_BASE_URL = "https://exams.dashoapp.com/api";

export interface Exam {
  id: number;
  title: string;
  description: string;
  institute_name: string;
  pattern: {
    id: number;
    name: string;
    total_questions: number;
    total_duration: number;
    total_marks: number;
    sections: Array<{
      id: number;
      name: string;
      subject_name: string;
      question_type: string;
      total_questions_in_section: number;
      total_marks_in_section: number;
      marks_per_question: number;
      negative_marking: string;
      min_questions_to_attempt: number;
      is_compulsory: boolean;
      order: number;
      questions_added: number;
    }>;
  };
  status: string;
  start_date: string;
  end_date: string;
  duration_minutes: number;
  total_questions: number;
  total_marks: number;
  max_attempts: number;
  is_active: boolean;
  questions_added: number;
  is_question_complete: boolean;
  share_url: string;
  allow_late_submission: boolean;
  late_submission_penalty: string;
  require_fullscreen: boolean;
  disable_copy_paste: boolean;
  disable_right_click: boolean;
  enable_webcam_proctoring: boolean;
  allow_tab_switching: boolean;
  shuffle_questions: boolean;
  shuffle_within_sections: boolean;
  shuffle_options: boolean;
  timezone: string;
  grace_period_minutes: number;
  buffer_time_minutes: number;
  auto_start: boolean;
  auto_end: boolean;
}

export interface ExamsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Exam[];
}

export interface ExamAttempt {
  id: number;
  exam: Exam;
  exam_title: string;
  student: number;
  student_name: string;
  attempt_number: number;
  status: "in_progress" | "completed" | "submitted" | "expired";
  started_at: string;
  submitted_at: string | null;
  time_spent: number;
  score: number | null;
  percentage: number | null;
  rank: number | null;
  ip_address: string;
  violations_count: number;
  proctoring_enabled: boolean;
  max_violations_allowed: number;
  fullscreen_required: boolean;
  is_completed: boolean;
  time_remaining: number;
  created_at: string;
  updated_at: string;
}

export interface StartExamResponse {
  attempt: ExamAttempt;
  message: string;
}

export interface Question {
  id: number;
  question_text: string;
  question_type: "single_mcq" | "multiple_mcq" | "numerical" | "subjective";
  difficulty: "easy" | "medium" | "hard";
  options: string[];
  correct_answer: string;
  solution: string;
  explanation: string;
  marks: number;
  negative_marks: string;
  subject: string;
  topic: string;
  subtopic: string;
  tags: string[];
  question_bank: number | null;
  exam: number;
  exam_title: string;
  question_number: number;
  question_number_in_pattern: number;
  pattern_section_id: number;
  pattern_section_name: string;
  institute: number;
  created_by: number;
  created_by_name: string;
  is_active: boolean;
  is_verified: boolean;
  verified_by: number | null;
  verified_at: string | null;
  usage_count: number;
  success_rate: string;
  images: any[];
  comments: any[];
  structure?: any;
  created_at: string;
  updated_at: string;
}

export interface QuestionsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Question[];
}

export interface AnswerSubmission {
  question_id: number;
  answer: string;
  is_flagged?: boolean;
}

export interface AnswerWithTime {
  question_id: number;
  answer: string;
  is_flagged: boolean;
  time_spent: number;
}

export interface SubmitExamPayload {
  attempt_id: number;
  answers: Record<string, AnswerWithTime>;
}

export interface SubmitExamResponse {
  attempt: ExamAttempt;
  result: {
    id: number;
    attempt: ExamAttempt;
    section_scores: Record<string, any>;
    total_questions_attempted: number;
    total_correct_answers: number;
    total_wrong_answers: number;
    total_unattempted: number;
    answers: Record<string, AnswerWithTime>;
    created_at: string;
  };
  evaluation_result: {
    evaluation_results: any[];
    auto_evaluated: number;
    manual_required: number;
    ai_required: number;
    final_score: number;
    evaluation_progress: number;
  };
  message: string;
}

export interface SnapshotData {
  image_data: string;
  timestamp: string;
  metadata: {
    user_agent: string;
    screen_resolution: string;
    device_pixel_ratio: number;
    timezone: string;
  };
}

export interface SnapshotResponse {
  snapshot_uploaded: boolean;
  analysis: {
    success: boolean;
    error: string;
    violations: any[];
    faces_detected: number;
  };
  violation_count: number;
  auto_disqualified: boolean;
  storage_type: string;
}

// Student Dashboard Interfaces
export interface DashboardExam {
  id: number;
  attempt_id?: number;
  exam_id: number;
  exam_title: string;
  title: string;
  started_at?: string;
  submitted_at?: string;
  time_remaining?: number;
  total_marks: number;
  total_questions: number;
  violations_count?: number;
  status: string;
  can_resume?: boolean;
  score?: number;
  percentage?: number;
  time_spent?: number;
  duration_minutes: number;
  start_date: string;

}

export interface StudentDashboardResponse {
  stats: {
    total_exams_attempted: number;
    average_score: number;
    total_violations: number;
    current_rank: number;
  };
  student_info: {
    name: string;
    email: string;
    institute: string;
    center: string | null;
    center_location: string | null;
  };
  available_exams: DashboardExam[];
  scheduled_exams: DashboardExam[];
  ongoing_exams: DashboardExam[];
  completed_exams: DashboardExam[];
  disqualified_exams: DashboardExam[];
}

export interface ExamResult {
  attempt: ExamAttempt;
  overall_score: number;
  total_questions: number;
  attempted_questions: number;
  total_marks: number;
  marks_obtained: number;
  percentage: number;
  section_results: Record<string, {
    section_name: string;
    subject: string;
    question_type: string;
    score: number;
    max_marks: number;
    status: string;
    feedback: string;
  }>;
  detailed_answers: Record<string, any>;
  submitted_at: string;
  time_spent: number;
  answer_sheet_pdf: string | null;
}

export const takeProctoringSnapshot = async (
  attemptId: number,
  snapshotData: SnapshotData
): Promise<SnapshotResponse> => {
  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("No access token found");
    }

    console.log(`Taking snapshot for attempt ${attemptId}...`);

    const response = await axios.post(
      `${API_BASE_URL}/exams/attempts/${attemptId}/proctoring/snapshot/`,
      snapshotData,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    console.log(`Snapshot response for attempt ${attemptId}:`, response.data);
    return response.data;
  } catch (error: any) {
    console.error(`Error taking proctoring snapshot:`, error.response?.data || error.message);
    throw error;
  }
};

// Get all questions for an exam (handles pagination automatically)
export const getExamQuestions = async (attemptId: number, examId?: number): Promise<QuestionsResponse> => {
  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("No access token found");
    }

    let actualExamId = examId;

    // If examId not provided, get it from the attempt
    if (!actualExamId) {
      console.log(`Getting exam ID from attempt ${attemptId}...`);
      const attemptResponse = await axios.get(
        `${API_BASE_URL}/exams/attempts/${attemptId}/`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        }
      );
      actualExamId = attemptResponse.data.exam.id;
      console.log(`Found exam ID: ${actualExamId} for attempt ${attemptId}`);
    }

    let allQuestions: Question[] = [];
    let nextUrl: string | null = `${API_BASE_URL}/questions/questions/?exam=${actualExamId}`;
    let totalCount = 0;

    console.log(`Fetching all questions for exam ${actualExamId}...`);

    while (nextUrl) {
      const response: any = await axios.get(
        nextUrl,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );

      allQuestions = [...allQuestions, ...response.data.results];
      totalCount = response.data.count;
      nextUrl = response.data.next;

      console.log(`Fetched ${allQuestions.length} of ${totalCount} questions...`);
    }

    console.log(`Total questions fetched: ${allQuestions.length}`);

    return {
      count: allQuestions.length,
      next: null,
      previous: null,
      results: allQuestions
    };
  } catch (error: any) {
    console.error(`Error fetching questions:`, error.response?.data || error.message);
    throw error;
  }
};

export const autoSaveAnswer = async (attemptId: number, questionId: number, userAnswer: string, isFlagged: boolean = false) => {
  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("No access token found");
    }

    const response = await axios.post(
      `${API_BASE_URL}/exams/attempts/${attemptId}/auto-save/`,
      {
        question_id: questionId,
        user_answer: userAnswer,
        is_flagged: isFlagged
      },
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error(`Error auto-saving answer:`, error.response?.data || error.message);
    throw error;
  }
};

// Submit an answer for a question
export const submitAnswer = async (attemptId: number, questionId: number, answer: string, isFlagged: boolean = false) => {
  return autoSaveAnswer(attemptId, questionId, answer, isFlagged);
};

// Submit multiple answers at once
export const submitMultipleAnswers = async (attemptId: number, answers: AnswerSubmission[]) => {
  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("No access token found");
    }

    const response = await axios.post(
      `${API_BASE_URL}/exams/submit-multiple-answers/`,
      {
        attempt_id: attemptId,
        answers: answers.map(answer => ({
          question_id: answer.question_id,
          user_answer: answer.answer,
          is_flagged: answer.is_flagged || false
        }))
      },
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error(`Error submitting multiple answers:`, error.response?.data || error.message);
    throw error;
  }
};

// Final exam submission with all answers and time tracking
export const submitExam = async (payload: SubmitExamPayload): Promise<SubmitExamResponse> => {
  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("No access token found");
    }

    console.log('Submitting exam with payload:', payload);

    const response = await axios.post(
      `${API_BASE_URL}/exams/submit-exam/`,
      payload,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    console.log('Exam submitted successfully:', response.data);
    return response.data;
  } catch (error: any) {
    console.error(`Error submitting exam:`, error.response?.data || error.message);
    throw error;
  }
};

// Get saved answers for an attempt
export const getSavedAnswers = async (attemptId: number) => {
  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("No access token found");
    }

    const response = await axios.get(
      `${API_BASE_URL}/exams/attempts/${attemptId}/answers/`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error(`Error fetching saved answers:`, error.response?.data || error.message);
    throw error;
  }
};

// Get student dashboard with all exam categories (NEW - Primary method for HomeScreen)
export const getStudentDashboard = async (): Promise<StudentDashboardResponse> => {
  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("No access token found");
    }

    console.log('Fetching student dashboard...');

    const response = await axios.get(
      `${API_BASE_URL}/exams/student-dashboard/`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    console.log('Student dashboard loaded successfully');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching student dashboard:', error.response?.data || error.message);
    throw error;
  }
};

// KEPT for backward compatibility
export const getPublishedExams = async (): Promise<ExamsResponse> => {
  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("No access token found");
    }

    const response = await axios.get(
      `${API_BASE_URL}/exams/exams/`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("Error fetching exams:", error.response?.data || error.message);
    throw error;
  }
};

export const getUpcomingExams = async (): Promise<Exam[]> => {
  try {
    const response = await getPublishedExams();

    const now = new Date();

    const upcomingExams = response.results.filter(exam => {
      const endDate = new Date(exam.end_date);
      const isNotEnded = endDate > now;

      return isNotEnded && exam.is_question_complete;
    }).sort((a, b) => {
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    });

    return upcomingExams;
  } catch (error) {
    console.error("Error fetching upcoming exams:", error);
    throw error;
  }
};

// Get detailed exam information (KEPT - Used for exam details modal)
export const getExamDetails = async (examId: number): Promise<Exam> => {
  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("No access token found");
    }

    console.log(`Fetching details for exam ${examId}...`);

    const response = await axios.get(
      `${API_BASE_URL}/exams/exams/${examId}/`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    console.log(`Exam details loaded for exam ${examId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching exam ${examId}:`, error.response?.data || error.message);
    throw error;
  }
};

export const getAllActiveExams = async (): Promise<Exam[]> => {
  try {
    const response = await getPublishedExams();

    const now = new Date();

    return response.results.filter(exam => {
      const endDate = new Date(exam.end_date);
      return endDate > now && exam.is_question_complete;
    }).sort((a, b) => {
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    });
  } catch (error) {
    console.error("Error fetching active exams:", error);
    throw error;
  }
};

export const startExam = async (examId: number): Promise<StartExamResponse> => {
  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("No access token found");
    }

    console.log(`Starting exam ${examId}...`);

    const response = await axios.post(
      `${API_BASE_URL}/exams/start-exam/`,
      {
        exam_id: examId
      },
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    console.log(`Exam ${examId} started successfully`);
    return response.data;
  } catch (error: any) {
    console.error(`Error starting exam ${examId}:`, error.response?.data || error.message);
    throw error;
  }
};

export const getExamAttempt = async (attemptId: number): Promise<ExamAttempt> => {
  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("No access token found");
    }

    const response = await axios.get(
      `${API_BASE_URL}/exams/attempts/${attemptId}/`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error(`Error fetching attempt ${attemptId}:`, error);
    throw error;
  }
};
export const getExamResults = async (attemptId: number): Promise<ExamResult> => {
  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("No access token found");
    }

    console.log(`Fetching results for attempt ${attemptId}...`);

    const response = await axios.get(
      `${API_BASE_URL}/exams/attempts/${attemptId}/results/`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    console.log(`Results loaded for attempt ${attemptId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching results for attempt ${attemptId}:`, error.response?.data || error.message);
    throw error;
  }
};