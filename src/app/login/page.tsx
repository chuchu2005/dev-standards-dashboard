import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/catalog" } = await searchParams;
  return (
    <>
      <h1>Sign in</h1>
      <LoginForm next={next} />
    </>
  );
}
