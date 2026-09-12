import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { assessmentsRepo } from '../db/assessmentsRepo';
import { useSyncStatus } from '../sync/SyncStatusContext';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { Loader } from '../components/Loader';
import { colors } from '../components/theme';

function ToggleRow({ label, value, onValueChange }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.accent }} />
    </View>
  );
}

export function AssessmentFormScreen({ route, navigation }) {
  const { memberId, assessmentId } = route.params;
  const isEditing = !!assessmentId;
  const { triggerSync } = useSyncStatus();

  const [temperatureC, setTemperatureC] = useState('');
  const [hasFever, setHasFever] = useState(false);
  const [hasCough, setHasCough] = useState(false);
  const [hasBreathingDifficulty, setHasBreathingDifficulty] = useState(false);
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [notes, setNotes] = useState('');
  const [flagForReview, setFlagForReview] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit assessment' : 'Add assessment' });
    if (isEditing) {
      assessmentsRepo.getById(assessmentId).then((row) => {
        setTemperatureC(row.temperatureC != null ? String(row.temperatureC) : '');
        setHasFever(!!row.hasFever);
        setHasCough(!!row.hasCough);
        setHasBreathingDifficulty(!!row.hasBreathingDifficulty);
        setBpSystolic(row.bloodPressureSystolic != null ? String(row.bloodPressureSystolic) : '');
        setBpDiastolic(row.bloodPressureDiastolic != null ? String(row.bloodPressureDiastolic) : '');
        setNotes(row.notes || '');
        setFlagForReview(!!row.flagForReview);
        setLoading(false);
      });
    }
  }, [assessmentId]);

  // Mirrors the backend's trigger condition — shown live so the field worker
  // sees the same "this will be flagged urgent" signal the server will
  // compute once it syncs.
  const willBeUrgent = (hasFever && hasBreathingDifficulty) || flagForReview;

  async function handleSave() {
    setError('');
    const input = {
      temperatureC: temperatureC.trim() ? Number(temperatureC) : undefined,
      hasFever,
      hasCough,
      hasBreathingDifficulty,
      bloodPressureSystolic: bpSystolic.trim() ? Number(bpSystolic) : undefined,
      bloodPressureDiastolic: bpDiastolic.trim() ? Number(bpDiastolic) : undefined,
      notes: notes.trim() || undefined,
      flagForReview,
    };
    setSaving(true);
    try {
      if (isEditing) {
        await assessmentsRepo.update(assessmentId, input);
      } else {
        await assessmentsRepo.create({ memberId, ...input });
      }
      triggerSync();
      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Could not save this assessment.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader fullscreen label="Loading…" />;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TextField
          label="Temperature (°C)"
          value={temperatureC}
          onChangeText={setTemperatureC}
          keyboardType="decimal-pad"
          placeholder="37.5"
        />

        <ToggleRow label="Fever" value={hasFever} onValueChange={setHasFever} />
        <ToggleRow label="Cough" value={hasCough} onValueChange={setHasCough} />
        <ToggleRow label="Breathing difficulty" value={hasBreathingDifficulty} onValueChange={setHasBreathingDifficulty} />

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <TextField
              label="BP systolic"
              value={bpSystolic}
              onChangeText={setBpSystolic}
              keyboardType="number-pad"
              placeholder="120"
            />
          </View>
          <View style={styles.halfInput}>
            <TextField
              label="BP diastolic"
              value={bpDiastolic}
              onChangeText={setBpDiastolic}
              keyboardType="number-pad"
              placeholder="80"
            />
          </View>
        </View>

        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Optional notes" />

        <ToggleRow label="Flag for review" value={flagForReview} onValueChange={setFlagForReview} />

        {willBeUrgent && (
          <View style={styles.urgentBanner}>
            <Text style={styles.urgentText}>This will be marked urgent once synced.</Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton title={saving ? 'Saving…' : 'Save assessment'} onPress={handleSave} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 12,
  },
  toggleLabel: { fontSize: 14, color: colors.textPrimary },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  urgentBanner: { backgroundColor: colors.dangerBg, borderRadius: 8, padding: 12, marginBottom: 16 },
  urgentText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, marginBottom: 12 },
});
