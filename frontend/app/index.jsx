import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

export default function Index() {
  const { token } = useSelector((state) => state.auth);

  if (token) {
    return <Redirect href="/(tabs)/home" />;
  }
  return <Redirect href="/(auth)/login" />;
}
