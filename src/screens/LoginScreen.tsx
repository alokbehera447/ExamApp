import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  Animated,
  Dimensions,
  StatusBar,
  SafeAreaView,
  TouchableWithoutFeedback
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

// --- API & Storage Imports ---
import {
  studentLogin,
  getUserProfile,
  LoginSuccessResponse,
  forceSwitchLogin
} from "../api/authApi";
import {
  saveTokens,
  getStoredCredentials,
  saveCredentials,
  saveUserData,
} from "../utils/storage";
import ConflictModal from "../components/ConflictModal";

const { width, height } = Dimensions.get('window');

const THEME = {
  primary: '#0F172A',
  accent: '#3B82F6',
  surface: '#F8FAFC',
  text: '#1E293B',
  subText: '#64748B',
  border: '#E2E8F0',
};

export default function LoginScreen() {
  const navigation = useNavigation();
  
  // --- STATE ---
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<any>(null);
  const [forceLoginLoading, setForceLoginLoading] = useState(false);

  // Refs & Animations
  const scrollViewRef = useRef<ScrollView>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // --- EFFECTS ---
  useEffect(() => {
    loadSavedCredentials();
    // Entrance Animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();

    // Keyboard Listeners for Auto-Scrolling
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 120, animated: true });
      }, 100);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const credentials = await getStoredCredentials();
      if (credentials) {
        setUsername(credentials.username);
        setPassword(credentials.password);
      }
    } catch (error) { console.log(error); }
  };

  const handleLoginSuccess = async (response: LoginSuccessResponse) => {
    try {
      if (!response.tokens?.access) return Alert.alert("Error", "Invalid response");
      await saveTokens(response.tokens.access, response.tokens.refresh);
      const profile = await getUserProfile(response.tokens.access);
      await saveUserData(profile);
      await saveCredentials(username, password);
      navigation.replace("Home");
    } catch (error: any) {
      Alert.alert("Login Error", error.message || "Failed to complete login");
    }
  };

  const handleLogin = async (forceLogin: boolean = false) => {
    if (!username.trim() || !password.trim()) return Alert.alert("Required", "Enter credentials");
    Keyboard.dismiss();
    try {
      setLoading(true);
      if (forceLogin) setForceLoginLoading(true);
      const response = await studentLogin(username, password, forceLogin);
      if ('has_conflict' in response && response.has_conflict) {
        setConflictInfo(response.conflict_info);
        setShowConflictModal(true);
        return;
      }
      await handleLoginSuccess(response as LoginSuccessResponse);
    } catch (error: any) {
      if (error.has_conflict) {
        setConflictInfo(error.conflict_info);
        setShowConflictModal(true);
      } else {
        Alert.alert("Failed", error.message || "Invalid credentials.");
      }
    } finally {
      setLoading(false);
      setForceLoginLoading(false);
    }
  };

  const handleForceLogin = async () => {
    setShowConflictModal(false);
    setForceLoginLoading(true);
    try {
      const response = await forceSwitchLogin(username, password);
      await handleLoginSuccess(response);
    } catch (error) {
      Alert.alert("Error", "Force login failed.");
    } finally {
      setForceLoginLoading(false);
    }
  };

  const isFormValid = username.length > 0 && password.length > 0;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        {/* Background Design */}
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />

        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 40 }
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.topSpacer} />

              <Animated.View style={[
                styles.innerContent, 
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
              ]}>
                
                {/* Branding */}
                <View style={styles.headerContainer}>
                  <View style={styles.brandIconContainer}>
                    <Icon name="shield-check-outline" size={32} color={THEME.accent} />
                  </View>
                  <Text style={styles.welcomeTitle}>Welcome Back</Text>
                  <Text style={styles.welcomeSubtitle}>Sign in to Dasho Exam dashboard</Text>
                </View>

                {/* Form Card */}
                <View style={styles.formCard}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>USERNAME / EMAIL</Text>
                    <View style={[styles.inputWrapper, focusedInput === 'username' && styles.inputWrapperActive]}>
                      <Icon name="account-outline" size={20} color={focusedInput === 'username' ? THEME.accent : "#94A3B8"} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter ID"
                        placeholderTextColor="#94A3B8"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        onFocus={() => setFocusedInput('username')}
                        onBlur={() => setFocusedInput(null)}
                        onSubmitEditing={() => passwordInputRef.current?.focus()}
                        editable={!loading}
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>PASSWORD</Text>
                    <View style={[styles.inputWrapper, focusedInput === 'password' && styles.inputWrapperActive]}>
                      <Icon name="lock-outline" size={20} color={focusedInput === 'password' ? THEME.accent : "#94A3B8"} />
                      <TextInput
                        ref={passwordInputRef}
                        style={styles.textInput}
                        placeholder="••••••••"
                        placeholderTextColor="#94A3B8"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!isPasswordVisible}
                        onFocus={() => setFocusedInput('password')}
                        onBlur={() => setFocusedInput(null)}
                        onSubmitEditing={() => handleLogin(false)}
                        editable={!loading}
                      />
                      <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                        <Icon name={isPasswordVisible ? "eye-off" : "eye"} size={20} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.forgotBtn}>
                    <Text style={styles.forgotText}>Forgot credentials?</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryButton, (!isFormValid || loading) && styles.primaryButtonDisabled]}
                    onPress={() => handleLogin(false)}
                    disabled={!isFormValid || loading}
                  >
                    {loading || forceLoginLoading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <View style={styles.buttonContent}>
                        <Text style={styles.primaryButtonText}>Sign In</Text>
                        <Icon name="arrow-right" size={18} color="#FFF" style={{ marginLeft: 8 }} />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.footerContainer}>
                  <Icon name="shield-lock" size={14} color="#94A3B8" />
                  <Text style={styles.footerText}>Secure End-to-End Encryption</Text>
                </View>

              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <ConflictModal
          visible={showConflictModal}
          conflictInfo={conflictInfo}
          onCancel={() => setShowConflictModal(false)}
          onContinue={handleForceLogin}
          loading={forceLoginLoading}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  bgCircle1: {
    position: 'absolute', top: -100, right: -100, width: 300, height: 300,
    borderRadius: 150, backgroundColor: '#F1F5F9', opacity: 0.6,
  },
  bgCircle2: {
    position: 'absolute', top: height * 0.4, left: -50, width: 200, height: 200,
    borderRadius: 100, backgroundColor: '#F8FAFC', opacity: 0.8,
  },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  topSpacer: { height: height * 0.12 },
  innerContent: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  headerContainer: { marginBottom: 40 },
  brandIconContainer: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: '#F0F9FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: '#E0F2FE',
  },
  welcomeTitle: { fontSize: 28, fontWeight: '700', color: THEME.primary, marginBottom: 8 },
  welcomeSubtitle: { fontSize: 16, color: THEME.subText },
  formCard: { marginBottom: 30 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 8, letterSpacing: 0.5 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.surface,
    borderWidth: 1.5, borderColor: THEME.border, borderRadius: 12, height: 56, paddingHorizontal: 16,
  },
  inputWrapperActive: { borderColor: THEME.accent, backgroundColor: '#FFFFFF' },
  textInput: { flex: 1, fontSize: 16, color: THEME.text, fontWeight: '500', marginLeft: 10 },
  forgotBtn: { alignItems: 'flex-end', marginBottom: 24 },
  forgotText: { fontSize: 14, color: THEME.accent, fontWeight: '600' },
  primaryButton: {
    backgroundColor: THEME.primary, height: 56, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', elevation: 4,
  },
  primaryButtonDisabled: { backgroundColor: '#94A3B8', elevation: 0 },
  buttonContent: { flexDirection: 'row', alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, opacity: 0.7 },
  footerText: { marginLeft: 8, fontSize: 12, color: '#64748B', fontWeight: '500' },
});