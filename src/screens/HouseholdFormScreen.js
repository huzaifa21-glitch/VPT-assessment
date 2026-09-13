import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { householdsRepo } from '../db/householdsRepo';
import { useAuth } from '../auth/AuthContext';
import { useSyncStatus } from '../sync/SyncStatusContext';
import { FormScreen } from '../components/FormScreen';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { Loader } from '../components/Loader';
import { colors } from '../components/theme';

export function HouseholdFormScreen({ route, navigation }) {
  const { householdId } = route.params || {};
  const isEditing = !!householdId;
  const { user } = useAuth();
  const { triggerSync } = useSyncStatus();

  const [householdCode, setHouseholdCode] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit household' : 'Add household' });
    if (isEditing) {
      householdsRepo.getById(householdId).then((row) => {
        setHouseholdCode(row.householdCode);
        setAddress(row.address);
        setLoading(false);
      });
    }
  }, [householdId]);

  async function handleSave() {
    if (!householdCode.trim() || !address.trim()) {
      setError('Household code and address are both required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (isEditing) {
        await householdsRepo.update(householdId, { address: address.trim() });
      } else {
        await householdsRepo.create({
          householdCode: householdCode.trim(),
          address: address.trim(),
          areaId: user.areaId,
          areaName: user.area?.name,
        });
      }
      // Fire a sync attempt in the background — if we're online this reaches
      // the server right away; if not, it's a no-op and stays queued locally.
      triggerSync();
      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Could not save this household.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader fullscreen label="Loading…" />;

  return (
    <FormScreen>
      <TextField
        label="Household code"
        value={householdCode}
        onChangeText={setHouseholdCode}
        placeholder="HH-0002"
        editable={!isEditing}
        style={isEditing && styles.readOnly}
      />
      <TextField
        label="Address"
        value={address}
        onChangeText={setAddress}
        placeholder="14 Sample Street"
        multiline
      />

      <View style={styles.areaBox}>
        <Text style={styles.areaLabel}>Area</Text>
        <Text style={styles.areaValue}>{user?.area?.name || 'Unassigned'}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title={saving ? 'Saving…' : 'Save household'} onPress={handleSave} loading={saving} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  readOnly: { backgroundColor: '#f1f5f9', color: colors.textMuted },
  areaBox: { marginBottom: 20 },
  areaLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  areaValue: { fontSize: 14, color: colors.textSecondary },
  error: { color: colors.danger, fontSize: 13, marginBottom: 12 },
});
