import { SignUp } from '@clerk/nextjs'
import { AuthShell } from '@/components/expense-tracker/auth-shell'

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp />
    </AuthShell>
  )
}
