import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { createUserProfile } from '../../lib/firestore/users';
import { useColors } from '../../store/themeStore';
import { getAuthErrorMessage } from '../../lib/authErrors';

function StrengthRow({ met, label }: { met: boolean; label: string }) {
  const c = useColors();
  return (
    <View style={s.strengthRow}>
      <Ionicons
        name={met ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={met ? '#5C9E3E' : c.gray}
      />
      <Text style={[s.strengthLabel, { color: c.gray }, met && { color: c.textPrimary }]}>{label}</Text>
    </View>
  );
}

interface PasswordFieldProps {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  hasError?: boolean;
}

function PasswordField({ placeholder, value, onChangeText, hasError }: PasswordFieldProps) {
  const c = useColors();
  const [show, setShow] = useState(false);
  return (
    <View style={[s.passwordWrap, { backgroundColor: c.surface, borderColor: hasError ? c.danger : c.border }]}>
      <TextInput
        style={[s.passwordInput, { color: c.textPrimary }]}
        placeholder={placeholder}
        placeholderTextColor={c.gray}
        secureTextEntry={!show}
        value={value}
        onChangeText={onChangeText}
      />
      <TouchableOpacity style={s.eyeBtn} onPress={() => setShow((v) => !v)} hitSlop={8}>
        <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.gray} />
      </TouchableOpacity>
    </View>
  );
}

export default function SignupScreen() {
  const c = useColors();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [retypePassword, setRetypePassword] = useState('');
  const [loading, setLoading] = useState(false);

  const hasLength = password.length >= 6;
  const passwordValid = hasLength;
  const passwordsMatch = retypePassword.length > 0 && password === retypePassword;

  async function handleSignup() {
    if (!username || !email || !password || !retypePassword) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (!passwordValid) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== retypePassword) {
      Alert.alert("Passwords don't match", 'Please make sure your passwords match.');
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await createUserProfile(cred.user.uid, username.trim().toLowerCase(), username.trim());
      router.replace('/(tabs)');
    } catch (e: unknown) {
      Alert.alert('Sign up failed', getAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={c.textPrimary} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={s.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.title, { color: c.primary }]}>Create Account</Text>
        <Text style={[s.subtitle, { color: c.gray }]}>Join the birding community</Text>

        <TextInput
          style={[s.input, { backgroundColor: c.surface, color: c.textPrimary, borderColor: c.border }]}
          placeholder="Username (max 15 chars)"
          placeholderTextColor={c.gray}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={15}
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={[s.input, { backgroundColor: c.surface, color: c.textPrimary, borderColor: c.border }]}
          placeholder="Email"
          placeholderTextColor={c.gray}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <PasswordField placeholder="Password" value={password} onChangeText={setPassword} />

        {password.length > 0 && (
          <View style={[s.strengthBox, { backgroundColor: c.surface, borderColor: c.border }]}>
            <StrengthRow met={hasLength} label="At least 6 characters" />
          </View>
        )}

        <PasswordField
          placeholder="Retype password"
          value={retypePassword}
          onChangeText={setRetypePassword}
          hasError={retypePassword.length > 0 && !passwordsMatch}
        />
        {retypePassword.length > 0 && !passwordsMatch && (
          <Text style={[s.errorText, { color: c.danger }]}>Passwords don't match</Text>
        )}

        <TouchableOpacity style={[s.btn, { backgroundColor: c.accent }]} onPress={handleSignup} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={c.black} />
          ) : (
            <Text style={[s.btnText, { color: c.black }]}>Create Account</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  inner: {
    paddingTop: 100,
    paddingHorizontal: 32,
    paddingBottom: 48,
    gap: 12,
  },
  title: { fontSize: 28, fontFamily: 'Nunito_800ExtraBold', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 12, letterSpacing: 0.5 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeBtn: { paddingHorizontal: 14 },
  strengthBox: {
    borderRadius: 10,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    marginTop: -4,
  },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  strengthLabel: { fontSize: 12 },
  errorText: { fontSize: 12, marginTop: -4 },
  btn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { fontSize: 16, fontFamily: 'Nunito_700Bold' },
});
