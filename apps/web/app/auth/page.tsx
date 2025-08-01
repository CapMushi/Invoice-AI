import AuthForm from '../../components/auth/AuthForm'
import AuthGuard from '../../components/auth/AuthGuard'
import ClientSignOutButtons from '../../components/auth/ClientSignOutButtons'
import styles from './auth.module.css'

export default function AuthPage() {
  return (
    <AuthGuard requireAuth={false}>
      <div className={styles['auth-page']}>
        <div className={styles['auth-container']}>
          <div className={styles['auth-header']}>
            <h1>Welcome to Invoice Bot</h1>
            <p>Sign in to manage your invoices with AI</p>
          </div>
          <AuthForm />
          <ClientSignOutButtons />
        </div>
      </div>
    </AuthGuard>
  )
}
 