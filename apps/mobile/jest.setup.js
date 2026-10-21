jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));

// expo-secure-store has no native module under jest: keep values in a map that survives jest.resetModules().
jest.mock('expo-secure-store', () => {
  const g = globalThis;
  g.__secureStore = g.__secureStore || new Map();
  return {
    getItemAsync: async (k) => (g.__secureStore.has(k) ? g.__secureStore.get(k) : null),
    setItemAsync: async (k, v) => void g.__secureStore.set(k, v),
    deleteItemAsync: async (k) => void g.__secureStore.delete(k),
  };
});
