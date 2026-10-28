import { NativeModule, requireNativeModule } from 'expo';

declare class ObdModule extends NativeModule<{}> {}

export default requireNativeModule<ObdModule>('Obd');
