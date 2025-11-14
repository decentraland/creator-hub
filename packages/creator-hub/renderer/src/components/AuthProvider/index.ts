import { AuthProvider as BaseAuthProvider } from './component';
import { MockAuthProvider } from './__mocks__/mockAuthProvider';

const isMock = !!process.env.E2E;

const AuthProvider = isMock ? MockAuthProvider : BaseAuthProvider;

export { AuthProvider };
