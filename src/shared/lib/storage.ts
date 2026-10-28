import AsyncStorage from '@react-native-async-storage/async-storage';
/** Namespace guest data separately from account data; cloud records are never persisted here. */
export const storage = AsyncStorage;
