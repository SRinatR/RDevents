import { redirect } from 'next/navigation';

export default function LoginRootRedirectPage() {
  redirect('/ru/login');
}