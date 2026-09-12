import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { SyncStatusProvider } from '../sync/SyncStatusContext';
import { LoginScreen } from '../screens/LoginScreen';
import { HouseholdListScreen } from '../screens/HouseholdListScreen';
import { HouseholdFormScreen } from '../screens/HouseholdFormScreen';
import { HouseholdDetailScreen } from '../screens/HouseholdDetailScreen';
import { MemberFormScreen } from '../screens/MemberFormScreen';
import { MemberDetailScreen } from '../screens/MemberDetailScreen';
import { AssessmentFormScreen } from '../screens/AssessmentFormScreen';
import { SyncStatusScreen } from '../screens/SyncStatusScreen';
import { colors } from '../components/theme';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: '#fff' },
  headerTitleStyle: { color: colors.textPrimary, fontSize: 16 },
  headerTintColor: colors.accent,
  contentStyle: { backgroundColor: colors.bg },
};

export function RootNavigator() {
  const { user, initializing } = useAuth();

  // App.js already shows a fullscreen loader before AuthProvider finishes
  // its initial check, so this should be brief/invisible in practice.
  if (initializing) return null;

  if (!user) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // SyncStatusProvider (network listener + initial sync) only runs while
  // logged in — it mounts fresh on login and tears down cleanly on logout.
  return (
    <SyncStatusProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen name="HouseholdList" component={HouseholdListScreen} options={{ headerShown: false }} />
          <Stack.Screen name="HouseholdForm" component={HouseholdFormScreen} />
          <Stack.Screen name="HouseholdDetail" component={HouseholdDetailScreen} options={{ title: 'Household' }} />
          <Stack.Screen name="MemberForm" component={MemberFormScreen} />
          <Stack.Screen name="MemberDetail" component={MemberDetailScreen} options={{ title: 'Member' }} />
          <Stack.Screen name="AssessmentForm" component={AssessmentFormScreen} />
          <Stack.Screen name="SyncStatus" component={SyncStatusScreen} options={{ title: 'Sync status' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SyncStatusProvider>
  );
}
