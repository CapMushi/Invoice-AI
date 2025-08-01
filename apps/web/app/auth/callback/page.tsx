import AuthCallback from '../../../components/auth/AuthCallback'
import styles from '../auth.module.css'

export default function AuthCallbackPage() {
  return (
    <div className={styles['auth-callback-container']}>
      <AuthCallback />
    </div>
  )
} 