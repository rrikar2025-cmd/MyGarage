import { registerWebModule, NativeModule } from 'expo';

class ObdModule extends NativeModule<{}> {}

export default registerWebModule(ObdModule, 'ObdModule');
