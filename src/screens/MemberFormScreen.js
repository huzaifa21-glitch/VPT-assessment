import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { membersRepo } from '../db/membersRepo';
import { useSyncStatus } from '../sync/SyncStatusContext';
import { TextField } from '../components/TextField';
import { ChipSelect } from '../components/ChipSelect';
import { PrimaryButton } from '../components/PrimaryButton';
import { Loader } from '../components/Loader';
import { colors } from '../components/theme';

const GENDER_OPTIONS = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
];

const RELATIONSHIP_OPTIONS = [
  { label: 'Head', value: 'HEAD' },
  { label: 'Spouse', value: 'SPOUSE' },
  { label: 'Child', value: 'CHILD' },
  { label: 'Other', value: 'OTHER' },
];

export function MemberFormScreen({ route, navigation }) {
  const { householdId, memberId } = route.params;
  const isEditing = !!memberId;
  const { triggerSync } = useSyncStatus();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('MALE');
  const [relationship, setRelationship] = useState('HEAD');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit member' : 'Add member' });
    if (isEditing) {
      membersRepo.getById(memberId).then((row) => {
        setName(row.name);
        setAge(String(row.age));
        setGender(row.gender);
        setRelationship(row.relationship);
        setLoading(false);
      });
    }
  }, [memberId]);

  async function handleSave() {
    const ageNumber = Number(age);
    if (!name.trim() || !age.trim() || Number.isNaN(ageNumber) || ageNumber < 0) {
      setError('Please enter a name and a valid age.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (isEditing) {
        await membersRepo.update(memberId, { name: name.trim(), age: ageNumber, gender, relationship });
      } else {
        await membersRepo.create({ householdId, name: name.trim(), age: ageNumber, gender, relationship });
      }
      triggerSync();
      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Could not save this member.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader fullscreen label="Loading…" />;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Jane Doe" />
        <TextField label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="34" />
        <ChipSelect label="Gender" options={GENDER_OPTIONS} value={gender} onChange={setGender} />
        <ChipSelect label="Relationship to household" options={RELATIONSHIP_OPTIONS} value={relationship} onChange={setRelationship} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton title={saving ? 'Saving…' : 'Save member'} onPress={handleSave} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16 },
  error: { color: colors.danger, fontSize: 13, marginBottom: 12 },
});
