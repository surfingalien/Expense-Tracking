import { SignIn } from '@clerk/nextjs'
import { AuthShell } from '@/components/expense-tracker/auth-shell'

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn />
    </AuthShell>
  )
}
