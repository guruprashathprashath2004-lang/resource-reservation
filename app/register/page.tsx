import AuthForm from "@/components/AuthForm";
import { register } from "@/app/actions/auth";

export default function RegisterPage() {
  return <AuthForm mode="register" action={register} />;
}